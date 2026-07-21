# Rotina Pet

O **Rotina Pet** é um aplicativo web instalável (PWA) para organizar a alimentação e acompanhar o peso dos animais.

O projeto nasceu de uma necessidade real: visualizar, em um único lugar, o que cada animal precisa comer, em qual horário e o que já foi concluído. Esta versão é um protótipo funcional em evolução e também serve como laboratório para uma futura plataforma de acompanhamento nutricional entre tutores e veterinários.

> **Estado do projeto:** versão de testes. Os dados são persistidos no Supabase, mas algumas funções — como notificações em segundo plano — ainda estão em desenvolvimento.

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
- filtro da visão Hoje por um ou vários animais;
- registro de refeições concluídas ou não realizadas;
- registro, histórico e gráfico de peso;
- autenticação e recuperação de senha pelo Supabase;
- instalação como PWA;
- publicação automática no GitHub Pages;
- segurança por Row Level Security (RLS).

## Limitações conhecidas

- os lembretes locais funcionam enquanto o aplicativo está aberto ou ativo no aparelho;
- notificações push com o aplicativo totalmente fechado ainda não estão disponíveis;
- o onboarding ainda exige conta antes da experiência completa — isso será redesenhado;
- o produto profissional para veterinários ainda está na fase de definição.

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
