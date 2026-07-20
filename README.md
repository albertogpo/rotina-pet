# Rotina Pet v2

Aplicativo PWA conectado ao Supabase para alimentação e peso dos animais.

## Incluído
- login e recuperação de senha;
- animais separados;
- histórico e gráfico de peso;
- alimentos;
- plano com horários manuais ou distribuídos por janela;
- vários alimentos por refeição;
- divisão automática da quantidade diária;
- checklist diário persistente;
- PWA e lembretes locais enquanto o app estiver ativo;
- segurança RLS;
- publicação automática no GitHub Pages.

## Configuração mínima
1. `npm install`
2. Crie um projeto no Supabase.
3. Execute `supabase/setup.sql` no SQL Editor.
4. Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

5. `npm run dev`

## Publicação
O workflow está em `.github/workflows/deploy-pages.yml`. No GitHub, cadastre as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em Actions Variables e ative Pages com GitHub Actions.

## Limitação atual
O push com o app totalmente fechado ainda não está ativo. A estrutura atual oferece notificações enquanto o PWA estiver ativo; o push em segundo plano exigirá VAPID e uma Edge Function.
