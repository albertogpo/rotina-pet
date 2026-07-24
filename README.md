# Rotina Pet

O **Rotina Pet** é um aplicativo web instalável (PWA) para organizar a alimentação e acompanhar o peso dos animais.

Ele nasceu para resolver uma necessidade prática: saber, em um único lugar, **o que cada pet precisa comer, em qual horário, em que quantidade e o que realmente aconteceu em cada refeição**.

> **Estado do projeto:** versão de testes `v0.6.5`.

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
- ações de refeição:
  - **Comeu tudo**;
  - **Não comeu tudo**;
  - **Não foi servida**;
- detalhamento do consumo parcial:
  - Quase tudo;
  - Metade;
  - Pouco;
  - Nada;
- histórico por data dentro da tela Hoje;
- registro e histórico de peso;
- autenticação com Supabase;
- PWA instalável;
- notificações push automáticas via OneSignal + Supabase Cron;
- deploy automático no GitHub Pages.


## Ajustes da v0.6.5

- A interface passa a usar a família tipográfica **Manrope**, com pesos mais leves nos textos pequenos.
- Foram adicionados dois temas visuais de marca: **Clínica Serena** e **Editorial Acolhedora**.
- O seletor de tema fica na barra superior, ao lado do avatar do usuário.
- A escolha é persistida localmente no dispositivo e restaurada antes da primeira renderização, reduzindo mudanças visuais durante a abertura.
- O tema também atualiza a `theme-color` da PWA.
- A implementação usa tokens CSS compartilhados; não há alteração no banco ou nas rotinas de alimentação.

## Ajustes da v0.6.1

- O push só considera ocorrências com status `pending` e faz uma segunda validação imediatamente antes do envio, evitando notificações quando a refeição foi registrada durante a execução do Cron.
- Refeições futuras continuam podendo ser registradas livremente. Antes da confirmação, o aplicativo exibe um alert sheet informando o horário programado e quanto tempo falta.
- Botões de ação em Web Push não foram ativados nesta versão porque o Safari Web Push, usado pela PWA no iPhone, não os suporta de forma consistente.

## Destaques da v0.6.0

### Notificações agrupadas

Refeições do mesmo tutor no mesmo horário passam a gerar **uma única notificação**, mesmo quando há vários animais.

Exemplos:

```text
Hora da refeição — 🐈 Luna
80 g de ração • ½ sachê de patê • 5 ml de suplemento
```

```text
Refeição — 🐈 Luna e 🐶 Thor
🐈 Luna: 80 g de ração + 2 itens • 🐶 Thor: 120 g de ração
```

Quando o texto completo não cabe, a mensagem preserva:

1. o nome e o emoji dos animais;
2. o primeiro ou os primeiros itens;
3. a indicação de quantos itens adicionais existem.

### Proteção contra duplicidades

A v0.6.0 adiciona duas camadas de proteção:

- reserva atômica do grupo no Supabase;
- `idempotency_key` estável na chamada ao OneSignal.

Assim, duas execuções próximas do cron não devem enviar o mesmo grupo duas vezes, e uma repetição após timeout pode reutilizar a mesma operação sem criar outra mensagem.

### Deep link para a tela Hoje

Ao tocar na notificação, o aplicativo recebe:

```text
?view=today&date=AAAA-MM-DD&time=HH:MM
```

O frontend então:

- abre a tela Hoje;
- seleciona a data correta;
- mostra todos os animais;
- rola até o horário;
- abre a primeira refeição pendente;
- destaca temporariamente o grupo.

### Fuso horário da rotina

A rotina agora possui um fuso horário próprio, salvo na conta.

- o navegador detecta o fuso no primeiro acesso;
- o usuário pode conferir e alterar o fuso em **Configurações**;
- os horários são convertidos no Supabase, e não mais pelo relógio local do navegador;
- viajar com o celular não altera silenciosamente os horários do plano;
- ocorrências pendentes do dia atual e dos próximos dias são recalculadas ao trocar o fuso.

### Geração server-side das refeições

As ocorrências do dia não dependem mais de a tela Hoje ter sido aberta.

A Edge Function garante as ocorrências necessárias antes de procurar refeições vencendo. Isso permite que a notificação funcione mesmo quando o PWA permanece fechado durante o dia.

### Prazo de entrega

O push usa TTL padrão de **30 minutos**. Depois disso, a mensagem pode ser descartada pelo serviço de push, mas a refeição continua aparecendo como pendente ou atrasada dentro do aplicativo.

