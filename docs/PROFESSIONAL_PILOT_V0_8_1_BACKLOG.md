# Rotina Pet — v0.8.1 — Professional Pilot Smoke Fix Backlog


**Criado em:** 2026-09-16  
**Atualizado em:** 2026-09-18  
**Origem:** smoke test da primeira implementação do Professional Pilot — Etapa 1B


> Este documento é a fonte persistente das correções e decisões descobertas durante o smoke test.
> Não depender da memória do chat para implementar a v0.8.1.


---


## 0. Convenção de versão


### Baseline em teste
A versão atualmente publicada e submetida a este smoke deve ser tratada como **v0.8.0**, ainda que o rodapé tenha permanecido incorretamente em `v0.7.7`.


A v0.8.0 introduziu a fundação do modo profissional:
- perfil veterinário;
- paciente preliminar;
- convite seguro;
- preview público;
- autenticação e retorno ao convite;
- matching com pets existentes;
- aceite;
- materialização do pet;
- relacionamento profissional;
- peso inicial profissional.


### Próxima versão
Todos os fixes e refinamentos listados neste documento compõem a **v0.8.1**.


### Fix obrigatório de versionamento
- Atualizar a versão exibida/declarada em todos os pontos relevantes para `v0.8.1` quando este pacote for implementado.
- Evitar versionamento hardcoded divergente em múltiplos pontos, se possível centralizando a fonte da versão.


---




## 0.1. Registro de implementação — Wave 1

Status em **2026-09-18**:

- **Bloco 1 — paridade de banco:** concluído. A definição final de `create_professional_invitation` foi consolidada na migration `20260918161151_sync_professional_invitation_rpc`, aplicada em produção e registrada no repositório; a migration de fundação também foi alinhada para novas instalações.
- **Bloco 2 — normalização central de erros:** concluído no código-fonte. `src/lib/errors.ts` centraliza erros Supabase/PostgREST e os serviços profissionais convertem erros estruturados antes de entregá-los à UI. O deploy do frontend continua sob responsabilidade da mantenedora.
- **Bloco 3 — guarda pública do convite:** concluído no código-fonte. O preview público passa a ser validado antes de qualquer tela de autenticação; convite profissional com token ausente, vazio ou não encontrado termina em estado neutro **“Convite não encontrado”**; o CTA **“Ir para o Rotina Pet”** limpa `invite`, `token` e `intent` da URL. Reteste de S10 pendente após deploy.
- **Bloco 4 — identidade/troca de conta e copy de auth:** concluído no código-fonte. `INVITATION_EMAIL_MISMATCH` recebe estado próprio e CTA **Entrar com outra conta**; logout preserva o deep link do convite; a copy de autenticação não afirma mais aceite inexistente; o fluxo mostra identidade discreta da sessão/visitante. S7 e S11 aguardam reteste após deploy; o convite da Nina não foi alterado.
- **Bloco 5 — novo convite encontrando acompanhamento já ativo:** pendente de decisão/implementação de domínio. Não confundir com S13, que já passou para repetição do mesmo convite aceito.

Regra de documentação: **“implementado” não equivale a “validado em produção”**. O backlog registra a implementação; o runbook/smoke registra PASS somente depois do deploy e do cenário executado.

---
# 1. Convite profissional — preview público


## 1.1. Ritmo visual do cabeçalho
- aumentar levemente o espaço entre eyebrow e título;
- aumentar levemente o espaço entre título e linha de clínica;
- aumentar levemente o espaço entre clínica e divisor;
- aumentar levemente a entrelinha do título;
- permitir que o título use mais da largura útil do card em telas médias/grandes.


## 1.2. Token de título
Criar um token/estilo reutilizável para:
- preview público;
- login no contexto do convite;
- cadastro no contexto do convite;
- matching;
- tela final de sucesso.


## 1.3. Card explicativo
Padronizar os dois parágrafos explicativos:
- mesmo tamanho;
- mesma cor;
- mesma entrelinha;
- negrito apenas quando semanticamente necessário.


## 1.4. Ação “Agora não”
- desktop/tablet: mesma linha do CTA principal;
- mobile: empilhada e centralizada;
- evitar alinhamento solto à esquerda.


---


