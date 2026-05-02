// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  videoInfo: null,
  playlistInfo: null,
  format: 'mp4',
  quality: null,
  isPlaylist: false,
};

// ─── Deep Link Handler (called from Electron main process) ──────────────────
window.handleDeepLink = function(videoUrl) {
  console.log('[DEEP LINK] Received URL in renderer:', videoUrl);
  if (videoUrl) {
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
      urlInput.value = videoUrl;
      // Small delay to ensure DOM is fully ready
      setTimeout(() => {
        fetchVideoInfo();
      }, 300);
    }
  }
};

// ─── DOM Elements ───────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const urlInput = $('#url-input');
const pasteBtn = $('#paste-btn');
const fetchBtn = $('#fetch-btn');
const loadingEl = $('#loading');
const errorEl = $('#error');
const errorMsg = $('#error-message');

// Single video elements
const resultEl = $('#result');
const thumbnailEl = $('#thumbnail');
const durationEl = $('#duration');
const titleEl = $('#video-title');
const channelEl = $('#video-channel');
const viewsEl = $('#video-views');
const btnMp4 = $('#btn-mp4');
const btnMp3 = $('#btn-mp3');
const qualityGrid = $('#quality-grid');
const downloadBtn = $('#download-btn');
const downloadProgress = $('#download-progress');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

// Playlist elements
const playlistResultEl = $('#playlist-result');
const playlistTitleEl = $('#playlist-title');
const playlistCountEl = $('#playlist-count');
const playlistVideosEl = $('#playlist-videos');
const plBtnMp4 = $('#pl-btn-mp4');
const plBtnMp3 = $('#pl-btn-mp3');
const plQualityGrid = $('#pl-quality-grid');
const downloadAllBtn = $('#download-all-btn');

// ─── Settings Elements ──────────────────────────────────────────────────────
const settingsBtn = $('#settings-btn');
const settingsModal = $('#settings-modal');
const settingsCancel = $('#settings-cancel');
const settingsSave = $('#settings-save');
const downloadDirInput = $('#download-dir-input');

// ─── Utility ────────────────────────────────────────────────────────────────
function formatViews(count) {
  if (!count) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M vues`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K vues`;
  return `${count} vues`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorEl.classList.remove('hidden');
  setTimeout(() => errorEl.classList.add('hidden'), 5000);
}

function setLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
  fetchBtn.disabled = show;
}

// ─── Fetch Video/Playlist Info ──────────────────────────────────────────────
async function fetchVideoInfo() {
  const url = urlInput.value.trim();

  if (!url) {
    showError('Veuillez entrer une URL YouTube.');
    return;
  }

  // Hide previous results
  resultEl.classList.add('hidden');
  playlistResultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  setLoading(true);

  try {
    const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur inconnue');
    }

    if (data.type === 'playlist') {
      showPlaylist(data);
    } else {
      showSingleVideo(data);
    }

  } catch (err) {
    showError(err.message || 'Impossible de récupérer les infos.');
  } finally {
    setLoading(false);
  }
}

// ─── Show Single Video ─────────────────────────────────────────────────────
function showSingleVideo(data) {
  state.isPlaylist = false;
  state.videoInfo = data;

  thumbnailEl.src = data.thumbnail;
  thumbnailEl.alt = data.title;
  titleEl.textContent = data.title;
  channelEl.textContent = data.channel || '';
  durationEl.textContent = data.duration_string || formatDuration(data.duration);
  viewsEl.textContent = formatViews(data.view_count);

  state.format = 'mp4';
  btnMp4.classList.add('active');
  btnMp3.classList.remove('active');
  renderQualities(qualityGrid, data);

  resultEl.classList.remove('hidden');
  playlistResultEl.classList.add('hidden');
}

// ─── Show Playlist ──────────────────────────────────────────────────────────
function showPlaylist(data) {
  state.isPlaylist = true;
  state.playlistInfo = data;

  playlistTitleEl.textContent = data.title;
  playlistCountEl.textContent = `${data.count} vidéo${data.count > 1 ? 's' : ''}`;

  state.format = 'mp4';
  plBtnMp4.classList.add('active');
  plBtnMp3.classList.remove('active');
  renderQualities(plQualityGrid, data);

  // Render video list
  playlistVideosEl.innerHTML = '';
  data.videos.forEach((video, index) => {
    const item = createPlaylistItem(video, index);
    playlistVideosEl.appendChild(item);
  });

  resultEl.classList.add('hidden');
  playlistResultEl.classList.remove('hidden');
}

