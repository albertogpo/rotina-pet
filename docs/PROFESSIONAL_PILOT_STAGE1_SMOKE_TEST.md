# Rotina Pet — Professional Pilot — Etapa 1B — Migration & Smoke Test

Data de preparação: 2026-09-16

Este runbook cobre exclusivamente a validação da fundação profissional da Etapa 1B: perfil veterinário de teste, paciente preliminar, convite, preview público, autenticação do tutor, matching de pet, aceite, vínculo e peso inicial. Não inclui prontuário completo, tela completa de Pacientes, criador completo de prescrição ou passwordless.

## 1. Estado de pré-migration

A migration alvo é:

`supabase/migrations/20260915_professional_pilot_foundation.sql`

Revisão de segurança realizada antes da aplicação:

- token bruto é retornado apenas no momento da criação e o banco persiste somente `token_hash` SHA-256;
- `get_professional_invitation_preview(text)` é a única RPC do convite liberada a `anon`; o retorno é mínimo e não inclui e-mail do tutor, IDs de usuário, `pet_id`, rotina ou dados da conta;
- `create_professional_invitation(...)` e `accept_professional_invitation(...)` são exclusivas de `authenticated`;
- grants das RPCs são zerados explicitamente para `PUBLIC`, `anon` e `authenticated` antes do regrant mínimo;
- RPCs que usam `pgcrypto` têm `search_path = public, extensions`;
- e-mail convidado é normalizado e validado no cliente e no banco;
- aceite verifica e-mail autenticado, ownership, pet ativo e espécie;
- aceite é idempotente para o mesmo usuário após sucesso;
- regeneração revoga/expira convite pendente anterior;
- ordem de locks de criação/regeneração e aceite é `professional_patient -> invitation`, reduzindo risco de deadlock;
- peso inicial é materializado apenas após o vínculo do pet e seu ID é salvo em `professional_patients.initial_weight_entry_id`;
- alterações nas tabelas legadas são aditivas; políticas de proprietário do Tutor Solo permanecem.

Limites deliberados do piloto:

- o papel `veterinarian` pode ser autoatribuído por usuário autenticado; isso é conveniência do piloto, não verificação de identidade ou CRMV;
- imutabilidade forte das versões de prescrição e autorização dos agregados profissionais devem ser endurecidas antes da camada completa de prescrição/monitoramento.

## 2. Pré-flight antes de aplicar

### 2.1 Confirmar frontend atual

Antes do smoke em produção, confirmar que o commit/deploy do GitHub Pages contém pelo menos:

- `src/components/ProfessionalInvitationPage.tsx`;
- `src/components/ProfessionalAreaPage.tsx`;
- `src/lib/professionalInvite.ts`;
- `src/services/professional/*`;
- `src/types/professional.ts`;
- integração correspondente em `src/App.tsx`.

Não executar o smoke contra um build anterior, porque ele não exercitará o fluxo revisado.

### 2.2 Confirmar Auth no Supabase

Em **Authentication → URL Configuration**:

- Site URL: `https://albertogpo.github.io/rotina-pet/`
- Redirect URLs devem admitir pelo menos:
  - `https://albertogpo.github.io/rotina-pet/`
  - `https://albertogpo.github.io/rotina-pet/**`

Em **Authentication → Email Templates → Confirm signup**, confirmar que o template respeita o redirect passado pelo app. O caminho mais simples é usar `{{ .ConfirmationURL }}`. Se o template foi customizado construindo a URL manualmente, ele não pode ignorar `{{ .RedirectTo }}` em favor de uma `SiteURL` fixa.

O fluxo precisa devolver o navegador para uma URL deste formato:

`https://albertogpo.github.io/rotina-pet/?invite=professional&token=...&intent=accept`

O token bruto permanece somente na URL; não deve ser copiado para `localStorage` ou `sessionStorage`.

### 2.3 Backup / ponto de retorno

Se o projeto tiver backup gerenciado recente no Supabase, confirmar a existência antes da mudança. Se for necessário um dump manual com CLI, a partir do repositório vinculado:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase migration list
supabase db dump --linked > backup-schema-pre-professional-20260916.sql
supabase db dump --linked --data-only > backup-data-pre-professional-20260916.sql
```

O dump deve ser armazenado fora de repositório público e tratado como dado sensível.

Nunca usar `supabase db reset --linked` neste projeto de produção: o comando é destrutivo.

## 3. Aplicação da migration

### Caminho preferencial quando o histórico de migrations está consistente

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase migration list
supabase db push --dry-run
supabase db push
```

