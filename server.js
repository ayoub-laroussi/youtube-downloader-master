const express = require('express');
const cors = require('cors');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const https = require('https');

// ─── Detect if running inside a packaged Electron app ───────────────────────
const isPackaged = __dirname.includes('app.asar');

// ─── Resolve binary paths (yt-dlp, ffmpeg) ──────────────────────────────────
const binExt = process.platform === 'win32' ? '.exe' : '';
const binNameYtdlp = 'yt-dlp' + binExt;
const binNameFfmpeg = 'ffmpeg' + binExt;

const possibleBinPaths = [
  path.join(process.resourcesPath || '', 'bin'),      // packaged: resources/bin/
  path.join(__dirname, 'bin'),                          // dev: ./bin/
  path.join(__dirname, '..', 'bin'),
  __dirname,
  '/usr/local/bin',                                   // macOS Intel / common Homebrew
  '/opt/homebrew/bin',                                // macOS Apple Silicon Homebrew
  path.join(os.homedir(), '.local', 'bin'),             // User local bin
];

let YTDLP_BIN = 'yt-dlp';
let FFMPEG_BIN = 'ffmpeg';

for (const p of possibleBinPaths) {
  const ytPath = path.join(p, binNameYtdlp);
  console.log('[BIN SEARCH]', ytPath, fs.existsSync(ytPath));
  if (fs.existsSync(ytPath)) {
    YTDLP_BIN = ytPath;
    FFMPEG_BIN = path.join(p, binNameFfmpeg);
    console.log('[BIN FOUND] yt-dlp:', YTDLP_BIN);
    console.log('[BIN FOUND] ffmpeg:', FFMPEG_BIN);
    break;
  }
}

// ─── Resolve static files path ──────────────────────────────────────────────
// In packaged mode, __dirname is inside app.asar but express.static can read from it
const publicPath = path.join(__dirname, 'public');

// ─── Settings ───────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const SETTINGS_FILE = path.join(os.homedir(), '.ytdownloader-settings.json');

let userSettings = { downloadDir: path.join(os.homedir(), 'Downloads', 'YT Downloader'), theme: 'light' };
if (fs.existsSync(SETTINGS_FILE)) {
  try { Object.assign(userSettings, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))); } catch(e) {}
}
if (!fs.existsSync(userSettings.downloadDir)) {
  try { fs.mkdirSync(userSettings.downloadDir, { recursive: true }); } catch(e) {}
}

app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// ─── Track active downloads ─────────────────────────────────────────────────
const activeDownloads = new Map();

// ─── Utility: validate URLs ──────────────────────────────────────────
function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch|shorts|playlist)|youtu\.be\/)/;
  return pattern.test(url);
}

function isValidYTMusicUrl(url) {
  const pattern = /^(https?:\/\/)?(music\.youtube\.com\/)/;
  return pattern.test(url);
}

function isValidTikTokUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.|vt\.|vm\.)?(tiktok\.com\/)/;
  return pattern.test(url);
}

function isValidSpotifyUrl(url) {
  const pattern = /^(https?:\/\/)?(open\.spotify\.com\/)(intl-[a-z-]+\/)?(track|album|playlist)\/[A-Za-z0-9]+/;
  return pattern.test(url);
}

function isPlaylistUrl(url) {
  return /[?&]list=/.test(url) || /youtube\.com\/playlist/.test(url);
}

