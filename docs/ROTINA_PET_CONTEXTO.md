# ROTINA_PET_CONTEXTO.md


> Contexto operacional do projeto.


Versão do documento: 1.3


## Objetivo
Registrar o estado atual do Rotina Pet para continuidade entre conversas.


## Estado atual
- Arquitetura: React + Vite (PWA), Supabase e OneSignal.
- Notificações estabilizadas.
- Última release gerada: v0.7.3.
- Última release publicada: confirmar após a sincronização/deploy do repositório.
- A faixa de horários prioriza a próxima refeição e possui suporte à roda do mouse no desktop.
- O cabeçalho fica acima do degradê da barra de status.


## Pendências
1. Validar troca de planos.
2. Validar edição de horários.
3. Validar a v0.7.3 em iOS e desktop.
4. Decidir se o card de animais arquivados deve ficar oculto quando estiver vazio ou virar uma seção recolhível.
5. AbortController no envio ao OneSignal.
6. executionTimeMs na Edge Function.


## Limitações atuais
- Alimentos arquivados permanecem no banco, mas não podem ser restaurados pela interface.


Consulte DECISOES_ARQUITETURAIS.md para regras permanentes.
Consulte ROTINA_PET_CHANGELOG.md para histórico de versões.