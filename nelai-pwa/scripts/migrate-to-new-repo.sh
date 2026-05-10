#!/bin/bash
# Script para migrar Andino Wallet a un nuevo repositorio privado
# Uso: ./scripts/migrate-to-new-repo.sh <nuevo-repo-url>

set -e

NEW_REPO_URL=$1

if [ -z "$NEW_REPO_URL" ]; then
    echo "❌ Error: Debes proporcionar la URL del nuevo repositorio"
    echo "Uso: ./scripts/migrate-to-new-repo.sh <nuevo-repo-url>"
    echo ""
    echo "Ejemplo:"
    echo "  ./scripts/migrate-to-new-repo.sh https://github.com/tu-usuario/andino-wallet-pwa.git"
    exit 1
fi

echo "🚀 Migrando Andino Wallet a nuevo repositorio..."
echo "📦 Nuevo repositorio: $NEW_REPO_URL"
echo ""

# Verificar que estamos en la rama andino
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "andino" ]; then
    echo "⚠️  Advertencia: No estás en la rama 'andino'"
    echo "   Rama actual: $CURRENT_BRANCH"
    read -p "¿Continuar de todas formas? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Agregar nuevo remote
echo "📡 Agregando nuevo remote 'andino'..."
git remote add andino "$NEW_REPO_URL" 2>/dev/null || git remote set-url andino "$NEW_REPO_URL"

# Push de la rama andino al nuevo repositorio
echo "⬆️  Enviando rama 'andino' al nuevo repositorio..."
git push -u andino andino:main

echo ""
echo "✅ Migración completada!"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verifica el nuevo repositorio en: $NEW_REPO_URL"
echo "   2. Configura el repositorio como privado en GitHub/GitLab"
echo "   3. (Opcional) Cambia el remote por defecto:"
echo "      git remote set-url origin $NEW_REPO_URL"
echo "   4. (Opcional) Elimina el remote antiguo:"
echo "      git remote remove origin"
echo ""