// ─── GET /api/info — Fetch video or playlist metadata ───────────────────────
app.get('/api/info', (req, res) => {
  const { url } = req.query;

  if (!url || (!isValidYouTubeUrl(url) && !isValidYTMusicUrl(url) && !isValidTikTokUrl(url))) {
    return res.status(400).json({ error: 'URL invalide. Veuillez entrer un lien YouTube, YouTube Music ou TikTok valide.' });
  }

  const isPlaylist = isPlaylistUrl(url);

  const args = [
    '--dump-json',
    '--flat-playlist',
  ];

  if (!isPlaylist) {
    args.push('--no-playlist');
  }

  args.push(url);

  execFile(YTDLP_BIN, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('yt-dlp info error:', stderr || error.message);
      return res.status(500).json({ error: 'Impossible de récupérer les infos.' });
    }

    try {
      // yt-dlp outputs one JSON per line for playlists
      const lines = stdout.trim().split('\n').filter(Boolean);
      const entries = lines.map(line => JSON.parse(line));

      if (!isPlaylist || entries.length === 1) {
        // Single video
        const data = entries[0];

        const mergedQualities = (data.formats || [])
          .filter(f => f.vcodec !== 'none' && f.height)
          .map(f => f.height)
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => b - a);

        const qualities = mergedQualities.length > 0 ? mergedQualities : [2160, 1440, 1080, 720, 480, 360];

        return res.json({
          type: 'video',
          id: data.id,
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration,
          duration_string: data.duration_string,
          channel: data.channel || data.uploader,
          view_count: data.view_count,
          url: data.webpage_url || data.url || url,
          videoQualities: qualities,
          audioQualities: [320, 256, 192, 128]
        });
      }

      // Playlist
      const videos = entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        thumbnail: entry.thumbnails?.[entry.thumbnails.length - 1]?.url || entry.thumbnail || '',
        duration: entry.duration,
        duration_string: entry.duration_string || '',
        channel: entry.channel || entry.uploader || '',
        url: entry.url?.startsWith('http')
          ? entry.url
          : `https://www.youtube.com/watch?v=${entry.id}`,
      }));

      // Try to extract playlist title from the URL or first entry
      const playlistTitle = entries[0]?.playlist_title || entries[0]?.playlist || 'Playlist';

      res.json({
        type: 'playlist',
        title: playlistTitle,
        count: videos.length,
        videos,
        videoQualities: [2160, 1440, 1080, 720, 480, 360],
        audioQualities: [320, 256, 192, 128]
      });

    } catch (e) {
      console.error('Parse error:', e.message);
      res.status(500).json({ error: 'Erreur lors du traitement des données.' });
    }
  });
});

// ─── POST /api/download — Start download to temp file ───────────────────────
app.post('/api/download', (req, res) => {
  const { url, format, quality } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL manquante.' });
  }

  if (!format || !['mp3', 'mp4', 'wav'].includes(format)) {
    return res.status(400).json({ error: 'Format invalide. Utilisez mp3, mp4 ou wav.' });
  }

  const downloadId = crypto.randomUUID();
  const ext = format === 'mp3' ? 'mp3' : format === 'wav' ? 'wav' : 'mp4';

  const audioBitrate = format === 'mp3' ? (quality || '320') : null;
  const videoQuality = format === 'mp4' ? (quality || '1080') : null;

  const suffix = format === 'mp3' ? `_${audioBitrate}kbps` : format === 'wav' ? '_wav' : `_${videoQuality}p`;
  const outTemplate = path.join(userSettings.downloadDir, `%(title)s${suffix}.%(ext)s`);

  // --windows-filenames uniquement sur Windows pour éviter les caractères invalides
  const filenameFlag = process.platform === 'win32' ? ['--windows-filenames'] : [];
  let args = ['--no-playlist', '--newline', '--concurrent-fragments', '4', '--ffmpeg-location', FFMPEG_BIN, ...filenameFlag];

  if (format === 'mp3') {
    args.push(
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', `${audioBitrate}K`,
      '--postprocessor-args', 'ffmpeg:-threads 4',
      '-o', outTemplate,
      url
    );
  } else if (format === 'wav') {
    args.push(
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'wav',
      '--postprocessor-args', 'ffmpeg:-threads 4',
      '-o', outTemplate,
      url
    );
  } else {
    args.push(
      '-f', `bestvideo[height<=${videoQuality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${videoQuality}]+bestaudio/best[height<=${videoQuality}]`,
      '--merge-output-format', 'mp4',
      '-o', outTemplate,
      url
    );
  }

  const download = {
    id: downloadId,
    status: 'downloading',
    progress: 0,
    speed: '',
    eta: '',
    finalFile: '',
    error: null,
  };

  activeDownloads.set(downloadId, download);

  console.log(`[${downloadId}] Starting ${format} download...`);

  const ytdlp = spawn(YTDLP_BIN, args);

  ytdlp.stdout.on('data', (data) => {
    const line = data.toString().trim();
    console.log(`[${downloadId}] ${line}`);

    const destMatch = line.match(/Destination:\s+(.+)/);
    if (destMatch && !line.includes('.fna') && !line.includes('.temp')) {
      download.finalFile = destMatch[1];
    }
    const mergeMatch = line.match(/Merging formats into "(.+)"/);
    if (mergeMatch) download.finalFile = mergeMatch[1];
    const extractMatch = line.match(/Destination:\s+(.+\.(?:mp3|m4a|mp4|webm|wav))/);
    if (extractMatch) download.finalFile = extractMatch[1];

    const progressMatch = line.match(/(\d+\.?\d*)%/);
    if (progressMatch) download.progress = parseFloat(progressMatch[1]);
    const speedMatch = line.match(/at\s+(.+?)\s/);
    if (speedMatch) download.speed = speedMatch[1];
    const etaMatch = line.match(/ETA\s+(\S+)/);
    if (etaMatch) download.eta = etaMatch[1];
  });

  ytdlp.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.log(`[${downloadId}] stderr: ${line}`);

    const progressMatch = line.match(/(\d+\.?\d*)%/);
    if (progressMatch) {
      download.progress = parseFloat(progressMatch[1]);
    }
  });

  ytdlp.on('close', (code) => {
    if (code === 0) {
      download.status = 'done';
      download.progress = 100;
      console.log(`[${downloadId}] Download complete!`);
    } else {
      download.status = 'error';
      download.error = 'Le téléchargement a échoué.';
      console.error(`[${downloadId}] Download failed with code ${code}`);
    }
  });

  ytdlp.on('error', (err) => {
    download.status = 'error';
    download.error = err.message;
    console.error(`[${downloadId}] Spawn error: ${err.message}`);
  });

  res.json({ downloadId });
});

