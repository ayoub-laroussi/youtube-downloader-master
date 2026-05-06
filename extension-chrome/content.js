// ─── YT Downloader — Chrome Extension Content Script ────────────────────────
// Injects a "Download" button next to the share/like buttons on YouTube pages.

(function () {
  'use strict';

  const PROTOCOL = 'ytdownloader';
  const BUTTON_ID = 'ytdl-download-btn';

  // ─── Create the download button element ───────────────────────────────────
  function createDownloadButton() {
    const container = document.createElement('div');
    container.id = BUTTON_ID;
    container.className = 'ytdl-btn-container';

    const button = document.createElement('button');
    button.className = 'ytdl-btn';
    button.title = 'Télécharger avec YT Downloader';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ytdl-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    svg.appendChild(path);
    
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '7 10 12 15 17 10');
    svg.appendChild(polyline);
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '15');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '3');
    svg.appendChild(line);
    
    button.appendChild(svg);
    
    const span = document.createElement('span');
    span.className = 'ytdl-label';
    span.textContent = 'Télécharger';
    button.appendChild(span);
    
    container.appendChild(button);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'ytdl-tooltip';
    tooltip.textContent = 'Ouvrir dans YT Downloader';
    container.appendChild(tooltip);

    const btn = container.querySelector('.ytdl-btn');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDeepLink();
    });

    return container;
  }

  // ─── Trigger the deep link ────────────────────────────────────────────────
  function triggerDeepLink() {
    const videoUrl = window.location.href;
    const deepLink = `${PROTOCOL}://download?url=${encodeURIComponent(videoUrl)}`;
    console.log('[YT Downloader Extension] Deep link:', deepLink);

    // Visual feedback
    const btn = document.querySelector(`#${BUTTON_ID} .ytdl-btn`);
    if (btn) {
      btn.classList.add('ytdl-clicked');
      setTimeout(() => btn.classList.remove('ytdl-clicked'), 1500);
    }

    // Open the deep link
    window.location.href = deepLink;
  }

  // ─── Find the action bar and inject the button ────────────────────────────
  function injectButton() {
    // Don't inject if already present
    if (document.getElementById(BUTTON_ID)) return;

    // YouTube's action buttons container (like, share, etc.)
    // Try multiple selectors for YouTube's ever-changing DOM
    const selectors = [
      // Desktop: actions bar next to like/dislike/share
      '#top-level-buttons-computed',
      'ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed',
      '#actions #top-level-buttons-computed',
      // Fallback: the actions container itself
      '#actions-inner #menu #top-level-buttons-computed',
      // YouTube Music
      'ytmusic-menu-renderer',
    ];

    let targetContainer = null;
    for (const sel of selectors) {
      targetContainer = document.querySelector(sel);
      if (targetContainer) break;
    }

    if (!targetContainer) {
      console.log('[YT Downloader Extension] Action bar not found yet, will retry...');
      return false;
    }

    const btn = createDownloadButton();
    targetContainer.appendChild(btn);
    console.log('[YT Downloader Extension] Button injected!');
    return true;
  }

  // ─── Observe page navigation (YouTube is SPA) ─────────────────────────────
  let lastUrl = '';
  let retryCount = 0;
  const MAX_RETRIES = 20;

  function checkAndInject() {
    const currentUrl = window.location.href;

    // Only inject on video/watch pages
    const isVideoPage = /youtube\.com\/watch/.test(currentUrl) ||
                        /youtube\.com\/shorts/.test(currentUrl) ||
                        /music\.youtube\.com\/watch/.test(currentUrl);

    if (!isVideoPage) {
      // Remove button if we navigated away from a video page
      const existing = document.getElementById(BUTTON_ID);
      if (existing) existing.remove();
      return;
    }

    // If URL changed, remove old button and re-inject
    if (currentUrl !== lastUrl) {
      const existing = document.getElementById(BUTTON_ID);
      if (existing) existing.remove();
      lastUrl = currentUrl;
      retryCount = 0;
    }

    // Try to inject
    if (!document.getElementById(BUTTON_ID)) {
      const success = injectButton();
      if (!success && retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(checkAndInject, 500);
      }
    }
  }

  // ─── Initialize ───────────────────────────────────────────────────────────
  // Initial injection
  checkAndInject();

  // Watch for YouTube SPA navigation
  const observer = new MutationObserver(() => {
    checkAndInject();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen for yt-navigate-finish (YouTube custom event)
  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(checkAndInject, 500);
  });
})();
