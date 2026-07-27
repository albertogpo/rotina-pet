# Rotina Pet v0.7.3


## Objetivo


Corrigir o acabamento do cabeçalho em aparelhos com safe area e restaurar a navegação horizontal da faixa de horários no desktop.


## Atualizações


### Barra de status e cabeçalho


- O degradê foi encurtado e deslocado para cima.
- A interface completa passa a ficar em uma camada acima do degradê.
- O logo, o seletor de tema e o avatar deixam de ser atravessados pela transição visual.
- O espaço entre o seletor de tema e o avatar foi ampliado.


### Scroll no desktop


- A roda vertical do mouse desloca horizontalmente a faixa **Horários do dia** quando o cursor está sobre ela.
- No início ou no fim da faixa, o evento não é bloqueado e a página continua rolando verticalmente.
- A barra de rolagem horizontal passa a aparecer discretamente apenas no desktop.
- O auto-scroll da próxima refeição permanece ativo.


### Arquivamento de alimentos


- Nenhuma funcionalidade nova foi adicionada.
- Alimentos arquivados continuam preservados no banco com `active=false`.
- A interface atual carrega apenas alimentos ativos e ainda não oferece restauração.


## Banco e backend


- Nenhuma migration SQL.
- Nenhuma alteração na Edge Function ou no Cron.


## Validação recomendada


1. Abrir a PWA em um iPhone com notch/Dynamic Island e verificar que o degradê não cruza o logo nem o avatar.
2. Confirmar o novo espaço entre o seletor de tema e o avatar.
3. No desktop, usar a roda do mouse sobre a faixa de horários.
4. Confirmar que a página continua rolando ao atingir as extremidades da faixa.
5. Confirmar que a próxima refeição ainda é posicionada automaticamente.