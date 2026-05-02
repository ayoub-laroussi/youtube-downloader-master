# 🎬 YT Downloader

A simple and beautiful desktop app to download YouTube videos and playlists as **MP4** (video) or **MP3** (audio).

Supports quality up to **4K** and **320kbps** audio.

---

## 📥 Installation

1. Go to the [**Releases**](../../releases/latest) page
2. Download the file **`youtube-downloader-1.0.0 Setup.exe`**
3. Run the installer — the app will launch automatically when done
4. You'll find **YT Downloader** in your Start Menu

---

## ⚠️ Windows SmartScreen Warning

When you run the installer for the first time, Windows may show a **SmartScreen warning** like this:

> *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

**This is completely normal and safe.** Here's why:

- This warning appears for **any app that is not code-signed** with a paid certificate (~$300/year)
- The app is **open source** — you can check every line of code in this repository
- It does **not** contain any virus, malware, or harmful code
- It simply uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/) to download videos

### How to bypass it:

1. Click **"More info"**
2. Click **"Run anyway"**

You only need to do this **once**. Windows will remember your choice.

---

## 🎯 Features

- 🎥 Download videos in **MP4** (360p to 4K)
- 🎵 Download audio in **MP3** (128 to 320 kbps)
- 📋 Full **playlist support** — download all videos at once
- ⚙️ **Custom download folder** — choose where your files are saved
- 📂 **Auto-opens** the download folder when finished
- 🚀 Fast downloads with concurrent fragments

---

## 🧩 Browser Extension (Chrome & Edge)

A companion extension is available to add a quick download button directly on YouTube pages.

### Installation in Developer Mode:

**For Chrome:**
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right corner)
3. Click **Load unpacked**
4. Select the `extension` folder from this project

**For Edge:**
1. Open Edge and go to `edge://extensions/`
2. Enable **Developer mode** (bottom left corner)
3. Click **Load unpacked**
4. Select the `extension-edge` folder from this project

---

## 🛠️ For Developers

### Run in dev mode
```bash
npm install
npm start
```

### Build the installer
```powershell
./build_app.ps1
```

The installer will be generated in `out/make/squirrel.windows/x64/`.
