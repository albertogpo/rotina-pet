# Rotina Pet v0.7.6

## Objetivo

Eliminar o “piscar” e o retorno ao topo da tela **Hoje** ao concluir uma refeição, preservando o contexto visual do tutor durante registros sucessivos.

## Diagnóstico

O registro chamava novamente o carregamento completo das refeições. Enquanto os dados eram buscados, a tela **Hoje** era substituída pelo estado global de carregamento. Isso desmontava os grupos de horário e fazia o navegador perder a posição de rolagem.

Mesmo sem o carregamento global, o recolhimento do card expandido altera a altura do conteúdo acima do ponto observado. Sem compensação, o grupo poderia se deslocar na tela logo após a ação.

## Solução

### Atualização sem recarregar

- a ocorrência é atualizada localmente após a confirmação do servidor;
- a lista completa é reconciliada em seguida por uma busca silenciosa;
- o estado global de carregamento continua reservado para abertura da tela, troca de data e outros fluxos que realmente substituem o conteúdo;
- erros continuam sendo exibidos e propagados para o fluxo de registro.

### Preservação do horário

Antes de recolher o card, a interface mede a posição do grupo de horário. Após a atualização do layout, compensa apenas a diferença gerada pelo fechamento, mantendo o grupo aproximadamente no mesmo ponto da janela.

Esse comportamento vale para:

- **Comeu tudo**;
- consumo parcial;
- **Não foi servida**;
- desfazer ou alterar um registro.

### Voltar ao topo

Foi adicionado um botão flutuante discreto que:

- aparece somente depois de uma rolagem longa;
- usa rolagem suave, exceto quando o sistema solicita movimento reduzido;
- fica acima da navegação inferior no celular;
- respeita as áreas seguras do aparelho.

## Comportamentos preservados

- deep link por data e horário;
- abertura e destaque temporário do grupo indicado por notificação;
- auto-scroll horizontal da faixa de horários para a próxima pendência;
- fechamento automático do card após o registro;
- carregamento completo ao trocar de data ou abrir conteúdo ainda não carregado.

## Arquivos

### Modificados

- `src/App.tsx`;
- `src/components/TodayPage.tsx`;
- `src/styles.css`;
- `package.json`;
- `package-lock.json`;
- `README.md`;
- `docs/00_PRODUCT_FOUNDATION.md`;
- `docs/ROTINA_PET_CHANGELOG.md`;
- `docs/ROTINA_PET_CONTEXTO.md`.

### Criado

- `docs/01_RELEASE_v0.7.6.md`.

## Pacote

- versão atualizada para `0.7.6`;
- rodapé atualizado para `v0.7.6`;
- arquivos JSON mantidos em UTF-8 sem BOM.

## Banco e backend

- nenhuma migration SQL;
- nenhuma alteração na Edge Function;
- nenhuma alteração no Cron;
- nenhuma alteração nas regras de agrupamento ou entrega das notificações.

## Validação realizada

- `package.json` e `package-lock.json` analisados como JSON válido;
- versão `0.7.6` conferida nos dois arquivos e no rodapé;
- alterações de interface e documentação conferidas no código-fonte;
- arquivos salvos em UTF-8 sem BOM.

## Validação recomendada após o deploy

1. Rolar a tela Hoje até um horário distante do topo.
2. Registrar **Comeu tudo** e confirmar que não surge spinner nem salto de página.
3. Repetir com consumo parcial, **Não foi servida** e desfazer registro.
4. Confirmar que o grupo permanece visualmente no mesmo ponto após o card recolher.
5. Testar grupos com uma e com várias refeições no mesmo horário.
6. Confirmar que o botão de voltar ao topo aparece apenas após rolagem longa.
7. No iPhone/PWA, verificar se o botão não cobre a navegação inferior nem ações dos cards.
8. Ativar redução de movimento no sistema e confirmar rolagem sem animação.
9. Abrir uma notificação de refeição e confirmar que deep link, destaque e abertura do grupo continuam funcionando.
10. Executar o workflow e confirmar build e deploy.
