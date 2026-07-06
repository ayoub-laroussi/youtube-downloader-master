// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  trackInfo: null,
  format: 'mp3',
};

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const urlInput    = $('#url-input');
const pasteBtn    = $('#paste-btn');
const fetchBtn    = $('#fetch-btn');
const loadingEl   = $('#loading');
const errorEl     = $('#error');
const errorMsg    = $('#error-message');
const resultEl    = $('#result');

const trackThumb  = $('#track-thumbnail');
const trackTitle  = $('#track-title');
const trackArtist = $('#track-artist');
const searchQueryDisplay = $('#search-query-display');

const btnMp3      = $('#btn-mp3');
const btnWav      = $('#btn-wav');
const downloadBtn = $('#download-btn');
const downloadProgress = $('#download-progress');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

const themeBtn      = $('#theme-btn');
const folderPathDisplay = $('#folder-path-display');
const folderPathInput   = $('#folder-path-input');
const changeFolderBtn   = $('#change-folder-btn');
const saveFolderBtn     = $('#save-folder-btn');
const cancelFolderBtn   = $('#cancel-folder-btn');

// ─── Utility ────────────────────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorEl.classList.remove('hidden');
  setTimeout(() => errorEl.classList.add('hidden'), 6000);
}

function setLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
  fetchBtn.disabled = show;
}

// ─── Fetch Spotify Track Info ────────────────────────────────────────────────
async function fetchTrackInfo() {
  const url = urlInput.value.trim();
  if (!url) { showError('Veuillez coller un lien Spotify.'); return; }

  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  setLoading(true);

  try {
    const res = await fetch(`/api/spotify-info?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur inconnue');

    if (data.type !== 'track') {
      throw new Error('Seuls les liens de type "track" (morceau) sont supportés pour l\'instant. Exemple : open.spotify.com/track/...');
    }

    showTrack(data);
  } catch (err) {
    showError(err.message || 'Impossible de récupérer les infos Spotify.');
  } finally {
    setLoading(false);
  }
}

// ─── Show Track ──────────────────────────────────────────────────────────────
function showTrack(data) {
  state.trackInfo = data;
  state.format = 'mp3';

  trackThumb.src = data.thumbnail || '';
  trackThumb.alt = data.title;
  trackTitle.textContent = data.title;
  trackArtist.textContent = data.artist || '';
  searchQueryDisplay.textContent = `Recherche YouTube : "${data.searchQuery}"`;

  btnMp3.classList.add('active');
  btnWav.classList.remove('active');

  resultEl.classList.remove('hidden');
}

// ─── Format Toggle ────────────────────────────────────────────────────────────
function setFormat(format) {
  state.format = format;
  btnMp3.classList.toggle('active', format === 'mp3');
  btnWav.classList.toggle('active', format === 'wav');
}

btnMp3.addEventListener('click', () => setFormat('mp3'));
btnWav.addEventListener('click', () => setFormat('wav'));

// ─── Download ────────────────────────────────────────────────────────────────
async function startDownload() {
  if (!state.trackInfo) return;

  downloadProgress.classList.remove('hidden');
  downloadBtn.classList.add('downloading');
  downloadBtn.querySelector('span').textContent = 'Téléchargement en cours...';
  progressFill.style.width = '0%';
  progressText.textContent = 'Démarrage...';

  try {
    // 1. Start Spotify download
    const startRes = await fetch('/api/spotify-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQuery: state.trackInfo.searchQuery,
        format: state.format,
      }),
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.error || 'Erreur au démarrage.');

    const { downloadId } = startData;

    // 2. Poll progress
    const finalFile = await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/progress/${downloadId}`);
          const data = await res.json();

          if (data.status === 'downloading') {
            const pct = Math.round(data.progress || 0);
            progressFill.style.width = `${pct}%`;
            let text = `Téléchargement... ${pct}%`;
            if (data.speed) text += ` — ${data.speed}`;
            if (data.eta)   text += ` — ETA ${data.eta}`;
            progressText.textContent = text;

          } else if (data.status === 'done') {
            clearInterval(interval);
            progressText.textContent = 'Conversion en cours...';
            resolve(data.finalFile);

          } else if (data.status === 'error') {
            clearInterval(interval);
            reject(new Error(data.error || 'Le téléchargement a échoué.'));
          }
        } catch(e) {
          clearInterval(interval);
          reject(e);
        }
      }, 800);
    });

    // Done
    progressFill.style.width = '100%';
    progressText.textContent = '✅ Téléchargement terminé !';
    setTimeout(resetUI, 3000);

    // Ouvre le dossier (ou sélectionne le fichier si le chemin est connu)
    try {
      await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFile ? { file: finalFile } : {})
      });
    } catch(e) {
      console.warn('open-folder failed:', e);
    }

  } catch (err) {
    showError(err.message || 'Erreur lors du téléchargement.');
    resetUI();
  }
}

