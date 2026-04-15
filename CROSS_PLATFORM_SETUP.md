# 🌍 Guide de Configuration Multiplateforme (Mac, iOS, Android)

Ce document explique comment installer et utiliser le **YouTube/TikTok Downloader** sur différentes plateformes. Étant donné que le backend utilise l'exécutable `yt-dlp` et `ffmpeg`, la configuration diffère d'un PC (Windows/Mac) à un appareil mobile (iOS/Android).

---

## 🍏 1. Configuration pour Mac (macOS)

L'application de bureau peut être exécutée de manière native sur Mac grâce à Node.js et Electron.

### Prérequis
- Ouvrez le **Terminal** sur votre Mac.
- Si vous n'avez pas installé les outils de ligne de commande, le script s'en chargera via **Homebrew**.

### Installation automatique
1. Ouvrez le terminal dans le dossier du projet.
2. Rendez le script exécutable (si ce n'est pas déjà le cas) :
   ```bash
   chmod +x setup_mac.sh
   ```
3. Lancez le script d'installation :
   ```bash
   ./setup_mac.sh
   ```
   *Ce script va installer Homebrew, Python, ffmpeg, yt-dlp, Node.js et toutes les dépendances NPM nécessaires.*

### Lancer ou Empaqueter l'Application
- **Pour lancer le serveur et l'application en mode développement :**
  ```bash
  npm start
  ```
- **Pour générer l'application finale (un fichier `.zip` ou `.app` autonome) :**
  ```bash
  npm run make
  ```
  *Le fichier final se trouvera dans le dossier `out/make/zip/darwin/x64/` (selon la configuration Electron Forge).*

---

## 📱 2. Configuration pour Mobile (iOS & Android)

Il est important de comprendre que les règles strictes d'Apple (iOS) et Android empêchent l'exécution native de scripts Python tiers (`yt-dlp`) et de binaires compilés (`ffmpeg`) dans une simple application mobile distribuée via les Stores officiels.

La **seule méthode fiable et efficace** pour utiliser ce Downloader sur un iPhone, iPad ou appareil Android est de le transformer en **Web App (PWA)** hébergée sur votre ordinateur (Windows/Mac) qui agira comme "Serveur Local".

### Comment procéder ?

#### Étape A : Lancer le serveur sur votre Ordinateur
1. Gardez votre PC Windows (ou Mac) allumé avec l'application lancée, ou lancez uniquement le backend web avec :
   ```bash
   npm run server
   ```
2. Par défaut, le serveur tourne sur le port `3000`. 
3. Trouvez l'adresse IP locale de votre ordinateur sur votre réseau Wi-Fi :
   - Sur Windows : ouvrez PowerShell et tapez `ipconfig` (Exemple: `192.168.1.15`).
   - Sur Mac : tapez `ifconfig` dans le terminal.
4. Assurez-vous que le port `3000` est autorisé à traverser le pare-feu de votre ordinateur. Modifiez le `server.js` à la ligne `app.listen(PORT, '0.0.0.0', ...)` si ce n'est pas déjà fait afin de permettre les connexions réseaux externes.

#### Étape B : Installer l'application sur iOS (iPhone / iPad)
1. Assurez-vous que votre iPhone est **connecté au même réseau Wi-Fi** que votre ordinateur.
2. Ouvrez **Safari**.
3. Allez à l'adresse de votre serveur : `http://VOTRE-ADRESSE-IP:3000` (ex: `http://192.168.1.15:3000`).
4. La page de l'application s'affiche. Appuyez sur l'icône de **Partage** en bas de l'écran (le carré avec une flèche pointant vers le haut).
5. Faites défiler vers le bas et sélectionnez **"Sur l'écran d'accueil"** (Add to Home Screen).
6. Nommez-la "YT Downloader" et confirmez.
7. L'application apparaîtra maintenant sur votre écran d'accueil comme n'importe quelle autre application native iOS ! (Grâce au `manifest.json` que nous avons inclus).

#### Étape C : Installer l'application sur Android
1. Assurez-vous que votre téléphone est **connecté au même réseau Wi-Fi** que votre ordinateur.
2. Ouvrez **Google Chrome**.
3. Allez à l'adresse du serveur local : `http://VOTRE-ADRESSE-IP:3000`.
4. Chrome devrait automatiquement vous afficher un bandeau en bas vous proposant **"Ajouter à l'écran d'accueil"** (ou "Installer l'application").
5. Si le bandeau n'apparaît pas, appuyez sur les **3 petits points** (Menu Chrome) en haut à droite, puis sur **"Ajouter à l'écran d'accueil"**.
6. Une icône s'ajoutera à votre smartphone et fonctionnera comme une vraie application (PWA).

### Où vont les téléchargements sur Mobile ?
Lorsqu'elle est utilisée sur mobile via cette méthode de Serveur, **les vidéos se téléchargent sur le Serveur (Ordinateur).** 
Pour télécharger les vidéos directement et physiquement sur le disque du téléphone mobile, il faudrait que la fonction de "Téléchargement" propose de retourner un flux de données (Stream) plutôt que de sauvegarder un fichier direct (`-o outTemplate`). 

*(Si vous souhaitez que le serveur transmette le fichier en retour sur le téléphone, il sera nécessaire d'ajouter un Endpoint de téléchargement de fichier dans le fichier `server.js` et modifier le frontend `app.js` pour utiliser l'API Blob. Mais la plupart des d'utilisateurs apprécient centraliser leurs vidéos sur leur ordinateur même commandées depuis leur canapé !)*