# 2. Autenticação no contexto do convite


- aplicar os mesmos tokens e ritmo do preview;
- mais respiro entre eyebrow, título, subtítulo e aviso;
- mais espaço entre aviso e formulário;
- mais espaço entre inputs e bloco de ações;
- no cadastro, separar melhor último input, mensagem de confirmação/estado e CTA;
- revisar hierarquia entre “Ainda não tenho conta” e “Esqueci a senha”.


### Já validado no smoke
- signup no contexto do convite;
- confirmação de e-mail;
- retorno ao mesmo convite;
- preservação do intent/contexto;
- conta zero-pets não cai no onboarding depois que o primeiro pet nasce do convite.


---


# 3. Cadastro preliminar de paciente — área profissional


## 3.1. Data do peso
- Pré-popular “Data do peso” com a **data local de hoje** em pacientes novos.
- Campo continua editável.
- Se não houver peso inicial, não criar registro de peso isolado.


## 3.2. Falha parcial paciente → convite
Separar:
1. falha ao salvar paciente;
2. paciente salvo, convite não gerado.


Copy sugerida:


> **Paciente cadastrado, mas não foi possível gerar o convite. Você pode tentar novamente.**


---


# 4. Backend / migrations descobertos no smoke


## 4.1. Correções já aplicadas diretamente no Supabase — concluído em 2026-09-18
As correções abaixo já estão sincronizadas também no repositório:
- corrigir escaping da validação de e-mail em `create_professional_invitation`;
- qualificar explicitamente `expires_at` no `UPDATE professional_invitations`;
- revisar a definição final da RPC depois das correções feitas no smoke.


## 4.2. Sincronização — concluída no Bloco 1
- Supabase de produção e migrations do repositório representam a mesma definição final de `create_professional_invitation`;
- a migration corretiva consolidada `20260918161151_sync_professional_invitation_rpc.sql` está aplicada em produção e registrada no repositório;
- a migration de fundação foi atualizada para novas instalações, sem reaplicação destrutiva em produção.


---


# 5. Deduplicação preventiva no lado profissional


O smoke comprovou que o vet pode criar um segundo paciente preliminar correspondente a um pet que ele já acompanha.


## 5.1. Regra de detecção
Comparar apenas com os `professional_patients` do próprio profissional:
- mesmo e-mail do tutor;
- mesma espécie;
- nome igual ou semelhante;
- raça igual, quando disponível;
- status;
- vínculo ativo tem peso especialmente forte.


Não consultar/expor pets privados do tutor que ainda não façam parte da relação profissional.


## 5.2. Se já houver paciente ativo
Copy sugerida:


> **Você já acompanha uma Mel deste tutor.**  
> Este acompanhamento já está ativo.


Ações:
- **Abrir paciente existente**
- **É outro animal**


## 5.3. Se já houver draft/invited
Copy sugerida:


> **Já existe um cadastro de Mel para este tutor.**  
> Você pode continuar o convite existente em vez de criar outro.


Ações:
- **Ver cadastro existente**
- **Criar outro mesmo assim**


## 5.4. Banco
Não criar `UNIQUE CONSTRAINT` rígida por tutor + nome + espécie.


---


# 6. Aceite repetido / acompanhamento já existente / idempotência


Hoje o banco impede relacionamento ativo duplicado, mas a UI termina em erro genérico.


## 6.1. Comportamento desejado
Se o estado final já existe — mesmo profissional + mesmo pet + relacionamento ativo — a operação deve ser **idempotente**:
- não criar novo relacionamento;
- não duplicar peso;
- não duplicar pet;
- não terminar em erro genérico;
- tratar a operação como sucesso semântico.


Copy possível:


> **Mel já está sendo acompanhada por este profissional.**


CTA:
- **Continuar no Rotina Pet**


Definir a semântica final de invitation/patient duplicados antes da implementação.


---


# 7. Status na área profissional


“Convite enviado” não deve ser estado fixo.


| Estado real | Badge/UI sugerida |
| --- | --- |
| cadastro preliminar sem convite válido | **Sem convite** |
| convite pending e válido | **Aguardando tutor** |
| relacionamento ativo | **Acompanhamento ativo** |
| convite expirado | **Convite expirado** |
| convite revogado/substituído | histórico/fora da lista principal |
| situação excepcional | **Ação necessária** |