// ─── GET /api/progress/:id — Check download progress ────────────────────────
app.get('/api/progress/:id', (req, res) => {
  const download = activeDownloads.get(req.params.id);

  if (!download) {
    return res.status(404).json({ error: 'Téléchargement introuvable.' });
  }

  res.json({
    status: download.status,
    progress: download.progress,
    speed: download.speed,
    eta: download.eta,
    finalFile: download.finalFile,
    error: download.error,
  });
});

// ─── GET /api/spotify-info ─────────────────────────────────────────────────
app.get('/api/spotify-info', (req, res) => {
  const { url } = req.query;
  if (!url || !isValidSpotifyUrl(url)) {
    return res.status(400).json({ error: 'URL Spotify invalide. Format: open.spotify.com/track/...' });
  }

  const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const type = url.includes('/track/') ? 'track' : url.includes('/album/') ? 'album' : 'playlist';

  https.get(oEmbedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try {
        const json = JSON.parse(data);
        const artist = json.author_name || '';
        const searchQuery = artist ? `${artist} - ${json.title}` : json.title;
        res.json({
          type,
          title: json.title,
          artist,
          thumbnail: json.thumbnail_url,
          searchQuery,
          url,
        });
      } catch (e) {
        res.status(500).json({ error: 'Erreur lors du traitement Spotify.' });
      }
    });
  }).on('error', () => {
    res.status(500).json({ error: 'Impossible de récupérer les infos Spotify.' });
  });
});