function resetUI() {
  downloadProgress.classList.add('hidden');
  downloadBtn.classList.remove('downloading');
  downloadBtn.querySelector('span').textContent = 'Télécharger';
  progressFill.style.width = '0%';
}

downloadBtn.addEventListener('click', startDownload);

// ─── Paste / Search ──────────────────────────────────────────────────────────
fetchBtn.addEventListener('click', fetchTrackInfo);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchTrackInfo(); });

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.focus();
  } catch { urlInput.focus(); }
});

urlInput.addEventListener('paste', () => {
  setTimeout(() => { if (urlInput.value.trim()) fetchTrackInfo(); }, 100);
});

// ─── Theme ───────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}
async function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next })
    });
  } catch(e) {}
}
themeBtn.addEventListener('click', toggleTheme);
initTheme();

// ─── Download Folder Bar ─────────────────────────────────────────────────────
async function loadFolderSetting() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.downloadDir) {
      folderPathDisplay.textContent = data.downloadDir;
      folderPathDisplay.title = data.downloadDir;
      folderPathInput.value = data.downloadDir;
    }
    if (data.theme) {
      document.documentElement.setAttribute('data-theme', data.theme);
      localStorage.setItem('theme', data.theme);
    }
  } catch(e) {}
}
loadFolderSetting();

function enterFolderEditMode() {
  folderPathDisplay.classList.add('hidden');
  folderPathInput.classList.remove('hidden');
  changeFolderBtn.classList.add('hidden');
  saveFolderBtn.classList.remove('hidden');
  cancelFolderBtn.classList.remove('hidden');
  folderPathInput.focus();
  folderPathInput.select();
}

function exitFolderEditMode() {
  folderPathDisplay.classList.remove('hidden');
  folderPathInput.classList.add('hidden');
  changeFolderBtn.classList.remove('hidden');
  saveFolderBtn.classList.add('hidden');
  cancelFolderBtn.classList.add('hidden');
}

async function saveFolder(newPath) {
  if (!newPath) return;
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadDir: newPath })
    });
    if (res.ok) {
      exitFolderEditMode();
      loadFolderSetting();
    } else {
      alert('Erreur lors de la sauvegarde du dossier.');
    }
  } catch(e) {
    alert('Erreur: ' + e.message);
  }
}

changeFolderBtn.addEventListener('click', async () => {
  if (window.electronAPI && window.electronAPI.selectFolder) {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) await saveFolder(folderPath);
    } catch(e) {}
  } else {
    enterFolderEditMode();
  }
});

saveFolderBtn.addEventListener('click', () => saveFolder(folderPathInput.value.trim()));
cancelFolderBtn.addEventListener('click', () => { exitFolderEditMode(); loadFolderSetting(); });

folderPathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveFolder(folderPathInput.value.trim());
  if (e.key === 'Escape') { exitFolderEditMode(); loadFolderSetting(); }
});
