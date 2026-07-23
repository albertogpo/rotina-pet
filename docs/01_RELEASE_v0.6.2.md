# Rotina Pet v0.6.2 — correção de planos e horários

## Problemas corrigidos

1. Ao substituir um plano, refeições pendentes do plano anterior podiam continuar aparecendo na tela Hoje.
2. A edição dos horários era bloqueada quando já existia alguma refeição registrada na data escolhida.
3. Erros retornados pelo Supabase podiam aparecer apenas como uma mensagem genérica na interface.

## Comportamento após a correção

- refeições pendentes são reconciliadas com o plano vigente;
- refeições concluídas ou marcadas como não servidas permanecem no histórico;
- editar os horários não altera alimentos, quantidades ou divisão das porções;
- a mensagem real do banco é exibida quando a atualização falha;
- ao desfazer um registro pertencente a uma versão antiga do plano, a ocorrência antiga é removida e a refeição válida do plano vigente volta a ser gerada.

## Aplicação no Supabase

Execute no SQL Editor, uma única vez, o conteúdo de:

`supabase/migrations/20260723_fix_plan_occurrence_reconciliation.sql`

A migração também remove ocorrências pendentes inválidas que tenham sido criadas por versões anteriores.

## Publicação do front-end

Depois de aplicar a migração, publique a versão normalmente pelo fluxo do GitHub Pages.

## Testes de aceitação

### Substituição de plano

1. Tenha um plano com refeições na tela Hoje.
2. Registre uma das refeições como concluída ou não servida.
3. Crie uma nova versão do plano com início hoje.
4. Confirme que a refeição registrada permanece.
5. Confirme que as pendentes do plano antigo somem.
6. Confirme que aparecem apenas as refeições pendentes válidas do novo plano.

### Edição de horários

1. Abra o plano atual e escolha **Editar horários**.
2. Altere um ou mais horários com início hoje.
3. Salve.
4. Confirme que refeições já registradas continuam no histórico.
5. Confirme que as pendentes aparecem nos novos horários.
6. Confirme que alimentos e quantidades não mudaram.
