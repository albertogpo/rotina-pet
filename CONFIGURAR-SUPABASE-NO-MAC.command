#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "Cole a Project URL do Supabase e pressione Enter:"
read -r SUPABASE_URL
echo "Cole a Publishable key (sb_publishable_...) e pressione Enter:"
read -r SUPABASE_KEY
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "A URL e a chave são obrigatórias. Nada foi alterado."
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
  exit 1
fi
cat > .env.local <<ENV
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_KEY
ENV
echo "Configuração salva. Agora abra INICIAR-NO-MAC.command."
read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