Preferir “Aguardando tutor” a “Pendente”.


## 7.1. Estrutura mínima
### Em andamento
- draft;
- aguardando tutor;
- expirados que exigem ação.


### Pacientes
- acompanhamento ativo.


Pacientes aceitos devem sair da lista de preliminares.


## 7.2. “Gerar novo link”
Rever para:
- **Opções do convite**
- **Gerar novo convite** com confirmação quando substituir o anterior.


---


# 8. Matching no lado do tutor


## 8.1. Princípio
Nunca vincular automaticamente. O tutor sempre confirma identidade.


## 8.2. Linguagem da confirmação
Evitar **“Usar Luna”**.


Preferência definida:


> **Sim, é a Luna**


Estado não selecionado:
- outline;
- texto e borda em verde brand.


Estado selecionado:
- preenchido em verde.


## 8.3. Copy “Agora confirme qual perfil…”
Remover/reformular.


### Pet novo
> **Será criado um perfil de Mel na sua conta ao confirmar.**  
> Sua autorização vale somente para **Mel**. A Profissional de Teste — NÃO REAL poderá acompanhar apenas os dados dela relacionados ao tratamento.


### Sugestão antes da decisão
> **Sua autorização vale somente para Mel. Escolha acima se este é o mesmo animal que você já cadastrou no Rotina Pet.**


### Depois da seleção
> **Sua autorização vale somente para Luna.**


---


# 9. Matching em três níveis


## 9.1. Match forte / exato
Mostrar candidato diretamente.


## 9.2. Match provável único
Mostrar candidato diretamente, com linguagem de incerteza.


Exemplo validado:
- convite: Lunna;
- conta: Luna.


## 9.3. Múltiplos candidatos plausíveis — shortlist
Se dois ou mais nomes tiverem similaridade relevante e scores próximos, mostrar automaticamente apenas os plausíveis.


Exemplo:
- convite: Mina;
- pets: Mia, Mila, Luna.


UI:


> **Encontramos mais de uma possibilidade**  
> Algum destes pets é Mina?


Shortlist:
- Mia
- Mila


Ações:
- escolher candidato;
- **Nenhum deles — criar Mina**
- **Ver outros gatos cadastrados**


Não mostrar Luna nessa shortlist se a similaridade for claramente menor.


## 9.4. Nenhum nome plausível, mas existem pets compatíveis
Próximo ao CTA principal:


> **Escolher pet já cadastrado**


Ao tocar, listar os compatíveis da mesma espécie.


## 9.5. Posição
Desktop/tablet:
- mesma linha do CTA principal.


Mobile:
- empilhado;
- secondary acima do CTA principal.


## 9.6. Nenhum pet compatível
Fluxo direto de criação.


---


# 10. CTA e linguagem de consentimento


Evitar “criar/concluir vínculo” na interface.


Padrão definido:


> **Autorizar acompanhamento**


Quando um novo pet será criado:


> **Criar Mina e autorizar acompanhamento**


Quando pet existente já foi escolhido:


> **Autorizar acompanhamento**


“Vínculo/relationship” fica como linguagem interna.


---


# 11. Tela final de sucesso


Copy definida:


> **Luna agora está sendo acompanhada por Profissional de Teste — NÃO REAL.**


- usar nome canônico do tutor;
- aplicar mesmo token de título/ritmo;
- evitar copy dependente de gênero como “foi conectado/conectada”.


---


# 12. Nome canônico após matching


Caso validado:
- vet informou `Lunna`;
- tutor confirmou `Luna`.


## 12.1. Exibição
Depois de `pet_id` existir:
- tutor usa `pets.name`;
- vet também deve passar a exibir `pets.name`.


## 12.2. Histórico
Preservar `professional_patients.pet_name` como snapshot/auditoria, sem usá-lo como nome canônico após o vínculo.


## 12.3. Aviso ao profissional
Exemplo contextual, uma vez:


> **Nome atualizado pelo tutor**  
> Lunna foi vinculada ao perfil **Luna** do tutor. Passaremos a usar o nome cadastrado por ele.


## 12.4. Outros campos
Não estender automaticamente a regra a raça, sexo, nascimento etc. sem regra própria.