Só executar `db push` se o dry-run listar exatamente migrations que se pretende aplicar. Se migrations antigas executadas manualmente aparecerem como pendentes, interromper e reconciliar o histórico antes de prosseguir.

### Alternativa controlada pelo SQL Editor

Se o projeto continua usando migrations aplicadas manualmente pelo Dashboard, abrir **SQL Editor**, copiar a versão vigente de `20260915_professional_pilot_foundation.sql` e executar somente esse arquivo. Não misturar com cleanup nem com dados do smoke na mesma execução.

Depois, registrar/reconciliar o histórico de migration antes de adotar `db push` em deploys futuros.

## 4. Verificação pós-migration

Executar no SQL Editor após a aplicação.

### 4.1 Tabelas e colunas principais

```sql
select
  to_regclass('public.user_roles') as user_roles,
  to_regclass('public.professional_profiles') as professional_profiles,
  to_regclass('public.professional_patients') as professional_patients,
  to_regclass('public.professional_invitations') as professional_invitations,
  to_regclass('public.professional_relationships') as professional_relationships,
  to_regclass('public.nutrition_prescriptions') as nutrition_prescriptions,
  to_regclass('public.daily_pet_logs') as daily_pet_logs;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'pets' and column_name = 'breed')
    or (table_name = 'weight_entries' and column_name in ('recorded_by', 'source'))
    or (table_name = 'meal_occurrences' and column_name = 'consumption_estimate_ratio')
  )
order by table_name, column_name;
```

Esperado: todos os `to_regclass` não nulos e todas as colunas acima presentes.

### 4.2 RPCs e `SECURITY DEFINER`

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_professional_invitation',
    'get_professional_invitation_preview',
    'accept_professional_invitation',
    'has_active_professional_relationship',
    'get_daily_intake_summary'
  )
order by p.proname;
```

Esperado: as três RPCs de convite e `has_active_professional_relationship` com o modo previsto na migration; `get_daily_intake_summary` permanece invoker.

### 4.3 Grants essenciais

```sql
select
  has_function_privilege('anon', 'public.get_professional_invitation_preview(text)', 'EXECUTE') as anon_preview,
  has_function_privilege('authenticated', 'public.get_professional_invitation_preview(text)', 'EXECUTE') as auth_preview,
  has_function_privilege('anon', 'public.create_professional_invitation(uuid,text,timestamptz)', 'EXECUTE') as anon_create,
  has_function_privilege('authenticated', 'public.create_professional_invitation(uuid,text,timestamptz)', 'EXECUTE') as auth_create,
  has_function_privilege('anon', 'public.accept_professional_invitation(text,uuid)', 'EXECUTE') as anon_accept,
  has_function_privilege('authenticated', 'public.accept_professional_invitation(text,uuid)', 'EXECUTE') as auth_accept;
```

Esperado:

- `anon_preview = true`
- `auth_preview = true`
- `anon_create = false`
- `auth_create = true`
- `anon_accept = false`
- `auth_accept = true`

### 4.4 RLS e policies

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_roles',
    'professional_profiles',
    'professional_patients',
    'professional_invitations',
    'professional_relationships',
    'nutrition_prescriptions',
    'daily_pet_logs',
    'daily_pet_incidents',
    'pets',
    'weight_entries',
    'meal_occurrences'
  )
order by c.relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'professional_patients',
    'professional_invitations',
    'professional_relationships',
    'pets',
    'weight_entries',
    'meal_occurrences'
  )
order by tablename, policyname;
```

Esperado: RLS habilitado nas novas tabelas e políticas legadas de ownership ainda presentes em `pets`, `weight_entries` e `meal_occurrences`, junto das novas políticas profissionais de leitura/inserção estritamente necessárias.

