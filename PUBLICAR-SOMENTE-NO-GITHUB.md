# Rotina Pet — publicação somente pelo GitHub

Você não precisa instalar Node.js, npm ou dependências no computador.

O GitHub Actions fará automaticamente:

1. instalação temporária do Node.js;
2. instalação das dependências;
3. compilação do aplicativo;
4. publicação no GitHub Pages.

## Passos

### 1. Criar o repositório

Crie um repositório público no GitHub chamado `rotina-pet`.

### 2. Enviar os arquivos

Envie para a raiz do repositório todo o conteúdo desta pasta.

A pasta `.github` precisa ser enviada. No macOS, use `Command + Shift + .`
no Finder para mostrar arquivos e pastas ocultos.

Não envie:

- `.env.local`;
- `node_modules`;
- `dist`.

### 3. Cadastrar as variáveis

No repositório, abra:

`Settings > Secrets and variables > Actions > Variables`

Cadastre:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use a Project URL e a Publishable key do Supabase.

### 4. Ativar o GitHub Pages

Abra:

`Settings > Pages`

Em **Build and deployment**, selecione:

`Source: GitHub Actions`

### 5. Acompanhar a publicação

Abra a aba:

`Actions`

O fluxo **Publicar no GitHub Pages** deverá começar automaticamente.
Quando os dois trabalhos estiverem verdes, abra o endereço exibido na implantação.

### 6. Configurar o endereço no Supabase

No Supabase, abra:

`Authentication > URL Configuration`

Coloque o endereço publicado do GitHub Pages em:

- `Site URL`
- `Redirect URLs`

Exemplo de formato:

`https://SEU-USUARIO.github.io/rotina-pet/`

### 7. Usar

Abra o endereço publicado, crie sua conta no Rotina Pet e confirme o e-mail,
caso o Supabase solicite.
