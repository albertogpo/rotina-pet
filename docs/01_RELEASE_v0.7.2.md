# Rotina Pet v0.7.2

## Objetivo

Dar prioridade à próxima refeição na tela Hoje, reduzir novamente o cabeçalho mobile, melhorar o seletor de fuso e aplicar corretamente os novos ícones da PWA.

## Atualizações

### Tela Hoje

- A faixa horizontal de horários posiciona automaticamente o primeiro grupo que ainda contém uma refeição pendente na borda esquerda.
- Horários totalmente registrados ficam fora da área visível à esquerda, mas continuam acessíveis por gesto horizontal.
- Pendências atrasadas têm prioridade e a faixa avança quando o grupo atual é concluído.
- O comportamento ocorre apenas na data de hoje; datas históricas preservam a posição manual.
- A funcionalidade originalmente planejada como v0.7.1 foi incorporada nesta release.

### Cabeçalho

- Redução da altura visual no mobile.
- Logo, seletor de tema, avatar e espaçamento superior ficaram mais compactos.
- A safe area do iOS continua preservada.
- A camada de fundo da barra de status termina na própria safe area e não avança mais sobre o conteúdo.

### Fuso horário

- Botão × para limpar o campo de busca.
- Ação permanente **Usar fuso do aparelho**, desabilitada quando o fuso detectado já está selecionado.

### Ícones da PWA

- Os assets permanecem nos nomes estáveis já adotados pelo projeto.
- O logo do cabeçalho também referencia `icons/icon-192.png`; a referência antiga `icon-192-v072.png` causava a imagem quebrada observada na interface.
- A tentativa de usar nomes `*-v072.png` foi descartada antes da publicação por criar duplicação sem resolver de forma confiável o cache do iOS.
- Em instalações existentes no iOS, pode ser necessário remover o app da Tela de Início e adicioná-lo novamente pelo Safari para trocar o ícone.

## Banco e backend

- Nenhuma migration SQL.
- Nenhuma alteração na Edge Function ou no Cron.

## Validação recomendada

1. Testar a faixa de horários com grupos concluídos, atrasados e futuros.
2. Confirmar o avanço automático após concluir a última pendência do grupo atual.
3. Confirmar que datas históricas não sofrem auto-scroll.
4. Testar limpeza, busca, seleção e salvamento do fuso.
5. Remover e reinstalar a PWA no iOS para validar o novo ícone.