### 4.5 Estrutura do token

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'professional_invitations'
order by ordinal_position;
```

Esperado: existe `token_hash`; não existe coluna de token bruto.

## 5. Contas artificiais do smoke

Preferir duas contas separadas da conta principal existente. Se o provedor de e-mail aceitar plus addressing e entregar os e-mails corretamente, usar o padrão:

- veterinário: `<SEU_EMAIL>+rotinapet-vet-20260916@<DOMINIO>`
- tutor: `<SEU_EMAIL>+rotinapet-tutor-20260916@<DOMINIO>`

Antes do teste, enviar uma mensagem simples para cada alias ou criar as contas e confirmar que ambos os e-mails chegam. Confirmar no Supabase Auth que foram criados dois `user_id` diferentes. Se o provedor não suportar aliases com `+`, usar duas caixas de teste reais.

Dados profissionais recomendados:

- nome: `Profissional de Teste — NÃO REAL`
- CRMV: `TESTE001`
- UF: `SP`
- clínica: `Clínica Teste Rotina Pet — NÃO REAL`

Não usar nome, CRMV, e-mail ou clínica da veterinária real.

## 6. Smoke test ponta a ponta

Registrar para cada cenário: `PASS`, `FAIL`, evidência e observação.

| ID | Cenário | Passos essenciais | Resultado esperado |
|---|---|---|---|
| S1 | Fluxo principal | Ativar perfil vet → paciente preliminar → tutor e peso opcional → gerar convite → abrir anônimo → aceitar → criar/login tutor → voltar → criar pet → concluir | Preview antes do login; retorno com `intent=accept`; pet/vínculo/paciente/peso materializados; tutor entra normalmente |
| S2 | Pet existente / nome igual | Criar antes um pet tutor da mesma espécie e mesmo nome → abrir novo convite | Sugere o pet; não auto-vincula; exige confirmação; nenhum pet duplicado |
| S3 | Pet existente / nome semelhante | Usar variação pequena de nome | Sugestão provável, sempre confirmada pelo tutor |
| S4 | Matching ambíguo | Dois pets da mesma espécie com nomes suficientemente próximos | Escolha manual; nenhuma decisão automática |
| S5 | Progressive disclosure | Pet da mesma espécie sem bom match de nome | Fluxo principal permanece “criar novo”; aparece apenas controle terciário “Este pet já está cadastrado?”; seleção manual funciona |
| S6 | Preview anônimo | Abrir link em janela anônima | Preview mínimo funciona sem sessão; nenhum dado da conta é exposto |
| S7 | E-mail errado | Autenticar com terceira conta controlada | Aceite bloqueado com mensagem amigável; nenhum vínculo/pet/peso criado |
| S8 | Regeneração | Gerar link A; gerar link B para o mesmo paciente | A fica terminal/revogado; B fica pendente e utilizável |
| S9 | Aceito | Reabrir link já aceito | Estado terminal adequado; não cria novo vínculo |
| S10 | Token inválido | Alterar token | Nenhum dado do convite/pet/profissional é revelado |
| S11 | Logout/troca de conta | Iniciar aceite → logout/trocar conta | URL mantém `invite`, `token` e `intent=accept`; fluxo pode continuar após autenticação correta |
| S12 | Refresh/reabertura | Atualizar página durante fluxo autenticado | Estado é reconstruído pela URL; token não depende de storage paralelo |
| S13 | Idempotência | Repetir `accept_professional_invitation` com o mesmo token/usuário após sucesso | Retorna o mesmo caso/pet/relação/peso; contagens não aumentam |
| S14 | Tutor sem pets | Conta tutor nova, zero pets | Convite abre após autenticação e cria o primeiro pet sem cair no onboarding Tutor Solo antes do aceite |
| S15 | Tutor Solo | Abrir conta Tutor Solo existente e navegar Hoje/Animais/Peso/Plano | Fluxos legados continuam funcionais |

## 7. Consultas de confirmação durante o smoke

Substituir apenas pelos e-mails artificiais usados no teste.

```sql
-- IDs das contas de teste
select id, email, email_confirmed_at
from auth.users
where lower(email) in (
  lower('<ALIAS_VET>'),
  lower('<ALIAS_TUTOR>')
);

-- Caso, convite e vínculo
select
  p.id as patient_id,
  p.professional_user_id,
  p.tutor_user_id,
  p.pet_id,
  p.status as patient_status,
  p.initial_weight_kg,
  p.initial_weight_entry_id,
  i.id as invitation_id,
  i.status as invitation_status,
  i.accepted_by,
  r.id as relationship_id,
  r.status as relationship_status
from public.professional_patients p
left join public.professional_invitations i on i.professional_patient_id = p.id
left join public.professional_relationships r on r.professional_patient_id = p.id
where p.professional_user_id = (
  select id from auth.users where lower(email) = lower('<ALIAS_VET>') limit 1
)
order by p.created_at desc, i.created_at desc;

