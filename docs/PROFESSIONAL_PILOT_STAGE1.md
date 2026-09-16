# Rotina Pet — Professional Pilot — Etapa 1

## Objetivo

Criar a fundação técnica do modo profissional sem quebrar a experiência Tutor Solo atual.

Princípio estrutural:

- **prescrição nutricional profissional** é uma entidade clínica;
- **rotina** continua sendo a forma como o tutor executa a prescrição;
- `diet_plans`, `meal_templates`, `meal_components` e `meal_occurrences` permanecem como núcleo da rotina atual;
- novas tabelas profissionais são aditivas e se conectam ao núcleo existente por vínculos explícitos.

## Regra do consolidado de ingestão

A ingestão estimada diária deve ser exibida mesmo quando existem refeições sem registro.

Exemplo:

- prescrito: 40 g/dia;
- registrado: uma refeição de 20 g como `full`;
- outra refeição de 20 g sem registro.

Resultado exibido:

- **≈50% do total diário prescrito**;
- **≈20 g de 40 g**;
- aviso: **1 refeição sem registro**.

O percentual continua tendo como denominador o total diário prescrito. Refeições sem registro não são assumidas como zero: apenas não acrescentam ingestão ao numerador e tornam o dia incompleto.

### Mapeamento inicial

| Estado | Estimativa | Interpretação |
| --- | ---: | --- |
| Comeu tudo | 100% | ingerido |
| Quase tudo | 80% | faixa conceitual 70–90% |
| Metade | 50% | faixa conceitual 40–60% |
| Pouco | 20% | faixa conceitual 10–30% |
| Nada | 0% | alimento oferecido e recusado |
| Não foi servida | 0% | alimento não oferecido |
| Sem registro | desconhecido | não inferir ingestão |

`Nada` e `Não foi servida` têm o mesmo efeito quantitativo (0%), mas permanecem semanticamente diferentes.

## Entidades novas

### `user_roles`
Permite que a mesma conta tenha um ou mais papéis (`tutor`, `veterinarian`).

### `professional_profiles`
Perfil profissional do veterinário: nome de exibição, CRMV, UF, títulos, clínica, contato e futura identidade do PDF.

### `professional_patients`
Caso/paciente no contexto profissional. Pode existir antes de o tutor aceitar o convite.

Campos principais:
- profissional;
- `pet_id` opcional até o vínculo com um pet real;
- `tutor_user_id` opcional;
- e-mail do tutor opcional para convite;
- nome, espécie e raça do animal durante o estado preliminar;
- status do caso.

Quando o tutor aceita, o registro é ligado a um `pets.id` real. Depois disso, `pets` é a fonte principal dos dados compartilhados do animal.

### `professional_relationships`
Vínculo aceito entre profissional, tutor e pet.

### `professional_invitations`
Convites com token, e-mail e status, separados do vínculo ativo.

### `nutrition_prescriptions`
Tratamento nutricional profissional lógico de um paciente.

### `nutrition_prescription_versions`
Versões imutáveis da prescrição. Alterações clínicas relevantes criam nova versão.

Campos incluem:
- início de vigência;
- revisão sugerida;
- objetivo;
- meta calórica diária opcional;
- autoria;
- nota da alteração.

### `nutrition_prescription_options`
Alternativas autorizadas dentro da mesma versão (ex.: 70/30, 80/20, 90/10).

A rotina usa uma opção ativa por vez.

### `nutrition_prescription_option_items`
Alimentos e quantidades de cada opção. Suporta:
- quantidade diária;
- unidade;
- participação calórica opcional;
- kcal/dia derivada/opcional;
- instrução específica.

### `nutrition_prescription_sections`
Blocos livres de orientação, por exemplo “Recomendações para perda de peso” e “Manejo hídrico”.

### `routine_prescription_bindings`
Relaciona uma rotina (`diet_plans`) à versão/opção profissional que a originou.

### `daily_pet_logs`
Nota livre por pet/data.

### `incident_types` e `daily_pet_incidents`
Catálogo estruturado de incidentes e ocorrências diárias.

## Alterações aditivas em tabelas existentes

### `pets`
Adicionar campos opcionais úteis ao fluxo profissional:
- `breed`.

### `weight_entries`
Adicionar:
- `recorded_by` — usuário que efetivamente informou/registrou o peso;
- `source` — `tutor`, `veterinarian`, `import`.

Ao cadastrar um paciente, o peso é opcional. Se informado e o pet já estiver vinculado, deve gerar um `weight_entries` normal. Se o paciente ainda estiver aguardando aceite do tutor, o valor fica como peso inicial do caso e é materializado no histórico quando o pet for vinculado.

### `meal_occurrences`
Adicionar:
- `consumption_estimate_ratio numeric(4,3)`;

O valor deve ser persistido no momento do registro para que mudanças futuras na escala não alterem retrospectivamente os consolidados históricos.