function createPlaylistItem(video, index) {
  const div = document.createElement('div');
  div.className = 'playlist-item glass';
  div.dataset.url = video.url;
  div.dataset.index = index;

  div.innerHTML = `
    <div class="playlist-item-number">${index + 1}</div>
    <div class="playlist-item-thumb">
      <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22><rect fill=%22%23111128%22 width=%2216%22 height=%229%22/></svg>'" />
      ${video.duration ? `<span class="duration-badge">${video.duration_string || formatDuration(video.duration)}</span>` : ''}
    </div>
    <div class="playlist-item-info">
      <h3 class="playlist-item-title">${video.title}</h3>
      <p class="playlist-item-channel">${video.channel || ''}</p>
    </div>
    <button class="btn btn-item-download" data-url="${video.url}" title="Télécharger">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
    <div class="playlist-item-progress hidden">
      <div class="mini-progress-bar">
        <div class="mini-progress-fill"></div>
      </div>
      <span class="mini-progress-text">0%</span>
    </div>
  `;

  // Per-item download button
  const dlBtn = div.querySelector('.btn-item-download');
  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadPlaylistItem(video.url, div);
  });

  return div;
}

// ─── Render Quality Chips ───────────────────────────────────────────────────
function renderQualities(gridEl, data) {
  gridEl.innerHTML = '';

  const qualities = state.format === 'mp4'
    ? (data?.videoQualities || [2160, 1440, 1080, 720, 480, 360])
    : (data?.audioQualities || [320, 256, 192, 128]);

  const labels = state.format === 'mp4'
    ? (q) => q >= 2160 ? '4K' : q >= 1440 ? '2K' : `${q}p`
    : (q) => `${q} kbps`;

  state.quality = qualities[0];

  qualities.forEach((q, i) => {
    const chip = document.createElement('button');
    chip.className = `quality-chip${i === 0 ? ' active' : ''}`;
    chip.textContent = labels(q);
    chip.dataset.quality = q;

    chip.addEventListener('click', () => {
      gridEl.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.quality = q;
    });

    gridEl.appendChild(chip);
  });
}

// ─── Format Toggle ──────────────────────────────────────────────────────────
function setFormat(format) {
  state.format = format;

  if (state.isPlaylist) {
    plBtnMp4.classList.toggle('active', format === 'mp4');
    plBtnMp3.classList.toggle('active', format === 'mp3');
    renderQualities(plQualityGrid, state.playlistInfo);
  } else {
    btnMp4.classList.toggle('active', format === 'mp4');
    btnMp3.classList.toggle('active', format === 'mp3');
    renderQualities(qualityGrid, state.videoInfo);
  }
}

// ─── Download Single Video ──────────────────────────────────────────────────
async function startDownload() {
  const videoUrl = state.videoInfo?.url || urlInput.value.trim();
  if (!videoUrl || !state.videoInfo) return;

  downloadProgress.classList.remove('hidden');
  downloadBtn.classList.add('downloading');
  downloadBtn.querySelector('span').textContent = 'Téléchargement en cours...';
  progressFill.style.width = '0%';
  progressText.textContent = 'Démarrage du téléchargement...';

  try {
    await performDownload(videoUrl, {
      onProgress: (pct, speed, eta) => {
        progressFill.style.width = `${pct}%`;
        let text = `Téléchargement... ${pct}%`;
        if (speed) text += ` — ${speed}`;
        if (eta) text += ` — ETA ${eta}`;
        progressText.textContent = text;
      },
      onConverting: () => {
        progressText.textContent = 'Conversion terminée, préparation du fichier...';
      },
      onSuccess: async (finalFile) => {
        progressFill.style.width = '100%';
        progressText.textContent = '✅ Téléchargement terminé !';
        setTimeout(resetSingleDownloadUI, 3000);
        try {
          await fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: finalFile })
          });
        } catch(e) {}
      },
      onError: (msg) => {
        showError(msg);
        resetSingleDownloadUI();
      }
    });
  } catch (err) {
    showError(err.message || 'Erreur lors du téléchargement.');
    resetSingleDownloadUI();
  }
}

function resetSingleDownloadUI() {
  downloadProgress.classList.add('hidden');
  downloadBtn.classList.remove('downloading');
  downloadBtn.querySelector('span').textContent = 'Télécharger';
  progressFill.style.width = '0%';
}

