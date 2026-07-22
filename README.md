# Rotina Pet

O **Rotina Pet** é um aplicativo web instalável (PWA) para organizar a alimentação e acompanhar o peso dos animais.

Ele nasceu para resolver uma necessidade prática: saber, em um único lugar, **o que cada pet precisa comer, em qual horário, em que quantidade e o que realmente aconteceu em cada refeição**.

> **Estado do projeto:** versão de testes `v0.5.2`.

## Aplicativo publicado

**https://albertogpo.github.io/rotina-pet/**

## O que esta versão já entrega

- cadastro, edição, arquivamento e restauração de animais;
- cadastro de alimentos;
- criação de alimentos sem sair do fluxo de criação do plano;
- planos com horários manuais ou distribuídos por janela diária;
- múltiplos alimentos por refeição;
- divisão automática da quantidade diária entre as refeições escolhidas;
- tela **Hoje** com refeições de todos os animais agrupadas por horário;
- filtro por animal na tela Hoje;
- cartões compactos em acordeão;
- ações de refeição com foco em linguagem natural:
  - **Comeu tudo**;
  - **Não comeu tudo**;
  - **Não foi servida**;
- detalhamento do consumo parcial:
  - Quase tudo;
  - Metade;
  - Pouco;
  - Nada;
- histórico por data dentro da própria tela Hoje, incluindo dias anteriores;
- registro e histórico de peso;
- autenticação com Supabase;
- PWA instalável;
- deploy automático no GitHub Pages.


## Correção da v0.5.2

- restaura as guardas de autenticação antes de acessar `session.user`, corrigindo o erro de build TypeScript da v0.5.1;
- mantém integralmente as funcionalidades planejadas para a v0.5.1.

## Destaques da v0.5.1

- botão **Editar horários** no card do plano atual;
- editor dedicado apenas à rotina de horários, sem exigir recadastrar alimentos ou quantidades;
- preservação automática da composição diária, unidades e divisão das porções;
- escolha da data a partir da qual os novos horários passam a valer;
- proteção do histórico: se já houver refeições registradas na data escolhida, o app pede uma data posterior;
- a quantidade de refeições permanece fixa nessa edição rápida. Para mudar também o número de refeições, alimentos ou porções, continua existindo a criação de uma nova versão completa do plano.

A alteração rápida de horários cria uma nova versão da rotina quando necessário, mas isso acontece por trás da interface. Para o tutor, o fluxo é apenas: abrir o plano atual, tocar em **Editar horários**, ajustar e salvar.

### Atualização do Supabase para a v0.5.1

Execute no SQL Editor:

- [`supabase/migrations/20260722_update_plan_schedule.sql`](supabase/migrations/20260722_update_plan_schedule.sql)

Essa migration cria a função `update_diet_plan_schedule`, responsável por preservar alimentos, quantidades e histórico ao trocar somente os horários.

## Destaques da v0.5.0

### Produto e interface

- navegação por **datas** na tela Hoje, permitindo ver refeições e registros de dias anteriores;
- bloco de navegação do dia com botão para voltar rapidamente para hoje;
- ajustes no card de refeição:
  - **Comeu tudo** como ação principal em largura total no mobile;
  - **Não comeu tudo** e **Não foi servida** em meia largura na linha de baixo;
  - layout automático em linha única quando houver espaço;
- texto de orientação da refeição pendente agora fica **solto no card**, sem caixa extra;
- espaço seguro no topo da tela para não colidir com a barra de status do iPhone;
- tratamento melhor para falhas transitórias de carregamento, com **retry manual** e tentativa automática ao voltar para o app.

### Notificações

A `v0.5.0` prepara a migração de lembretes locais para **notificações push** reais.

Esta versão inclui:

- integração cliente com **OneSignal** (condicional, ativada quando configurada);
- service workers dedicados ao OneSignal;
- Edge Function do Supabase para envio de lembretes de refeições;
- migration para log de notificações já enviadas;
- arquivo SQL auxiliar para agendar o disparo periódico via cron.

> **Importante:** o envio automático em segundo plano só funcionará depois da configuração do OneSignal e da publicação da Edge Function no Supabase.

## Atualizações obrigatórias do banco

Se você já tinha uma instalação anterior, execute também estas migrations no **SQL Editor** do Supabase:

- [`supabase/migrations/20260721_add_meal_consumption.sql`](supabase/migrations/20260721_add_meal_consumption.sql)
- [`supabase/migrations/20260722_add_meal_notification_log.sql`](supabase/migrations/20260722_add_meal_notification_log.sql)
- [`supabase/migrations/20260722_update_plan_schedule.sql`](supabase/migrations/20260722_update_plan_schedule.sql)

Para uma instalação do zero, o arquivo [`supabase/setup.sql`](supabase/setup.sql) continua sendo a referência principal, mas revise as migrations mais recentes para manter o ambiente alinhado com a versão do app.

## Configuração opcional de push notifications

Além das variáveis do Supabase, a integração de push espera um **App ID do OneSignal** no frontend publicado.

Use no ambiente do GitHub Pages (ou local, se desejar testar):

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
VITE_ONESIGNAL_APP_ID=SEU_APP_ID_ONESIGNAL
```

No Supabase, publique a Edge Function `send-meal-notifications` e configure os secrets:

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `APP_PUBLIC_URL` (use `https://albertogpo.github.io/rotina-pet/`)

Depois disso, ajuste o cron usando o arquivo:

- [`supabase/enable-meal-push-cron.sql`](supabase/enable-meal-push-cron.sql)

## Limitações conhecidas

- a parte de push está **preparada**, mas depende da configuração do OneSignal e do cron para envio automático real;
- a experiência inicial sem login ainda não foi implementada;
- o produto profissional para veterinários continua em definição e documentação.

## Tecnologias

- React
- TypeScript
- Vite
- Supabase
- Vite PWA
- GitHub Actions
- GitHub Pages
- OneSignal (integração opcional para push)

## Executar localmente

Requisitos: Node.js 22 ou versão compatível.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha o `.env.local` com suas variáveis do Supabase. Se quiser preparar os testes de push, acrescente também o `VITE_ONESIGNAL_APP_ID`.

Antes do primeiro uso, execute [`supabase/setup.sql`](supabase/setup.sql) no SQL Editor do Supabase.

## Compilar

```bash
npm run build
```

## Publicação no GitHub Pages

O workflow está em [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

No repositório do GitHub:

1. cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em **Settings → Secrets and variables → Actions → Variables**;
2. se for usar push, cadastre também `VITE_ONESIGNAL_APP_ID`;
3. em **Settings → Pages**, selecione **GitHub Actions** como fonte;
4. envie as alterações para a branch `main`.

Cada commit na `main` inicia automaticamente um novo build e deploy.

## Configuração de autenticação no Supabase

Em **Authentication → URL Configuration**, use:

```text
Site URL:
https://albertogpo.github.io/rotina-pet/

Redirect URLs:
https://albertogpo.github.io/rotina-pet/
https://albertogpo.github.io/rotina-pet/**
```

## Base do produto

A visão de produto consolidada está em [`docs/00_PRODUCT_FOUNDATION.md`](docs/00_PRODUCT_FOUNDATION.md).

## Licença

Consulte o arquivo [`LICENSE`](LICENSE).