---


# 13. Aba Animais do tutor — acompanhamento profissional


Mostrar discretamente quando houver acompanhamento ativo.


Exemplo:


**Luna**  
Gato  
🩺 **Acompanhada por Profissional de Teste**


Para múltiplos profissionais:


> **2 profissionais acompanhando**


Não listar todos no card.


---


# 14. Tutor — visualizar e encerrar acompanhamento


**Obrigatório para v0.8.1.**


## 14.1. Seção no perfil/edição do pet
### Acompanhamento profissional
Mostrar:
- profissional;
- clínica, se houver;
- status **Ativo**;
- ação **Encerrar acompanhamento**.


## 14.2. Confirmação
Explicar que:
- o profissional perde acesso ativo;
- novos dados deixam de ser compartilhados;
- histórico já produzido não é apagado automaticamente.


## 14.3. Banco
Não deletar `professional_relationships`.


Ao encerrar:
- `status = ended`;
- `ended_at`;
- registrar quem encerrou, idealmente `ended_by`.


## 14.4. Profissional também pode encerrar
Pode encerrar acompanhamento, mas não apagar a relação histórica.


## 14.5. Arquivar pet ≠ revogar acesso
Tratar como conceitos diferentes.


## 14.6. Smoke da v0.8.1
1. vínculo ativo;
2. tutor encerra;
3. profissional perde acesso;
4. histórico permanece;
5. novo convite posterior consegue criar novo acompanhamento.


---


# 15. Processo / preflight / deploy


- confirmar que GitHub Pages corresponde ao código sob teste;
- confirmar push/deploy antes do smoke;
- registrar versão publicada;
- usar este arquivo como fonte de verdade durante o restante do smoke.


---


# 16. Cenários já validados na v0.8.0


- [x] Conta profissional nova sem pet acessa área profissional.
- [x] Perfil profissional é materializado.
- [x] Paciente preliminar é criado.
- [x] Preview público mostra somente dados mínimos.
- [x] Tutor novo cria conta a partir do convite.
- [x] Confirmação de e-mail retorna ao convite.
- [x] Tutor zero-pets aceita e primeiro pet é materializado.
- [x] Peso inicial profissional é materializado uma vez no happy path.
- [x] Match exato exige confirmação.
- [x] Match provável `Lunna → Luna` é identificado.
- [x] Match provável vincula ao pet existente sem duplicata.
- [x] Espécie atua como filtro.
- [x] Ausência de match forte não escolhe pet arbitrariamente.
- [x] Seleção manual de compatíveis fica disponível sob demanda.
- [x] Backend impede relacionamento ativo duplicado.
- [x] Tentativa duplicada falha atomicamente sem corromper dados.


---


# 17. Estado consolidado do smoke da v0.8.0


## 17.0. Cenários concluídos / estado atual


- [x] **S1 — Fluxo principal:** PASS.
- [x] **S2 — Pet existente / nome igual:** PASS.
- [x] **S3 — Pet existente / nome semelhante:** PASS; caso `Lunna → Luna` validado.
- [x] **S4 — Matching ambíguo:** PASS; caso `Mina` com múltiplos candidatos plausíveis validado sem seleção automática indevida.
- [x] **S5 — Progressive disclosure:** PASS funcional; seleção manual de pet compatível disponível e rejeição dos candidatos com criação de novo pet validada.
- [x] **S6 — Preview anônimo:** PASS de segurança/funcional.
- [x] **S7 — Conta/e-mail errado:** PASS funcional/segurança + FAIL de UX; correção registrada para v0.8.1.
- [x] **S8 — Regeneração/invalidação:** PASS funcional + PASS de segurança.
- [x] **S9 — Convite já aceito:** PASS funcional + PASS de segurança; reabertura não duplicou pet, relacionamento ou peso.
- [x] **S10 — Token inválido:** PASS de segurança + FAIL funcional de roteamento/UX; correção registrada para v0.8.1.
- [x] **S12 — Refresh/reabertura:** PASS funcional; observação de UX sobre identidade da sessão registrada para v0.8.1.
- [x] **S13 — Idempotência do mesmo aceite após sucesso:** PASS funcional, de integridade, semântica da RPC e segurança no cenário testado; repetição com o mesmo token/usuário retornou os mesmos IDs, sem duplicações ou regravação de timestamps.
- [x] **S14 — Tutor sem pets:** PASS no fluxo principal; primeiro pet materializado pelo convite sem cair no onboarding Tutor Solo.
- [x] **S15 — Regressão Tutor Solo:** PASS. Testadas as áreas Hoje, Animais, Peso e Plano, além da navegação entre elas; tudo funcional, sem regressão estrutural observada.


