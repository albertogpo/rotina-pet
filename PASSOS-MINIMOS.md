# Rotina Pet — passos mínimos

A programação principal já está pronta. Falta somente criar o espaço gratuito onde os dados ficarão salvos.

## Você precisará fazer uma única vez

1. Criar uma conta e um projeto gratuito no Supabase.
2. Abrir o **SQL Editor**, copiar todo o conteúdo de `supabase/setup.sql` e clicar em **Run**.
3. No Supabase, copiar somente:
   - **Project URL**;
   - **Publishable key**, iniciada por `sb_publishable_`.
4. No Mac, abrir `CONFIGURAR-SUPABASE-NO-MAC.command` e colar os dois dados quando solicitado.
5. Abrir `INICIAR-NO-MAC.command`.

No Windows, use os dois arquivos equivalentes terminados em `.bat`.

## Não forneça nem coloque no aplicativo

- senha do banco;
- `service_role`;
- secret key iniciada por `sb_secret_`.

O aplicativo usa somente a chave pública, protegida pelas regras RLS do banco.
