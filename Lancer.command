#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est introuvable : installe Node.js 24 depuis https://nodejs.org puis relance."
  read -r -p "Appuie sur Entrée pour fermer."
  exit 1
fi
node scripts/lancer.ts
code=$?
if [ "$code" -ne 0 ]; then
  read -r -p "Appuie sur Entrée pour fermer."
fi
exit "$code"