Também já validados no smoke:
- [x] rejeitar candidatos sugeridos e criar novo pet;
- [x] seleção manual de candidato quando não houve match automático;
- [x] ausência de duplicação indevida nos fluxos já exercitados;
- [x] integridade atômica em tentativas inválidas.


## 17.0.1. Pendências efetivas do smoke da v0.8.0


Resta apenas o cenário abaixo sem fechamento completo:


- [ ] **S11 — Logout/troca de conta preservando contexto.**
  - O comportamento de preservação da URL já foi parcialmente observado em S7/S12.
  - O fluxo completo de trocar da conta errada para a conta correta deve ser repetido depois dos fixes da v0.8.1.
  - **Não consumir, aceitar, revogar, regenerar ou alterar o convite da Nina antes disso.**
  - S11 está deliberadamente adiado; não bloqueia o início da implementação da v0.8.1.


### Leitura do estado do smoke


A fundação v0.8.0 está funcional nos fluxos principais e não apresentou regressão estrutural no Tutor Solo. S13 confirmou a idempotência do mesmo aceite após sucesso. Os FAILs encontrados são de UX/roteamento e de semântica de estados já registrados para v0.8.1; não houve evidência de vazamento de dados ou corrupção parcial nos cenários exercitados. Com S11 deliberadamente adiado para reteste após os fixes da v0.8.1, o smoke da v0.8.0 é considerado suficientemente fechado para avançar o desenvolvimento.


---


## 17.1. S7 — conta errada / e-mail errado


**Resultado:** PASS funcional/segurança + FAIL de UX.


Cenário validado:
- convite para `Nina` / gato / Tutor 01;
- link aberto com Tutor 02 autenticado;
- Tutor 02 rejeitou a sugestão existente e tentou criar Nina;
- backend bloqueou o aceite por e-mail divergente;
- nenhum pet, relacionamento, peso ou aceite parcial foi criado;
- convite permaneceu `pending`, `accepted_at = null`, `accepted_by = null`;
- paciente permaneceu `invited`, sem `pet_id` e sem `tutor_user_id`.


### Falha de UX observada
A UI exibiu o fallback genérico:


> “Não foi possível concluir o vínculo agora. Sua escolha foi preservada; tente novamente.”


Isso é inadequado porque retry na mesma conta nunca resolverá a causa.


### Comportamento esperado para v0.8.1


Título:


> **Este convite foi enviado para outra conta**


Texto:


> Para autorizar o acompanhamento de Nina, entre com o e-mail que recebeu este convite.


CTA:


> **Entrar com outra conta**


Ao trocar de conta:
- fazer logout;
- preservar `invite`, `token` e `intent=accept` na URL;
- voltar ao login;
- autenticar com a conta correta;
- retornar ao mesmo convite;
- continuar sem duplicações.


### Causa técnica provável identificada no código atual
`acceptProfessionalInvitation()` relança diretamente o erro retornado por `supabase.rpc`. Já `inviteError()` extrai a mensagem com `error instanceof Error ? error.message : String(error)`. Como erros do PostgREST/Supabase podem ser objetos estruturados que não são instâncias nativas de `Error`, o valor pode virar `"[object Object]"`, impedindo a detecção de `INVITATION_EMAIL_MISMATCH` e levando ao fallback genérico.


Fix recomendado:
- criar normalização central de erro Supabase/RPC que leia `message`, `details`, `hint`, `code` quando presentes;
- mapear explicitamente `INVITATION_EMAIL_MISMATCH` para o estado de troca de conta;
- manter o fallback genérico apenas para falhas realmente desconhecidas;
- cobrir com teste unitário/integrado do mapper de erro.