Backfill inicial:
- `full` = 1.000;
- `almost` = 0.800;
- `half` = 0.500;
- `little` = 0.200;
- `none` = 0.000;
- `skipped` = 0.000;
- `pending` = NULL.

## Compatibilidade

1. Nenhuma tabela atual é removida ou renomeada.
2. `pets.user_id` continua representando o proprietário da conta para a versão legada.
3. Tutor Solo continua criando `diet_plans` exatamente como hoje.
4. Planos profissionais não alteram diretamente registros históricos.
5. A aplicação v0.7.7 pode ignorar completamente as novas tabelas.
6. RLS existente dos tutores continua válida, com políticas adicionais somente onde o profissional precisa de acesso.

## Regra de autorização profissional

O veterinário só pode acessar dados de um pet quando existir:
- `professional_relationships.status = 'active'`, ou
- um `professional_patients` criado por ele ainda em fluxo de convite, limitado aos dados daquele caso.

O profissional não ganha acesso geral à conta do tutor.

## Próximo passo técnico

Aplicar a migration de fundação e, em seguida, implementar os serviços TypeScript para:
1. papéis/perfil profissional;
2. pacientes e convites;
3. criação/versionamento de prescrição;
4. vínculo prescrição → rotina.


## Decisão de UX — convite antes da autenticação

No fluxo do tutor, o convite deve ser apresentado antes de exigir login ou criação de conta. A sequência da Etapa 1 é:

1. abrir o link e consultar apenas o preview seguro do convite pelo token;
2. mostrar profissional, clínica (quando houver) e dados mínimos do pet;
3. tutor toca em **Aceitar convite**;
4. somente então o app solicita autenticação/criação de conta;
5. após autenticar, o app resolve possível pet existente e pede confirmação do perfil a vincular;
6. o aceite materializado no banco continua sendo feito exclusivamente pela RPC autenticada `accept_professional_invitation`.

A intenção de aceite pode ser preservada no próprio deep link (`intent=accept`) para sobreviver ao retorno de confirmação de e-mail. O token bruto não deve ser persistido separadamente em `localStorage` ou `sessionStorage`.

O RPC de preview pode ser executado por `anon` e `authenticated`, mas deve retornar somente os campos mínimos já previstos para o convite. Nenhuma leitura de pets, vínculos, rotina ou outros dados da conta fica disponível sem autenticação.

### Backlog de autenticação

- **Passwordless / OTP ou magic link para convites profissionais**: avaliar após o piloto inicial para reduzir ainda mais a fricção de adoção. Não faz parte da implementação corrente da Etapa 1B; o fluxo atual continua usando e-mail + senha.

## Hardening pré-migration — 2026-09-16

Antes da primeira aplicação da migration da Etapa 1B, a revisão final consolidou estes ajustes:

- as RPCs de criação e aceite de convite continuam exclusivas de `authenticated`; o preview continua disponível a `anon` e `authenticated`; os grants são zerados explicitamente para `PUBLIC`, `anon` e `authenticated` antes de regrantar somente o mínimo necessário;
- as RPCs que usam `pgcrypto` incluem `extensions` no `search_path`, compatível com a instalação padrão de extensões no Supabase;
- o e-mail convidado é normalizado e validado também no servidor, não apenas pelo `<input type="email">` do frontend;
- `accept_professional_invitation` e `create_professional_invitation` usam a mesma ordem de locks (`professional_patient` → `professional_invitation`) para evitar deadlock na corrida rara entre regeneração e aceite;
- o token bruto continua existindo apenas no link/retorno da criação do convite; o banco persiste somente `token_hash`;
- `intent=accept` continua sendo persistido exclusivamente na URL. Não há cópia do token em `localStorage` ou `sessionStorage`;
- o retorno de confirmação de e-mail depende de o Supabase manter a URL publicada na allowlist e de o template de confirmação respeitar `RedirectTo`/`ConfirmationURL`. Isso deve ser validado no smoke test de produção.

### Limite de confiança do piloto

Na Etapa 1B, a ativação do papel `veterinarian` é self-service: uma conta autenticada pode habilitar sua própria área profissional. Isso é deliberado para o piloto controlado e **não equivale a verificação de identidade/CRMV**. Antes de abertura ampla do produto profissional, deve existir uma decisão explícita sobre aprovação ou verificação de profissionais.

### Itens que não bloqueiam o smoke test 1B

As tabelas de prescrição já fazem parte da fundação, mas o criador completo de prescrição ainda não existe. Antes dessa camada ser liberada, revisar especificamente a regra de imutabilidade das versões publicadas e a autorização de leitura dos dados de rotina usados pelo consolidado profissional.

### Runbook de validação

A aplicação, verificação pós-migration, smoke test ponta a ponta e cleanup da Etapa 1B estão documentados em [`PROFESSIONAL_PILOT_STAGE1_SMOKE_TEST.md`](./PROFESSIONAL_PILOT_STAGE1_SMOKE_TEST.md).