O intervalo pode ser alterado por secret da Edge Function:

```text
MEAL_NOTIFICATION_TTL_SECONDS
```

O valor padrão é `1800`.

## Atualização obrigatória do Supabase

Para atualizar uma instalação anterior, execute no **SQL Editor**:

- [`supabase/migrations/20260722_z_notification_experience_v060.sql`](supabase/migrations/20260722_z_notification_experience_v060.sql)

Essa migration cria ou atualiza:

- `user_preferences`;
- suporte a fusos IANA, como `America/Sao_Paulo`;
- geração server-side das ocorrências;
- `meal_notification_groups`;
- vínculo entre grupos e ocorrências notificadas;
- funções de reserva, conclusão e retry dos grupos;
- RLS e índices correspondentes.

Depois, publique novamente a Edge Function:

```bash
supabase functions deploy send-meal-notifications --use-api
```

O cron atual pode permanecer exatamente como está:

```text
* * * * *
```

## Secrets da Edge Function

Obrigatórios:

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `APP_PUBLIC_URL`

Para a publicação atual:

```text
APP_PUBLIC_URL=https://albertogpo.github.io/rotina-pet/
```

Opcionais:

```text
MEAL_NOTIFICATION_WINDOW_MINUTES=10
MEAL_NOTIFICATION_TTL_SECONDS=1800
```

Sem essas duas secrets, a função usa os valores padrão acima.

## Variáveis do frontend

No GitHub Actions ou em `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
VITE_ONESIGNAL_APP_ID=SEU_APP_ID_ONESIGNAL
```

## Ordem recomendada de publicação da v0.6.0

1. Executar a migration `20260722_z_notification_experience_v060.sql`.
2. Publicar novamente a Edge Function.
3. Enviar o código da v0.6.0 para a branch `main`.
4. Aguardar o GitHub Pages concluir o deploy.
5. Abrir o app uma vez no iPhone para salvar o fuso e reafirmar o `external_id` no OneSignal.
6. Criar duas ou mais refeições no mesmo horário e validar uma única notificação.
7. Tocar no push e confirmar o destaque do horário na tela Hoje.

## Testes principais

### Agrupamento

- dois pets no mesmo horário;
- um pet com três itens;
- dois pets com dois ou três itens cada;
- três ou mais pets no mesmo horário.

### Duplicidade

- deixar o cron executar por vários minutos;
- confirmar uma única mensagem;
- conferir o grupo em `meal_notification_groups`;
- conferir as ocorrências vinculadas em `meal_notification_log`.

### Deep link

- testar com o PWA fechado;
- testar com o PWA já aberto;
- testar uma refeição ainda pendente;
- testar uma refeição atualizada antes do toque.

### Fuso

- confirmar `America/Sao_Paulo` nas Configurações;
- trocar temporariamente para outro fuso;
- conferir a mudança dos horários pendentes;
- restaurar o fuso correto depois do teste.

## Destaques anteriores

### v0.5.3

- correção das guardas de autenticação no build;
- integração inicial com OneSignal;
- Edge Function de lembretes;
- Cron automático no Supabase.

### v0.5.1

- edição rápida apenas dos horários;
- preservação de alimentos, quantidades e histórico;
- escolha da data de início da nova rotina.

### v0.5.0

- navegação por datas;
- ações de consumo em linguagem natural;
- base da infraestrutura de Web Push.

## Limitações conhecidas

- o ícone visual do aplicativo ainda será redesenhado;
- identidade verificada do OneSignal ainda não foi adicionada;
- push depende de permissão, conexão, configurações do sistema e políticas do navegador;
- a tela Hoje permanece a fonte de verdade quando uma notificação não é exibida;
- o produto profissional para veterinários continua em definição.

## Tecnologias

- React
- TypeScript
- Vite
- Supabase
- Vite PWA
- GitHub Actions
- GitHub Pages
- OneSignal

## Executar localmente

Requisitos: Node.js 22 ou versão compatível.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha o `.env.local` com as variáveis do frontend.

Para uma instalação do zero, execute [`supabase/setup.sql`](supabase/setup.sql) no SQL Editor do Supabase.

## Compilar

```bash
npm run build
```

## Publicação no GitHub Pages

O workflow está em [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

No repositório do GitHub:

1. cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_ONESIGNAL_APP_ID` em **Settings → Secrets and variables → Actions → Variables**;
2. em **Settings → Pages**, selecione **GitHub Actions** como fonte;
3. envie as alterações para a branch `main`.

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
