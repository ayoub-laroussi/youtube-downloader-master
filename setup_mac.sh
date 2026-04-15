#!/bin/bash
# ─── YouTube Downloader — Setup Mac ──────────────────────────────────────
set -e

echo "🎬 Installation de YouTube Downloader pour macOS..."
echo ""

# 1. Vérifier si Homebrew est installé
if ! command -v brew &> /dev/null; then
  echo "🍺 Installation de Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Installer ffmpeg
echo "🎞️  Installation de ffmpeg..."
brew install ffmpeg

# 3. Installer Python (qui installe pip3)
echo "🐍 Installation de Python/pip..."
brew install python

# 4. Installer yt-dlp
echo "⬇️  Installation de yt-dlp..."
pip3 install yt-dlp || pip3 install --break-system-packages yt-dlp

# 5. Installer Node.js si absent
if ! command -v node &> /dev/null; then
  echo "📦 Installation de Node.js..."
  brew install node
fi

# 6. Installer les dépendances Node.js
echo "📦 Installation des dépendances du projet..."
npm install

# 7. Vérification
echo ""
echo "✅ Vérification des installations :"
echo "   Node.js  : $(node --version 2>/dev/null || echo 'NON INSTALLÉ ❌')"
echo "   npm      : $(npm --version 2>/dev/null || echo 'NON INSTALLÉ ❌')"
echo "   yt-dlp   : $(yt-dlp --version 2>/dev/null || echo 'NON INSTALLÉ ❌')"
echo "   ffmpeg   : $(ffmpeg -version 2>&1 | head -1 || echo 'NON INSTALLÉ ❌')"
echo ""
echo "🚀 Tout est prêt ! Lance l'application avec :"
echo "   npm start"
echo ""
echo "   Pour construire l'app macOS finale :"
echo "   npm run make"
echo ""