// ─── POST /api/spotify-download ─────────────────────────────────────────────
app.post('/api/spotify-download', (req, res) => {
  const { searchQuery, format } = req.body;

  if (!searchQuery) return res.status(400).json({ error: 'Requête manquante.' });
  if (!format || !['mp3', 'wav'].includes(format)) {
    return res.status(400).json({ error: 'Format invalide. Utilisez mp3 ou wav.' });
  }

  const downloadId = crypto.randomUUID();
  const outTemplate = path.join(userSettings.downloadDir, `%(title)s_spotify.%(ext)s`);
  const searchUrl = `ytsearch1:${searchQuery} official audio`;

  // Note: pas de --no-playlist car ytsearch1: est traité comme une playlist par yt-dlp
  // --windows-filenames uniquement sur Windows
  const spotifyFilenameFlag = process.platform === 'win32' ? ['--windows-filenames'] : [];
  let args = ['--newline', '--playlist-items', '1', '--concurrent-fragments', '4', '--ffmpeg-location', FFMPEG_BIN, ...spotifyFilenameFlag];

  if (format === 'wav') {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'wav', '--postprocessor-args', 'ffmpeg:-threads 4', '-o', outTemplate, searchUrl);
  } else {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '320K', '--postprocessor-args', 'ffmpeg:-threads 4', '-o', outTemplate, searchUrl);
  }

  const download = { id: downloadId, status: 'downloading', progress: 0, speed: '', eta: '', finalFile: '', error: null };
  activeDownloads.set(downloadId, download);

  console.log(`[${downloadId}] Starting Spotify download: ${searchQuery}`);
  const ytdlp = spawn(YTDLP_BIN, args);

  ytdlp.stdout.on('data', (data) => {
    const line = data.toString().trim();
    console.log(`[${downloadId}] ${line}`);
    const destMatch = line.match(/Destination:\s+(.+)/);
    if (destMatch && !line.includes('.fna') && !line.includes('.temp')) download.finalFile = destMatch[1];
    const mergeMatch = line.match(/Merging formats into "(.+)"/);
    if (mergeMatch) download.finalFile = mergeMatch[1];
    const extractMatch = line.match(/Destination:\s+(.+\.(?:mp3|wav))/);
    if (extractMatch) download.finalFile = extractMatch[1];
    const progressMatch = line.match(/(\d+\.?\d*)%/);
    if (progressMatch) download.progress = parseFloat(progressMatch[1]);
    const speedMatch = line.match(/at\s+(.+?)\s/);
    if (speedMatch) download.speed = speedMatch[1];
    const etaMatch = line.match(/ETA\s+(\S+)/);
    if (etaMatch) download.eta = etaMatch[1];
  });

  ytdlp.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.log(`[${downloadId}] stderr: ${line}`);
    // yt-dlp sometimes writes Destination: to stderr (e.g. during post-processing)
    const destMatch = line.match(/Destination:\s+(.+)/);
    if (destMatch && !line.includes('.fna') && !line.includes('.temp') && !line.includes('.ytdl')) {
      download.finalFile = destMatch[1].trim();
    }
    const extractMatch = line.match(/Destination:\s+(.+\.(?:mp3|wav))/);
    if (extractMatch) download.finalFile = extractMatch[1].trim();
    const progressMatch = line.match(/(\d+\.?\d*)%/);
    if (progressMatch) download.progress = parseFloat(progressMatch[1]);
  });

  ytdlp.on('close', (code) => {
    if (code === 0) {
      download.status = 'done';
      download.progress = 100;
      // If finalFile was never captured, fallback to the download directory
      if (!download.finalFile) {
        download.finalFile = userSettings.downloadDir;
      }
    } else {
      download.status = 'error';
      download.error = 'Le t\u00e9l\u00e9chargement Spotify a \u00e9chou\u00e9.';
    }
  });

  ytdlp.on('error', (err) => { download.status = 'error'; download.error = err.message; });

  res.json({ downloadId });
});

app.get('/api/settings', (req, res) => res.json(userSettings));

app.post('/api/settings', (req, res) => {
  let updated = false;
  if (req.body.downloadDir !== undefined) {
    userSettings.downloadDir = req.body.downloadDir;
    updated = true;
  }
  if (req.body.theme !== undefined) {
    userSettings.theme = req.body.theme;
    updated = true;
  }
  
  if (updated) {
    try {
      if (!fs.existsSync(userSettings.downloadDir)) fs.mkdirSync(userSettings.downloadDir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(userSettings));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Erreur écriture' });
    }
  } else {
    res.status(400).json({ error: 'Missing parameter' });
  }
});

// Rate-limit: évite d'ouvrir plusieurs fenêtres si plusieurs téléchargements se terminent en même temps
let lastFolderOpenTime = 0;
const FOLDER_OPEN_COOLDOWN_MS = 2000;

app.post('/api/open-folder', (req, res) => {
  const now = Date.now();
  if (now - lastFolderOpenTime < FOLDER_OPEN_COOLDOWN_MS) {
    // Trop tôt — on ignore pour éviter les fenêtres en double
    return res.json({ success: true, skipped: true });
  }
  lastFolderOpenTime = now;

  const target = req.body.file || userSettings.downloadDir;
  let cmd;

  if (process.platform === 'win32') {
    // Windows : ouvre l'Explorateur et sélectionne le fichier (ou ouvre le dossier)
    cmd = req.body.file
      ? `explorer.exe /select,"${target}"`
      : `explorer.exe "${target}"`;
  } else if (process.platform === 'darwin') {
    // macOS : ouvre le Finder et révèle le fichier (ou ouvre le dossier)
    cmd = req.body.file
      ? `open -R "${target}"`
      : `open "${target}"`;
  } else {
    // Linux
    cmd = req.body.file
      ? `xdg-open "${path.dirname(target)}"`
      : `xdg-open "${target}"`;
  }

  require('child_process').exec(cmd, (err) => {
    if (err) console.warn('[open-folder] exec error:', err.message);
  });
  res.json({ success: true });
});

// ─── Start server ────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎬 YouTube Downloader running at http://localhost:${PORT} et http://<VOTRE-IP-LOCALE>:${PORT}\n`);
  });
} else {
  module.exports = app;
}