// ─── Download Playlist Item ─────────────────────────────────────────────────
async function downloadPlaylistItem(videoUrl, itemEl) {
  const dlBtn = itemEl.querySelector('.btn-item-download');
  const progressEl = itemEl.querySelector('.playlist-item-progress');
  const progressBar = itemEl.querySelector('.mini-progress-fill');
  const progressTextEl = itemEl.querySelector('.mini-progress-text');

  dlBtn.classList.add('hidden');
  progressEl.classList.remove('hidden');
  itemEl.classList.add('downloading');

  try {
    await performDownload(videoUrl, {
      onProgress: (pct) => {
        progressBar.style.width = `${pct}%`;
        progressTextEl.textContent = `${pct}%`;
      },
      onConverting: () => {
        progressTextEl.textContent = 'Conversion...';
      },
      onSuccess: (finalFile) => {
        progressBar.style.width = '100%';
        progressTextEl.textContent = '✅';
        itemEl.classList.remove('downloading');
        itemEl.classList.add('done');
      },
      onError: (msg) => {
        progressTextEl.textContent = '❌';
        itemEl.classList.remove('downloading');
        itemEl.classList.add('error');
        dlBtn.classList.remove('hidden');
        progressEl.classList.add('hidden');
      }
    });
  } catch (err) {
    progressTextEl.textContent = '❌';
    itemEl.classList.remove('downloading');
    dlBtn.classList.remove('hidden');
    progressEl.classList.add('hidden');
  }
}

// ─── Download All Playlist ──────────────────────────────────────────────────
async function downloadAllPlaylist() {
  if (!state.playlistInfo) return;

  downloadAllBtn.classList.add('downloading');
  downloadAllBtn.querySelector('span').textContent = 'Téléchargement en cours...';

  const items = playlistVideosEl.querySelectorAll('.playlist-item');

  for (const item of items) {
    if (item.classList.contains('done')) continue;

    const videoUrl = item.dataset.url;
    await downloadPlaylistItem(videoUrl, item);

    // Small delay between downloads
    await new Promise(r => setTimeout(r, 500));
  }

  downloadAllBtn.classList.remove('downloading');
  downloadAllBtn.querySelector('span').textContent = 'Tout télécharger';
  
  try {
    await fetch('/api/open-folder', { method: 'POST' });
  } catch(e) {}
}

// ─── Core Download Function ─────────────────────────────────────────────────
async function performDownload(videoUrl, callbacks) {
  // 1. Start download on server
  const startRes = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: videoUrl,
      format: state.format,
      quality: String(state.quality),
    }),
  });

  const startData = await startRes.json();

  if (!startRes.ok) {
    throw new Error(startData.error || 'Erreur lors du démarrage.');
  }

  const { downloadId } = startData;

  // 2. Poll progress
  const finalFile = await new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${downloadId}`);
        const data = await res.json();

        if (data.status === 'downloading') {
          const pct = Math.round(data.progress || 0);
          callbacks.onProgress(pct, data.speed, data.eta);

        } else if (data.status === 'done') {
          clearInterval(interval);
          callbacks.onConverting();
          resolve(data.finalFile);

        } else if (data.status === 'error') {
          clearInterval(interval);
          reject(new Error(data.error || 'Le téléchargement a échoué.'));
        }
      } catch (e) {
        clearInterval(interval);
        reject(e);
      }
    }, 800);
  });

  callbacks.onSuccess(finalFile);
}

// ─── Event Listeners ────────────────────────────────────────────────────────
fetchBtn.addEventListener('click', fetchVideoInfo);

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchVideoInfo();
});

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.focus();
  } catch {
    urlInput.focus();
  }
});

// Single video format buttons
btnMp4.addEventListener('click', () => setFormat('mp4'));
btnMp3.addEventListener('click', () => setFormat('mp3'));
downloadBtn.addEventListener('click', startDownload);

// Playlist format buttons
plBtnMp4.addEventListener('click', () => setFormat('mp4'));
plBtnMp3.addEventListener('click', () => setFormat('mp3'));
downloadAllBtn.addEventListener('click', downloadAllPlaylist);

// Auto-fetch on paste
urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    if (urlInput.value.trim()) {
      fetchVideoInfo();
    }
  }, 100);
});

// ─── Settings Events ────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.downloadDir) downloadDirInput.value = data.downloadDir;
  } catch(e) {}
}
loadSettings();

settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

settingsCancel.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
  loadSettings();
});

settingsSave.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadDir: downloadDirInput.value.trim() })
    });
    if (res.ok) settingsModal.classList.add('hidden');
    else alert('Erreur lors de la sauvegarde.');
  } catch(e) {
    alert('Erreur: ' + e.message);
  }
});