Classificação:
- **bug funcional:** não;
- **bug de segurança:** não;
- **problema de UX:** sim, bloqueador para v0.8.1;
- **hardening técnico:** sim, normalização de erros RPC.


## 17.2. S12 — refresh/reabertura preservando contexto


Resultado: **PASS funcional**.


Validado no smoke:
- antes e depois do reload, a URL preservou `invite=professional`, `token=...` e `intent=accept`;
- após o reload, o app voltou diretamente ao fluxo de identificação da Nina;
- a sugestão/seleção de pet foi reconstruída;
- não houve evidência de dependência de `localStorage`/`sessionStorage` paralelo para restaurar o convite.


### Observação de UX — identidade da sessão
Durante o fluxo de autorização, não fica claro qual conta está autenticada. Isso ficou especialmente evidente no cenário de conta errada e continua relevante após refresh.


Decisão para v0.8.1:
- adicionar um indicador discreto de identidade no contexto do convite/autorização;
- quando autenticado: avatar circular com iniciais (foto no futuro, se houver), identificação da conta e e-mail;
- quando não autenticado: estado explícito **Visitante / não autenticado**;
- oferecer ação de troca de conta de forma acessível, sem competir com o CTA principal;
- manter o componente visual leve, preferencialmente em uma barra superior/identity chip do fluxo profissional, sem transformar isso agora em redesign global do Tutor Solo.


Racional:
- reduz risco de consentimento pela conta errada;
- torna o estado de sessão observável durante um fluxo sensível;
- ajuda testes e suporte;
- custo de implementação é baixo/moderado se restrito ao contexto do convite.


Classificação:
- **bug funcional:** não;
- **bug de segurança:** não, pois o backend já bloqueia a conta errada;
- **problema de UX:** sim;
- **melhoria de segurança percebida/clareza de consentimento:** sim.




## 17.5. S13 — idempotência do mesmo aceite após sucesso


**Resultado:** PASS funcional + PASS de integridade + PASS de semântica da RPC + PASS de segurança no cenário testado.


Cenário artificial isolado validado em 2026-09-18:
- paciente `S13 Idem`;
- pet novo criado no primeiro aceite;
- peso inicial de `12,3 kg` em `2026-09-18`;
- convite aceito pela conta tutor artificial correta;
- raw token preservado apenas durante a sessão de smoke para permitir o retry controlado;
- Nina não foi utilizada nem alterada.


### Baseline após o primeiro aceite
- 1 pet `S13 Idem` para o tutor;
- 1 relacionamento profissional, ativo;
- 1 registro de peso;
- 1 `initial_weight_entry_id`;
- 1 convite para o paciente;
- 1 convite aceito.


Também foram registrados os IDs e timestamps de paciente, pet, convite, relacionamento e peso.


### Reabertura pela interface
Ao reabrir o link já aceito, o frontend apresentou o estado terminal **“Convite já concluído”** e não tentou materializar um novo aceite. A leitura posterior do banco confirmou ausência de efeitos colaterais.


### Retry explícito da RPC
Foi repetida `accept_professional_invitation` com:
- o mesmo token bruto;
- o mesmo usuário autenticado;
- o mesmo convite/paciente;
- `p_existing_pet_id = null`, como no aceite que criou o pet.


A RPC retornou exatamente os mesmos IDs de `invitation`, `professional_patient`, `pet`, `professional_relationship` e `initial_weight_entry`.


Após o retry:
- contagem de pets permaneceu 1;
- contagem de relacionamentos profissional+tutor+pet permaneceu 1;
- relacionamentos ativos permaneceram 1;
- pesos do pet permaneceram 1;
- registro de peso inicial permaneceu 1;
- convites do paciente permaneceram 1;
- convites aceitos permaneceram 1;
- `professional_patient.updated_at`, `invitation.accepted_at`, `relationship.started_at`, `relationship.created_at`, `pet.created_at` e `weight_entry.created_at` permaneceram inalterados.


### Conclusão
A implementação instalada em produção é semanticamente idempotente para **o mesmo convite já aceito pelo mesmo tutor**. A repetição retorna o estado já materializado e não duplica pet, vínculo ou peso.


Importante: este PASS não encerra o item da seção 6 sobre **novo convite/paciente que encontra um acompanhamento ativo já existente**. Esse é um caso semanticamente diferente e continua no backlog da v0.8.1.


