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


### Correção do build e deploy


- A primeira tentativa de publicação da v0.7.3 falhou durante a instalação das dependências.
- O `package-lock.json` continha URLs de um registro npm interno do ambiente de geração, inacessível ao runner do GitHub.
- O workflow agora normaliza as URLs do lockfile para `https://registry.npmjs.org/` no runner antes da instalação.
- A instalação passou a usar somente `npm ci`; o fallback automático para pnpm foi removido porque mascarava a causa real e tornava a instalação menos determinística.
- O lockfile também foi validado localmente com todas as 413 dependências resolvidas pelo registro público; a normalização definitiva do arquivo-fonte fica pendente para uma regeneração fora do ambiente interno.
- A segunda tentativa chegou ao Vite, mas falhou porque `package.json` começava com BOM UTF-8; o `vite-plugin-pwa` usa `JSON.parse` e rejeitou o caractere invisível antes de `{`.
- O `package.json` foi salvo novamente sem BOM, e o workflow agora remove BOM e valida os dois arquivos JSON antes do `npm ci`.


## Banco e backend


- Nenhuma migration SQL.
- Nenhuma alteração na Edge Function ou no Cron.


## Validação recomendada


1. Abrir a PWA em um iPhone com notch/Dynamic Island e verificar que o degradê não cruza o logo nem o avatar.
2. Confirmar o novo espaço entre o seletor de tema e o avatar.
3. No desktop, usar a roda do mouse sobre a faixa de horários.
4. Confirmar que a página continua rolando ao atingir as extremidades da faixa.
5. Confirmar que a próxima refeição ainda é posicionada automaticamente.
6. Executar novamente o workflow e confirmar que `npm ci`, build e deploy terminam com sucesso.