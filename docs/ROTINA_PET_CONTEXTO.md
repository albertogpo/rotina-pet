# ROTINA_PET_CONTEXTO.md


> Contexto operacional do projeto.


Versão do documento: 1.3


## Objetivo
Registrar o estado atual do Rotina Pet para continuidade entre conversas.


## Estado atual
- Arquitetura: React + Vite (PWA), Supabase e OneSignal.
- Notificações estabilizadas.
- Última release gerada: v0.7.3.
- Última release publicada: v0.7.2; duas tentativas de publicar a v0.7.3 falharam no build.
- A faixa de horários prioriza a próxima refeição e possui suporte à roda do mouse no desktop.
- O cabeçalho fica acima do degradê da barra de status.
- O workflow da v0.7.3 normaliza no runner as URLs internas do lockfile para o registro público e usa instalação determinística com `npm ci`.
- O `package.json` da v0.7.3 foi corrigido para UTF-8 sem BOM; o workflow também valida e normaliza o encoding dos JSONs.


## Pendências
1. Validar troca de planos.
2. Validar edição de horários.
3. Executar novamente o workflow da v0.7.3 e confirmar build/deploy.
4. Validar a v0.7.3 em iOS e desktop.
5. Decidir se o card de animais arquivados deve ficar oculto quando estiver vazio ou virar uma seção recolhível.
6. AbortController no envio ao OneSignal.
7. Regenerar o `package-lock.json` em ambiente público para remover definitivamente as URLs internas do arquivo-fonte.
8. executionTimeMs na Edge Function.


## Limitações atuais
- Alimentos arquivados permanecem no banco, mas não podem ser restaurados pela interface.


Consulte DECISOES_ARQUITETURAIS.md para regras permanentes.
Consulte ROTINA_PET_CHANGELOG.md para histórico de versões.