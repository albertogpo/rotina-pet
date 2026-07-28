# Rotina Pet v0.7.5

## Objetivo

Corrigir o aproveitamento horizontal do card **Hoje** no desktop e personalizar a notificação automática exibida pelo OneSignal após a primeira assinatura do usuário.

## Card Hoje no desktop

### Diagnóstico

O card ocupava toda a largura da página, mas seu grid interno permanecia limitado à largura do conteúdo. A causa era a combinação entre uma regra compartilhada anterior — com alinhamento próprio de componentes flex — e a posterior conversão de `.today-overview` para grid sem redefinir explicitamente o dimensionamento da coluna.

### Correção

- o grid do card passa a usar uma coluna `minmax(0, 1fr)`;
- `align-items` e `justify-content` são redefinidos para `stretch`;
- resumo, navegador de data, divisórias e faixa de horários utilizam toda a largura interna;
- os botões de horário continuam com largura baseada no conteúdo e não são artificialmente esticados;
- o scroll horizontal permanece disponível quando a quantidade de horários excede o espaço útil.

## Notificação de boas-vindas

A integração usa configuração por código personalizado. A opção `welcomeNotification` foi adicionada ao `OneSignal.init`.

Conteúdo:

- **Título:** Rotina Pet
- **Mensagem:** Tudo certo: as notificações estão ativas. Enviaremos lembretes nos horários das refeições.

A mensagem confirma o opt-in de forma calma, clara e funcional. Ela é enviada pelo OneSignal apenas no fluxo de primeira assinatura aplicável ao navegador/dispositivo.

## Arquivos

### Modificados

- `src/App.tsx`;
- `src/lib/push.ts`;
- `src/styles.css`;
- `package.json`;
- `package-lock.json`;
- `README.md`;
- `docs/00_PRODUCT_FOUNDATION.md`;
- `docs/ROTINA_PET_CHANGELOG.md`;
- `docs/ROTINA_PET_CONTEXTO.md`.

### Criado

- `docs/01_RELEASE_v0.7.5.md`.

## Pacote

- versão atualizada para `0.7.5`;
- rodapé atualizado para `v0.7.5`;
- arquivos JSON mantidos em UTF-8 sem BOM.

## Banco e backend

- nenhuma migration SQL;
- nenhuma alteração na Edge Function;
- nenhuma alteração no Cron ou nas regras de agrupamento das notificações de refeição.

## Validação realizada

- arquivos JSON analisados com sucesso;
- sintaxe dos arquivos TypeScript/TSX modificados validada por transpilação local;
- presença da nova configuração do OneSignal e das regras de layout conferida no código-fonte.

## Validação recomendada após o deploy

1. Abrir a tela Hoje no desktop e confirmar que as divisórias e o navegador de data atravessam toda a largura útil do card.
2. Confirmar que o percentual permanece à direita e o texto à esquerda.
3. Confirmar que os botões de horário continuam compactos, sem ocupar larguras exageradas.
4. Testar um dia com muitos horários e confirmar o scroll horizontal.
5. Realizar uma assinatura realmente nova em navegador ou perfil limpo e conferir a notificação de boas-vindas.
6. Confirmar que notificações de refeição continuam sendo enviadas normalmente.
7. Executar o workflow e confirmar build e deploy.