Classificação:
- **integridade de dados:** PASS;
- **semântica da RPC:** PASS;
- **UX de reabertura:** PASS;
- **segurança no cenário testado:** PASS;
- **novo bug estrutural encontrado:** não.


---


## 17.4. S15 — regressão Tutor Solo


**Resultado:** PASS funcional; sem regressão estrutural observada.


Validado em conta Tutor Solo existente:
- tela **Hoje** carregando normalmente;
- aba **Animais** funcional;
- histórico/fluxo de **Peso** funcional;
- **Plano** carregando e navegável;
- alternância entre as áreas sem onboarding inesperado, redirecionamento para convite ou estado profissional indevido;
- nenhuma regressão estrutural percebida nos fluxos legados durante o teste.


Classificação:
- **bug funcional:** não;
- **bug de segurança:** não;
- **regressão Tutor Solo:** não observada;
- **novo item para v0.8.1 decorrente deste cenário:** nenhum.


## 17.3. Auth do convite — copy afirma aceite inexistente


Achado durante a preparação do S10: ao abrir um link de convite válido em uma nova aba e cair na autenticação, a tela exibiu:


> **Você já aceitou o convite. Ele fica preservado enquanto identificamos sua conta.**


O código atual de `AuthScreen.tsx` mostra essa nota sempre que `context === "professional-invite"`; ela não consulta nem deriva o status real do convite. Portanto, `intent=accept` (intenção de continuar o fluxo) está sendo descrito como se fosse aceite já materializado no backend.


Resultado da análise:
- **bug funcional:** não;
- **bug de segurança:** não;
- **problema de UX/semântica de estado:** sim;
- não há evidência, por este achado, de que o convite tenha sido aceito no banco.


### Copy definida para v0.8.1


Subtítulo de login no contexto do convite:


> **Entre com o e-mail que recebeu este convite para continuar.**


Nota contextual:


> **O convite não vai se perder. Entre com a conta que o recebeu e você continua de onde parou.**


Para cadastro, manter a mesma linguagem humana e evitar “concluir vínculo”. A mensagem deve explicar apenas que a conta precisa usar o e-mail que recebeu o convite e que, após a confirmação, o fluxo continua de onde parou.


Princípio de linguagem:
- não usar `aceitou` antes de o backend confirmar o aceite;
- evitar termos internos como `vínculo`, `intent`, `preservado` e `estado`;
- falar em **convite**, **conta**, **continuar** e **acompanhamento**.




---


# 18. Checklist de implementação da v0.8.1


## Críticos funcionais
- [x] Migration corretiva das RPCs no repositório.
- [ ] Idempotência para acompanhamento já ativo.
- [ ] Deduplicação preventiva no cadastro profissional.
- [ ] Status real de convite/acompanhamento.
- [ ] Separar preliminares de pacientes ativos.
- [ ] Tutor visualiza acompanhamento profissional.
- [ ] Tutor pode encerrar acompanhamento.
- [ ] Histórico do relacionamento é preservado.
- [ ] Nome canônico do tutor é exibido ao vet após matching.


## Matching / consentimento
- [ ] `Sim, é a {pet}` em vez de `Usar {pet}`.
- [ ] Matching em três níveis.
- [ ] `Escolher pet já cadastrado` junto ao CTA quando aplicável.
- [ ] CTA `Autorizar acompanhamento`.
- [ ] CTA `Criar {pet} e autorizar acompanhamento`.
- [ ] Remover/reformular “Agora confirme qual perfil...”.
- [ ] Success copy com nome canônico e profissional.


## UI / visual
- [ ] Token reutilizável de título.
- [ ] Mais espaçamento vertical no cabeçalho.
- [ ] Mais entrelinha nos títulos.
- [ ] Título mais largo em telas médias/grandes.
- [ ] Padronizar textos do preview.
- [ ] `Agora não` integrado ao bloco de ações.
- [ ] Mais espaço inputs → CTA em auth.
- [x] Corrigir copy da autenticação do convite: nunca afirmar aceite antes da confirmação do backend.
- [x] Remover “concluir vínculo” do auth do convite e usar linguagem humana orientada a continuar o convite.
- [ ] Secondary/outline com texto/borda verde brand quando apropriado.
- [ ] Ritmo consistente até sucesso.
- [x] Indicador discreto de identidade da sessão no fluxo de convite: autenticado = avatar/iniciais + e-mail; anônimo = Visitante / não autenticado; acesso claro à troca de conta.