-- Peso inicial materializado
select w.id, w.pet_id, w.recorded_at, w.weight_kg, w.recorded_by, w.source, w.notes
from public.weight_entries w
where w.id in (
  select initial_weight_entry_id
  from public.professional_patients
  where professional_user_id = (
    select id from auth.users where lower(email) = lower('<ALIAS_VET>') limit 1
  )
  and initial_weight_entry_id is not null
);
```

Para idempotência, registrar as contagens de `pets`, `professional_relationships` e `weight_entries` antes e depois da segunda chamada. Elas devem permanecer iguais.

## 8. Cleanup — executar somente depois de encerrar a validação

Usar apenas IDs/e-mails das contas artificiais. Primeiro identificar os IDs; depois apagar dados em ordem controlada.

```sql
-- 1. Conferir exatamente o conjunto de teste antes de apagar.
select id, email from auth.users
where lower(email) in (lower('<ALIAS_VET>'), lower('<ALIAS_TUTOR>'));

-- 2. Em uma transação, remover apenas dados profissionais/artificiais conhecidos.
begin;

-- Relações e convites dos testes.
delete from public.professional_relationships
where professional_user_id = '<VET_USER_ID>'::uuid
   or tutor_user_id = '<TUTOR_USER_ID>'::uuid;

delete from public.professional_invitations
where professional_user_id = '<VET_USER_ID>'::uuid
   or accepted_by = '<TUTOR_USER_ID>'::uuid;

-- Pacientes do profissional de teste. A FK do peso é SET NULL quando necessário.
delete from public.professional_patients
where professional_user_id = '<VET_USER_ID>'::uuid;

-- Remover SOMENTE pets artificiais criados para o smoke.
-- Conferir os UUIDs previamente; não usar delete genérico por tutor se a conta tiver dados que devam ser preservados.
delete from public.pets
where id in (
  '<TEST_PET_ID_1>'::uuid,
  '<TEST_PET_ID_2>'::uuid
);

-- Perfil/papel profissional de teste.
delete from public.professional_profiles where user_id = '<VET_USER_ID>'::uuid;
delete from public.user_roles where user_id = '<VET_USER_ID>'::uuid and role = 'veterinarian';

