# Rotina Pet

O **Rotina Pet** é um aplicativo web instalável (PWA) para organizar a alimentação e acompanhar o peso dos animais.

O projeto nasceu de uma necessidade real: visualizar, em um único lugar, o que cada animal precisa comer, em qual horário e o que aconteceu em cada refeição. Esta versão é um protótipo funcional em evolução e também serve como laboratório para uma futura plataforma de acompanhamento nutricional entre tutores e veterinários.

> **Estado do projeto:** versão de testes (`v0.4.0`). Os dados são persistidos no Supabase, mas algumas funções — como notificações em segundo plano — ainda estão em desenvolvimento.

## Aplicativo publicado

A versão atual pode ser acessada em:

**https://albertogpo.github.io/rotina-pet/**

## O que já funciona

- cadastro e edição de animais;
- arquivamento e restauração de animais sem apagar o histórico;
- cadastro de alimentos;
- criação de alimentos sem sair do fluxo de criação do plano;
- planos com horários manuais ou distribuídos por uma janela;
- múltiplos alimentos na mesma refeição;
- divisão automática da quantidade diária entre as refeições escolhidas;
- visão **Hoje** com as refeições de todos os animais agrupadas por horário;
- atalhos de horário no resumo do dia, com rolagem direta para cada grupo;
- cards compactos em acordeão, abertos individualmente por refeição;
- filtro da visão Hoje por um ou vários animais;
- ícones de estado sempre acompanhados por texto;
- registro de **Comeu tudo**, **Não comeu tudo** ou **Não foi servida**;
- consumo aproximado por níveis: **Quase tudo**, **Metade**, **Pouco** ou **Nada**;
- correção de um registro já realizado;
- registro, histórico e gráfico de peso;
- autenticação e recuperação de senha pelo Supabase;
- instalação como PWA;
- publicação automática no GitHub Pages;
- segurança por Row Level Security (RLS).

## Alterações da versão 0.4.0

- remoção dos chips de animais da tela **Configurações**, onde não tinham função;
- resumo da tela **Hoje** com todos os horários do dia e atalhos internos;
- maior destaque visual para os horários;
- substituição dos cards altos por linhas compactas expansíveis;
- apenas uma refeição fica aberta por vez dentro de cada horário;
- registro opcional de consumo incompleto, sem acrescentar uma etapa obrigatória a quem seleciona **Comeu tudo**;
- distinção entre comida oferecida e recusada (**Nada**) e refeição não oferecida (**Não foi servida**);
- reforços de compatibilidade para o PWA no iPhone: viewport com área segura, bloqueio de overflow horizontal, preservação da escala de texto e campos com fonte mínima de 16 px.

## Atualização obrigatória do Supabase para a v0.4.0

Esta versão adiciona o campo `consumption_level` às ocorrências de refeição.

Em um projeto Supabase que já estava funcionando antes da `v0.4.0`, execute no **SQL Editor**:

[`supabase/migrations/20260721_add_meal_consumption.sql`](supabase/migrations/20260721_add_meal_consumption.sql)

O script é idempotente: pode ser executado novamente sem criar uma segunda coluna. Registros antigos marcados como concluídos serão interpretados como **Comeu tudo**.

Para uma instalação totalmente nova, basta executar [`supabase/setup.sql`](supabase/setup.sql), que já contém a estrutura atualizada.

## Limitações conhecidas

- os lembretes locais funcionam enquanto o aplicativo estiver aberto ou ativo no aparelho;
- notificações push com o aplicativo totalmente fechado ainda não estão disponíveis;
- o onboarding ainda exige conta antes da experiência completa — isso será redesenhado;
- o produto profissional para veterinários ainda está na fase de definição;
- os reforços contra o zoom indevido no iPhone precisam continuar sendo observados em aparelhos reais, pois o problema era intermitente.

## Direção do produto

A visão de longo prazo é conectar o plano nutricional criado pelo veterinário à rotina real do tutor. O veterinário define o tratamento; o tutor organiza os horários e a divisão das porções e registra o que aconteceu no dia a dia.

As decisões, hipóteses e ideias já consolidadas estão em [`docs/00_PRODUCT_FOUNDATION.md`](docs/00_PRODUCT_FOUNDATION.md).

## Tecnologias

- React
- TypeScript
- Vite
- Supabase
- Vite PWA
- GitHub Actions
- GitHub Pages

## Executar localmente

Requisitos: Node.js 22 ou versão compatível.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha o arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

Antes do primeiro uso, execute [`supabase/setup.sql`](supabase/setup.sql) no SQL Editor do Supabase.

## Compilar

```bash
npm run build
```

Os arquivos finais serão gerados na pasta `dist`.

## Publicação no GitHub Pages

O workflow está em [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

No repositório do GitHub:

1. cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em **Settings → Secrets and variables → Actions → Variables**;
2. em **Settings → Pages**, selecione **GitHub Actions** como fonte;
3. envie as alterações para a branch `main`.

Cada commit na `main` inicia automaticamente um novo build e deploy. Após a Action ficar verde, o PWA pode precisar ser fechado e reaberto para trocar imediatamente a versão mantida em cache.

## Configuração de autenticação no Supabase

Em **Authentication → URL Configuration**, use:

```text
Site URL:
https://albertogpo.github.io/rotina-pet/

Redirect URLs:
https://albertogpo.github.io/rotina-pet/
https://albertogpo.github.io/rotina-pet/**
```

O aplicativo também informa explicitamente esse endereço nos fluxos de confirmação de cadastro e recuperação de senha.

## Licença

Consulte o arquivo [`LICENSE`](LICENSE).
