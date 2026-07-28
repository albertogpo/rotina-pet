# ROTINA_PET_CONTEXTO.md


> Contexto operacional do projeto.


Versão do documento: 1.5


## Objetivo
Registrar o estado atual do Rotina Pet para continuidade entre conversas.


## Estado atual
- Arquitetura: React + Vite (PWA), Supabase e OneSignal.
- Notificações estabilizadas.
- Última release gerada: v0.7.5.
- Última release com build confirmado: v0.7.3; publicação final deve ser confirmada.
- A faixa de horários prioriza a próxima refeição e possui suporte à roda do mouse no desktop.
- O card Hoje usa toda a largura interna no desktop, mantendo os botões de horário compactos.
- O opt-in do OneSignal exibe uma notificação de boas-vindas personalizada com o tom de voz da marca.
- O documento usa somente `html` como contêiner de scroll vertical; `body` e `#root` mantêm overflow visível.
- O cabeçalho fica acima do degradê da barra de status.
- O workflow da v0.7.3 normaliza no runner as URLs internas do lockfile para o registro público e usa instalação determinística com `npm ci`.
- O `package.json` da v0.7.3 foi corrigido para UTF-8 sem BOM; o workflow também valida e normaliza o encoding dos JSONs.


## Pendências
1. Validar troca de planos.
2. Validar edição de horários.
3. Executar o workflow da v0.7.5 e confirmar build/deploy.
4. Validar a v0.7.5 no desktop, conferindo a largura do card Hoje e a compactação dos horários.
5. Validar a notificação de boas-vindas em uma assinatura realmente nova do navegador/dispositivo.
6. Decidir se o card de animais arquivados deve ficar oculto quando estiver vazio ou virar uma seção recolhível.
7. AbortController no envio ao OneSignal.
8. executionTimeMs na Edge Function.


## Limitações atuais
- Alimentos arquivados permanecem no banco, mas não podem ser restaurados pela interface.


Consulte DECISOES_ARQUITETURAIS.md para regras permanentes.
Consulte ROTINA_PET_CHANGELOG.md para histórico de versões.