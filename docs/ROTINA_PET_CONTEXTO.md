# ROTINA_PET_CONTEXTO.md


> Contexto operacional do projeto.


Versão do documento: 1.7


## Objetivo
Registrar o estado atual do Rotina Pet para continuidade entre conversas.


## Estado atual
- Arquitetura: React + Vite (PWA), Supabase e OneSignal.
- Notificações estabilizadas.
- A Product Foundation registra a hipótese de evolução para uma plataforma de adesão aos cuidados do pet, mantendo a nutrição como vertical inicial; nenhuma nova categoria foi aprovada para implementação.
- Última release gerada: v0.7.6.
- Última release com build confirmado: v0.7.3; publicação final deve ser confirmada.
- A faixa de horários prioriza a próxima refeição e possui suporte à roda do mouse no desktop.
- O card Hoje usa toda a largura interna no desktop, mantendo os botões de horário compactos.
- O registro de refeições atualiza a tela Hoje sem carregamento global e preserva a posição visual do grupo de horário.
- Um botão flutuante discreto permite voltar ao topo após rolagens longas.
- O opt-in do OneSignal exibe uma notificação de boas-vindas personalizada com o tom de voz da marca.
- O documento usa somente `html` como contêiner de scroll vertical; `body` e `#root` mantêm overflow visível.
- O cabeçalho fica acima do degradê da barra de status.
- O workflow da v0.7.3 normaliza no runner as URLs internas do lockfile para o registro público e usa instalação determinística com `npm ci`.
- O `package.json` da v0.7.3 foi corrigido para UTF-8 sem BOM; o workflow também valida e normaliza o encoding dos JSONs.


## Pendências
1. Validar troca de planos.
2. Validar edição de horários.
3. Executar o workflow da v0.7.6 e confirmar build/deploy.
4. Validar a v0.7.6 no celular e no desktop, registrando, alterando e desfazendo refeições em diferentes posições da tela.
5. Confirmar que o grupo do horário não salta após o fechamento do card e que o botão de voltar ao topo não cobre ações ou a navegação inferior.
6. Validar a largura do card Hoje no desktop e a notificação de boas-vindas em uma assinatura realmente nova do navegador/dispositivo.
7. Decidir se o card de animais arquivados deve ficar oculto quando estiver vazio ou virar uma seção recolhível.
8. AbortController no envio ao OneSignal.
9. executionTimeMs na Edge Function.
10. Validar com tutores e profissionais a hipótese de expansão para saúde preventiva, consultas, exames e medicamentos antes de alterar o posicionamento público ou comprometer um novo roadmap.


## Limitações atuais
- Alimentos arquivados permanecem no banco, mas não podem ser restaurados pela interface.


Consulte DECISOES_ARQUITETURAIS.md para regras permanentes.
Consulte ROTINA_PET_CHANGELOG.md para histórico de versões.