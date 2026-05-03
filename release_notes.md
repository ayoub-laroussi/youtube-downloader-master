# 🚀 Release v1.5.1 - Smart File Naming & macOS Stability

This release brings stability and user experience improvements, especially for macOS users, and builds upon the latest UI enhancements!

### ✨ New Features
* **Completely Revamped UI:** A brand new, sleek, and minimalist user interface with an integrated Dark Mode for a more premium look.
* **Smart Folder Selector:** Easily choose your download directory directly from the new settings menu in the UI.
* **Smart File Naming:** The download quality is now automatically appended to the generated filename (e.g., `My_Awesome_Vlog_1080p.mp4` or `My_Favorite_Song_320kbps.mp3`). This prevents overwriting older files when downloading the same video in a different quality!
* **100% Standalone/Portable:** The app now bundles `yt-dlp` and `ffmpeg` natively for both Windows **and** macOS. You no longer need to install external system dependencies.
* **Full Automation:** Windows (`.exe`) and macOS (`.dmg`) builds are now automatically compiled and published via GitHub Actions.

### 🐛 Bug Fixes
* **macOS Browser Extension Fix:** The connection between the browser extension and the app (Deep Linking) finally works flawlessly on Mac.
* **macOS Finder Integration Fix:** When a download finishes, the macOS Finder now opens properly and *automatically selects* the newly downloaded file.
* **macOS Download Engine Fix:** Resolved the `Impossible de récupérer les infos` error on Mac, which was caused by underlying executable pathing issues.
* **Startup Fix:** Handled singleton locks preventing `npm start` from launching after an ungraceful exit.