## Cadastro profissional
- [ ] Data do peso = hoje.
- [ ] Mensagem correta para paciente salvo + convite falhou.


## Versão / processo
- [x] Guarda pública do convite antes da autenticação implementada; reteste S10 pendente após deploy.
- [x] Normalização central de erros RPC/Supabase no fluxo profissional.
- [ ] Atualizar para `v0.8.1`.
- [ ] Centralizar versão se viável.
- [ ] Preflight confirma deploy correto.
- [ ] Atualizar runbook com achados do smoke.


---


# 19. Fora do escopo imediato


Continuam fora deste pacote, salvo decisão posterior:
- tela completa de Pacientes;
- prontuário completo;
- prescription builder completo;
- passwordless;
- redesign geral do Tutor Solo;
- automações clínicas não relacionadas aos fixes acima.


A v0.8.1 deve corrigir e tornar coerente a fundação profissional já introduzida, sem transformar esta rodada em uma nova etapa de produto.


## 2.y. Token inválido — saída segura para o produto


### Achado do smoke — S10
Classificação: **PASS de segurança + FAIL funcional de roteamento/UX**.


Com token adulterado e `invite=professional&intent=accept` preservados, nenhum dado do convite foi revelado. Porém, o app abriu a autenticação antes de validar a existência do convite.


Comportamento obrigatório na v0.8.1:
- validar o preview público antes de encaminhar para autenticação;
- token inválido deve terminar em estado neutro, sem login/cadastro e sem revelar pet, profissional, clínica, e-mail, IDs ou qualquer dado do convite;
- copy sugerida:


> **Convite não encontrado**  
> Este link pode estar incompleto ou não ser mais válido.


- oferecer um único CTA de saída: **Ir para o Rotina Pet**;
- o CTA deve levar à home normal do app e remover da URL `invite`, `token` e `intent`;
- não oferecer nesse estado “Entrar”, “Criar conta” ou “Tentar novamente”.


Decisão de wording: preferir **Ir para o Rotina Pet** a “Voltar ao Rotina Pet”, pois o visitante pode ter chegado diretamente pelo convite e nunca ter navegado pelo app antes.

## 20. Wave 1 — Bloco 4 implementado em 2026-09-18

**Status:** IMPLEMENTADO NO CÓDIGO; S7 E S11 AGUARDAM RETESTE APÓS DEPLOY.

Alterações:
- erro `INVITATION_EMAIL_MISMATCH` deixa de competir com o CTA normal de aceite e passa a um estado próprio: **Este convite foi enviado para outra conta**;
- a explicação usa o nome do pet, mas não revela o e-mail de destino do convite;
- CTA principal do estado divergente: **Entrar com outra conta**;
- a troca de conta usa o logout normal e não limpa `invite`, `token` nem `intent=accept`, portanto o contexto continua na URL;
- durante o fluxo pendente, a UI torna a identidade observável: conta autenticada mostra inicial + e-mail; visitante mostra **Visitante / não autenticado**;
- após a intenção de aceite, a conta autenticada também recebe ação discreta **Trocar conta** antes de uma tentativa inválida;
- `AuthScreen` no contexto do convite não afirma mais que o convite já foi aceito e evita “concluir vínculo”;
- nenhuma migration ou alteração de dados foi necessária;
- o convite preservado da Nina não foi acessado, aceito, revogado, regenerado ou alterado durante a implementação.

Retestes obrigatórios após deploy:
1. repetir S7 com conta controlada errada e confirmar o estado específico, sem efeitos parciais no banco;
2. confirmar que **Entrar com outra conta** faz logout e mantém `invite`, `token` e `intent=accept`;
3. autenticar com a conta correta e confirmar reconstrução do mesmo convite;
4. executar então S11 com o convite preservado da Nina;
5. confirmar que a identidade exibida acompanha corretamente visitante → conta errada → visitante → conta correta.
