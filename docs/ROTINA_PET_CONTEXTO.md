# ROTINA_PET_CONTEXTO.md


> Contexto operacional do projeto.


Versão do documento: 1.8


## Objetivo
Registrar o estado atual do Rotina Pet para continuidade entre conversas.


## Estado atual
- Arquitetura: React + Vite (PWA), Supabase e OneSignal.
- Versão corrente do código: **v0.8.1**.
- `package.json` é a fonte canônica da versão exibida; `App.tsx` deriva o rodapé dessa versão.
- Tutor Solo permanece funcional e é o núcleo estável da rotina.
- A fundação **Professional Pilot — Veterinário + Tutor** está aplicada de forma aditiva.
- Wave 1:
  - Bloco 1 — paridade banco/repositório: concluído;
  - Bloco 2 — normalização de erros Supabase/PostgREST: concluído e validado;
  - Bloco 3 — guarda pública do convite: concluído; S10 PASS;
  - Bloco 4 — identidade/troca de conta: concluído; S7 e S11 PASS;
  - Bloco 4.5 — versionamento centralizado em `package.json`: implementado; validação visual pós-deploy pendente;
  - Bloco 5 — novo patient/convite encontrando acompanhamento já ativo: implementado no frontend e no Supabase; backend transacional PASS; S16 no frontend publicado pendente.
- No Bloco 5, o patient ativo e íntegro permanece canônico; o patient redundante fica `closed/duplicate` com referência ao canônico; o convite fica `resolved`; relationship, pet e peso não são duplicados.
- O convite bruto continua somente na URL controlada; o banco persiste `token_hash`.
- O frontend protege o preview público antes da autenticação e permite troca de conta preservando o deep link do convite.
- As migrations profissionais relevantes da Wave 1 incluem:
  - `20260915_professional_pilot_foundation.sql`;
  - `20260918161151_sync_professional_invitation_rpc.sql`;
  - `20260918191528_resolve_duplicate_professional_patient.sql`;
  - `20260918192021_fix_professional_invitation_retry_relationship_lookup.sql`.
- A faixa de horários prioriza a próxima refeição e possui suporte à roda do mouse no desktop.
- O card Hoje usa toda a largura interna no desktop, mantendo os botões de horário compactos.
- O registro de refeições atualiza a tela Hoje sem carregamento global e preserva a posição visual do grupo de horário.
- Um botão flutuante discreto permite voltar ao topo após rolagens longas.
- O opt-in do OneSignal exibe uma notificação de boas-vindas personalizada com o tom de voz da marca.
- A Product Foundation mantém a nutrição como vertical inicial e registra como hipótese futura a expansão para adesão a outros cuidados do pet.


## Validação pendente imediata
1. Publicar o frontend v0.8.1.
2. Confirmar visualmente o rodapé em **v0.8.1**.
3. Executar S16 no frontend publicado usando cenário artificial/controlado.
4. Executar regressões S7, S9, S10, S11, S13 e S15 após o deploy.


## Próximas frentes do Professional Pilot
1. Deduplicação preventiva no cadastro profissional, sem depender dela para integridade.
2. Evolução da tela **Pacientes**.
3. Criador/versionamento de prescrição nutricional.
4. Vínculo prescrição → rotina do tutor.
5. Hardening de autorização/imutabilidade dos agregados clínicos antes de ampliar o piloto.


## Outras pendências
- Validar troca de planos.
- Validar edição de horários.
- Decidir se o card de animais arquivados deve ficar oculto quando vazio ou virar seção recolhível.
- AbortController no envio ao OneSignal.
- `executionTimeMs` na Edge Function.
- Validar com tutores e profissionais a hipótese de expansão para saúde preventiva, consultas, exames e medicamentos antes de alterar o posicionamento público ou comprometer novo roadmap.


## Limitações atuais
- Alimentos arquivados permanecem no banco, mas não podem ser restaurados pela interface.
- O Professional Pilot ainda não inclui tela completa de Pacientes, prontuário completo, criador completo de prescrição nem monitoramento clínico completo.


Consulte `DECISOES_ARQUITETURAIS.md` para regras permanentes.
Consulte `ROTINA_PET_CHANGELOG.md` para histórico de versões.
Consulte `PROFESSIONAL_PILOT_STAGE1.md`, `PROFESSIONAL_PILOT_STAGE1_SMOKE_TEST.md` e `PROFESSIONAL_PILOT_V0_8_1_BACKLOG.md` para o piloto profissional.