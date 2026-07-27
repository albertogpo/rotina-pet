# Rotina Pet v0.7.4

## Objetivo

Restaurar a rolagem vertical da página no desktop sem alterar o auto-scroll da próxima refeição ou a navegação horizontal dos horários.

## Diagnóstico

A v0.7.3 adicionou `overflow-y:auto` simultaneamente a `html` e `body`. No Chrome desktop, isso criou dois candidatos a contêiner de scroll. A página possuía conteúdo maior que a viewport, mas a roda do mouse não alterava `window.scrollY`.

A comparação com a revisão anterior do CSS confirmou que essa regra foi introduzida junto aos ajustes da v0.7.3.

## Correção

- `html` é o único contêiner de scroll vertical;
- `body` e `#root` usam overflow visível;
- o bloqueio horizontal permanece no elemento raiz;
- o scroll horizontal da faixa **Horários do dia** foi preservado;
- o auto-scroll da próxima refeição não foi alterado.

## Validação

Um teste em Chromium com conteúdo maior que a viewport reproduziu o erro: após uma roda de 600 px, `window.scrollY` permanecia em `0`. Com a correção, o mesmo teste resultou em `window.scrollY = 600`.

## Pacote

- versão atualizada para `0.7.4`;
- `package-lock.json` salvo sem BOM;
- URLs `resolved` normalizadas para o registro público do npm.

## Banco e backend

- Nenhuma migration SQL.
- Nenhuma alteração na Edge Function, no Cron ou no Supabase.

## Validação recomendada

1. Abrir a tela Hoje no desktop com conteúdo suficiente para ultrapassar a viewport.
2. Usar a roda do mouse fora da faixa de horários e confirmar o scroll vertical.
3. Usar a roda sobre a faixa de horários e confirmar o deslocamento horizontal.
4. Chegar ao início/fim da faixa e confirmar que a página volta a rolar verticalmente.
5. Confirmar que a próxima refeição continua sendo posicionada automaticamente.
6. Executar o workflow e confirmar build e deploy.
