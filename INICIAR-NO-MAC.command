#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js ainda não está instalado. Instale a versão LTS e execute este arquivo novamente."
  open "https://nodejs.org/"
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Preparando o aplicativo pela primeira vez..."
  npm install || exit 1
fi
echo "Abrindo o Rotina Pet..."
npm run dev -- --host