commit;
```

Depois, em **Authentication → Users**, excluir manualmente os dois usuários Auth artificiais, se não houver razão para preservá-los. Não inserir/delete diretamente em `auth.users` como procedimento normal de cleanup; preferir o Dashboard/Admin API.

## 9. Critério de saída da Etapa 1B

A Etapa 1B pode ser considerada suficientemente sólida para a próxima camada somente quando:

- migration aplicada sem erro;
- verificação de tabelas/colunas/RPCs/grants/RLS passa;
- S1, S2, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14 e S15 passam;
- S3/S4 passam quando os dados de matching forem montados;
- nenhum pet, peso ou vínculo duplicado aparece após retry/idempotência;
- retorno de confirmação de e-mail preserva o convite no GitHub Pages;
- Tutor Solo existente continua funcional.

Depois disso, o próximo passo natural é a tela mínima de **Pacientes** para o piloto e, em seguida, o primeiro fluxo de criação/versionamento de prescrição, antes de construir prontuário completo.

## 10. Fechamento do smoke da v0.8.0 — 2026-09-18

### S13 — Idempotência do mesmo aceite após sucesso

**Resultado: PASS.**

Foi criado um cenário artificial isolado (`S13 Idem`) com pet novo e peso inicial de `12,3 kg` em `2026-09-18`. Após o primeiro aceite, foram registrados IDs, contagens e timestamps do paciente, convite, pet, relacionamento e peso.

A reabertura do link pela interface apresentou corretamente o estado terminal **“Convite já concluído”**, sem novo efeito no banco. Em seguida, a RPC `accept_professional_invitation` foi repetida explicitamente com o mesmo token bruto e o mesmo usuário autenticado.

Resultado do retry:
- retornou os mesmos IDs de convite, paciente, pet, relacionamento e peso inicial;
- pet permaneceu único;
- relacionamento permaneceu único e ativo;
- peso permaneceu único;
- convite permaneceu único e aceito;
- timestamps relevantes permaneceram inalterados.

Classificação do S13:
- integridade/idempotência de dados: **PASS**;
- semântica da RPC: **PASS**;
- UX de reabertura: **PASS**;
- segurança no cenário testado: **PASS**.

O teste não utilizou nem alterou o convite da Nina.

### S11 — diferido para v0.8.1

O cenário **S11 — Logout/troca de conta preservando contexto** permanece deliberadamente adiado até a implementação dos fixes de troca de conta da v0.8.1. O convite da Nina deve permanecer intacto para esse reteste: não aceitar, revogar, regenerar ou alterar antes do S11.

### Critério operacional de encerramento

Embora a seção 9 descreva o critério ideal original incluindo S11, para o ciclo real da v0.8.0 o smoke é considerado **suficientemente fechado para avançar o desenvolvimento da v0.8.1**, porque:
- os fluxos estruturais principais foram exercitados;
- S13 confirmou idempotência sem duplicação ou regravação de estado;
- não houve evidência de vazamento de dados ou corrupção parcial;
- Tutor Solo permaneceu funcional;
- os problemas restantes estão identificados e registrados no backlog da v0.8.1;
- S11 depende justamente dos fixes que serão implementados na Wave 1 e será repetido depois deles.

Este fechamento não reclassifica S11 como PASS; apenas registra que ele não bloqueia o início da v0.8.1.

## 11. Acompanhamento da v0.8.1 — Wave 1

### Blocos 1 e 2 — 2026-09-18

- Bloco 1 concluído em produção e no repositório: RPC `create_professional_invitation` consolidada e migration corretiva registrada.
- Bloco 2 concluído no código-fonte: normalização central de erros Supabase/PostgREST adicionada ao fluxo profissional.
- O frontend ainda depende de push/deploy da mantenedora para validação em ambiente publicado.

### S10 — fix implementado no Bloco 3

**Status:** IMPLEMENTADO NO CÓDIGO; RETESTE PENDENTE APÓS DEPLOY.

Alteração implementada em 2026-09-18:
- `App.tsx` deixa de encaminhar `intent=accept` diretamente para autenticação antes de validar o convite;
- `ProfessionalInvitationPage` consulta primeiro o preview público;
- somente convite válido e pendente pode chegar ao `AuthScreen`;
- token ausente, vazio ou não encontrado exibe apenas o estado neutro **“Convite não encontrado”**;
- o CTA **“Ir para o Rotina Pet”** usa o fluxo de saída que remove `invite`, `token` e `intent` da URL;
- o token bruto continua somente na URL e não é copiado para `localStorage` ou `sessionStorage`.

Reteste pós-deploy:
1. abrir convite válido sem `intent` e confirmar preview público;
2. adicionar `intent=accept` e confirmar que convite válido chega à autenticação somente depois do preview;
3. adulterar o token mantendo `intent=accept` e confirmar que **não** aparece login/cadastro;
4. testar também `invite=professional&intent=accept` sem `token`;
5. confirmar copy **“Convite não encontrado”** sem dados de pet/profissional/clínica;
6. tocar **Ir para o Rotina Pet** e confirmar remoção de `invite`, `token` e `intent` da URL.

Não marcar S10 como PASS até esse reteste ser executado no frontend publicado.



### S7/S11 — fix implementado no Bloco 4

**Status:** IMPLEMENTADO NO CÓDIGO; RETESTE PENDENTE APÓS DEPLOY.

Alteração implementada em 2026-09-18:
- `INVITATION_EMAIL_MISMATCH` é convertido em estado explícito **Este convite foi enviado para outra conta**;
- a UI orienta entrar com o e-mail que recebeu o convite sem revelar o endereço convidado;
- **Entrar com outra conta** executa logout sem limpar o deep link, preservando `invite`, `token` e `intent=accept`;
- o fluxo profissional exibe identidade discreta: conta atual com inicial/e-mail ou **Visitante / não autenticado**;
- `AuthScreen` passa a dizer **Entre com o e-mail que recebeu este convite para continuar** e não afirma aceite antes da RPC autenticada concluir;
- não houve alteração de banco nem uso do convite da Nina.

Reteste S7 pós-deploy:
1. abrir convite pending com uma conta controlada cujo e-mail não corresponde ao convite;
2. tentar autorizar e confirmar título **Este convite foi enviado para outra conta**;
3. confirmar que não há CTA de retry/concluir na mesma conta;
4. confirmar ausência de novo pet, relacionamento, peso e `accepted_at`;
5. tocar **Entrar com outra conta** e confirmar logout com URL intacta.

Reteste S11 pós-deploy, somente depois do S7:
1. usar o convite preservado da Nina;
2. iniciar o aceite com a conta errada até o estado de divergência;
3. tocar **Entrar com outra conta**;
4. confirmar `invite`, `token` e `intent=accept` ainda presentes;
5. autenticar com a conta correta;
6. confirmar retorno ao mesmo convite, identidade da conta correta e continuidade sem duplicações;
7. só então registrar S11 como PASS/FAIL.

Não marcar S7 UX nem S11 como PASS até esses cenários serem executados no frontend publicado.
