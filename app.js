// ==========================================================================
// IBNU MASYRUF APP - CORE APPLICATION ENGINE
// ==========================================================================

import { radioStations } from './data/radios.js';
import { tvChannels } from './data/tvChannels.js';
import { kajianAudioList } from './data/kajianAudio.js';
import { kajianVideoList } from './data/kajianVideo.js';
import { mutiaraSalaf, dzikirPagiPetang } from './data/dzikir.js';
import { initSmartTarjim } from './js/smartTarjim.js';

// --- LOCALSTORAGE KEYS ---
const STORAGE_KEYS = {
  HISTORY: 'ibnumasyurf_history_v1',
  FAVORITES: 'ibnumasyurf_favs_v1',
  NOTES: 'ibnumasyurf_notes_v1',
  LAST_PLAYED: 'ibnumasyurf_last_played_v1',
  SETTINGS: 'ibnumasyurf_settings_v1'
};

// --- APPLICATION STATE ---
const state = {
  activeTab: 'tab-beranda',
  activeStorageSubtab: 'subtab-history',
  
  // Media Player State
  currentTrack: null, // { id, title, speaker, type: 'radio'|'audio'|'tv'|'video', url, backupUrl, logo, downloadUrl, duration }
  isPlaying: false,
  isConnecting: false,
  playbackSpeed: 1.0,
  volume: 0.9,
  isMuted: false,
  
  // Sleep Timer
  sleepTimerTimeout: null,
  sleepTimerInterval: null,
  sleepTimerSecondsLeft: 0,
  
  // Active TV
  activeTvId: 'rodja-tv',
  
  // Dzikir
  dzikirTime: 'pagi', // 'pagi' | 'petang'
  dzikirCounters: {},

  // Filters
  audioFilter: { speaker: 'all', category: 'all', search: '' },
  radioFilter: { region: 'all', search: '' },
  tvFilter: 'all',
  videoFilter: 'all',
  historyFilter: 'all',
  
  // Audio Visualizer
  visualizerAnimId: null
};

// ==========================================================================
// LOCALSTORAGE ENGINE METHODS
// ==========================================================================

function getStorageItem(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
}

// 1. Play History Engine
function saveToHistory(item) {
  if (!item || !item.id) return;
  const history = getStorageItem(STORAGE_KEYS.HISTORY, []);
  
  // Remove duplicate if already in history
  const filtered = history.filter(h => h.id !== item.id);
  
  const historyEntry = {
    id: item.id,
    title: item.title,
    speaker: item.speaker || item.name || '',
    type: item.type || 'audio',
    url: item.streamUrl || item.audioUrl || item.url || '',
    logo: item.logo || item.thumbnail || '',
    lastPlayedAt: new Date().toISOString(),
    playCount: (history.find(h => h.id === item.id)?.playCount || 0) + 1
  };
  
  // Prepend to top
  filtered.unshift(historyEntry);
  
  // Keep max 100 entries
  const trimmed = filtered.slice(0, 100);
  setStorageItem(STORAGE_KEYS.HISTORY, trimmed);
  
  // Also save as LAST_PLAYED for quick resume
  setStorageItem(STORAGE_KEYS.LAST_PLAYED, historyEntry);
  
  updateHistoryBadges();
  renderHistoryView();
  updateHeroLastPlayedBox();
}

function clearAllHistory() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat pemutaran dari LocalStorage?')) {
    setStorageItem(STORAGE_KEYS.HISTORY, []);
    localStorage.removeItem(STORAGE_KEYS.LAST_PLAYED);
    updateHistoryBadges();
    renderHistoryView();
    updateHeroLastPlayedBox();
    showToast('Seluruh riwayat berhasil dihapus.');
  }
}

function removeHistoryItem(id) {
  const history = getStorageItem(STORAGE_KEYS.HISTORY, []);
  const updated = history.filter(h => h.id !== id);
  setStorageItem(STORAGE_KEYS.HISTORY, updated);
  updateHistoryBadges();
  renderHistoryView();
  updateHeroLastPlayedBox();
}

// 2. Favorites Engine
function toggleFavorite(item) {
  if (!item || !item.id) return;
  const favorites = getStorageItem(STORAGE_KEYS.FAVORITES, []);
  const index = favorites.findIndex(f => f.id === item.id);
  
  let isFav = false;
  if (index > -1) {
    favorites.splice(index, 1);
    showToast(`Dihapus dari favorit: ${item.title || item.name}`);
  } else {
    favorites.unshift({
      id: item.id,
      title: item.title || item.name,
      speaker: item.speaker || item.pembina || item.tagline || '',
      type: item.type || (item.streamUrl ? 'radio' : (item.audioUrl ? 'audio' : 'tv')),
      url: item.streamUrl || item.audioUrl || item.url || '',
      logo: item.logo || item.thumbnail || '',
      addedAt: new Date().toISOString()
    });
    isFav = true;
    showToast(`Ditambahkan ke favorit: ${item.title || item.name}`);
  }
  
  setStorageItem(STORAGE_KEYS.FAVORITES, favorites);
  updateFavoritesBadges();
  renderFavoritesView();
  updateCardFavoriteIcons();
  return isFav;
}

function isFavorited(id) {
  const favorites = getStorageItem(STORAGE_KEYS.FAVORITES, []);
  return favorites.some(f => f.id === id);
}

function clearAllFavorites() {
  if (confirm('Hapus semua daftar favorit dari LocalStorage?')) {
    setStorageItem(STORAGE_KEYS.FAVORITES, []);
    updateFavoritesBadges();
    renderFavoritesView();
    updateCardFavoriteIcons();
    showToast('Seluruh favorit berhasil dikosongkan.');
  }
}

// 3. Faidah Notes Engine
function saveNote(noteData) {
  const notes = getStorageItem(STORAGE_KEYS.NOTES, []);
  const newNote = {
    id: noteData.id || `note-${Date.now()}`,
    title: noteData.title || 'Catatan Faidah Kajian',
    speaker: noteData.speaker || 'Kajian Sunnah',
    content: noteData.content || '',
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
  
  const existingIdx = notes.findIndex(n => n.id === newNote.id);
  if (existingIdx > -1) {
    notes[existingIdx] = newNote;
  } else {
    notes.unshift(newNote);
  }
  
  setStorageItem(STORAGE_KEYS.NOTES, notes);
  renderNotesView();
  showToast('Catatan faidah berhasil disimpan ke LocalStorage!');
}

function deleteNote(id) {
  if (confirm('Hapus catatan faidah ini?')) {
    const notes = getStorageItem(STORAGE_KEYS.NOTES, []);
    const updated = notes.filter(n => n.id !== id);
    setStorageItem(STORAGE_KEYS.NOTES, updated);
    renderNotesView();
    showToast('Catatan berhasil dihapus.');
  }
}

// ==========================================================================
// AUDIO PLAYER CONTROLLER
// ==========================================================================

const nativeAudio = document.getElementById('native-audio');

function setAudioConnectingState(isConnecting) {
  state.isConnecting = isConnecting;
  const ind = document.getElementById('player-connecting-indicator');
  const visWrap = document.getElementById('player-visualizer-wrap');
  const modalInd = document.getElementById('modal-connecting-indicator');
  const modalCanvas = document.getElementById('modal-visualizer-canvas');
  const playBtn = document.getElementById('player-btn-play');

  if (isConnecting) {
    if (ind) ind.classList.remove('hidden');
    if (visWrap) visWrap.classList.add('hidden');
    if (modalInd) modalInd.classList.remove('hidden');
    if (modalCanvas) modalCanvas.classList.add('hidden');
    if (playBtn) {
      playBtn.classList.add('is-connecting');
      playBtn.setAttribute('title', 'Menyambungkan siaran...');
    }
  } else {
    if (ind) ind.classList.add('hidden');
    if (visWrap) visWrap.classList.remove('hidden');
    if (modalInd) modalInd.classList.add('hidden');
    if (modalCanvas) modalCanvas.classList.remove('hidden');
    if (playBtn) {
      playBtn.classList.remove('is-connecting');
      playBtn.setAttribute('title', state.isPlaying ? 'Jeda' : 'Putar');
    }
  }
}

function playAudioTrack(trackData) {
  if (!trackData) return;
  
  state.currentTrack = trackData;
  saveToHistory(trackData);

  // Tampilkan indikator animasi menyambungkan
  setAudioConnectingState(true);

  // Set audio source
  const sourceUrl = trackData.streamUrl || trackData.audioUrl || trackData.url;
  nativeAudio.src = sourceUrl;
  nativeAudio.playbackRate = state.playbackSpeed;
  nativeAudio.volume = state.volume;
  
  const playPromise = nativeAudio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // Audio mulai terhubung
      updatePlayerUI();
      showToast(`Menyambungkan: ${trackData.title || trackData.name}`);
    }).catch(err => {
      console.warn('Autoplay prevented or stream error:', err);
      // Try backup stream if available
      if (trackData.backupUrl && trackData.backupUrl !== sourceUrl) {
        console.log('Trying backup stream URL:', trackData.backupUrl);
        setAudioConnectingState(true);
        nativeAudio.src = trackData.backupUrl;
        nativeAudio.play().then(() => {
          updatePlayerUI();
        }).catch(e => {
          setAudioConnectingState(false);
          console.error('Backup stream failed:', e);
        });
      } else {
        setAudioConnectingState(false);
      }
    });
  }

  updatePlayerUI();
}

function togglePlayPause() {
  if (!state.currentTrack) {
    // Default to Radio Rodja if nothing is loaded
    playRadioStation(radioStations[0]);
    return;
  }
  
  if (state.isPlaying) {
    nativeAudio.pause();
    state.isPlaying = false;
    stopAudioVisualizer();
  } else {
    nativeAudio.play().then(() => {
      state.isPlaying = true;
      startAudioVisualizer();
    }).catch(e => console.error(e));
  }
  updatePlayerUI();
}

function seekRelative(seconds) {
  if (!nativeAudio.duration || isNaN(nativeAudio.duration)) return;
  nativeAudio.currentTime = Math.max(0, Math.min(nativeAudio.duration, nativeAudio.currentTime + seconds));
}

function cyclePlaybackSpeed() {
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  const currentIdx = speeds.indexOf(state.playbackSpeed);
  const nextIdx = (currentIdx + 1) % speeds.length;
  state.playbackSpeed = speeds[nextIdx];
  nativeAudio.playbackRate = state.playbackSpeed;
  
  document.getElementById('player-btn-speed').textContent = `${state.playbackSpeed}x`;
  showToast(`Kecepatan putar: ${state.playbackSpeed}x`);
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  nativeAudio.muted = state.isMuted;
  document.getElementById('player-btn-mute').textContent = state.isMuted ? '🔇' : '🔊';
}

function updatePlayerUI() {
  const track = state.currentTrack;
  if (!track) return;
  
  const playBtn = document.getElementById('player-btn-play');
  playBtn.innerHTML = state.isPlaying ? '❚❚' : '▶';
  playBtn.setAttribute('title', state.isPlaying ? 'Jeda' : 'Putar');

  // Title and speaker
  const title = track.title || track.name;
  const speaker = track.speaker || track.pembina || track.slogan || '';
  
  document.getElementById('player-current-title').textContent = title;
  document.getElementById('player-current-speaker').textContent = speaker;
  
  // Badge Live vs On-Demand
  const badgeType = document.getElementById('player-badge-type');
  if (track.type === 'radio' || track.frequency) {
    badgeType.textContent = 'LIVE RADIO';
    badgeType.className = 'badge-mini live';
    document.getElementById('player-time-total').textContent = 'LIVE';
  } else {
    badgeType.textContent = 'KAJIAN MP3';
    badgeType.className = 'badge-mini audio';
  }

  // Thumb Icon
  const thumbIcon = document.getElementById('player-thumb-icon');
  thumbIcon.textContent = track.type === 'radio' ? '📻' : '🎙️';

  // Download button visibility
  const dlBtn = document.getElementById('player-btn-download');
  if (track.downloadUrl) {
    dlBtn.href = track.downloadUrl;
    dlBtn.classList.remove('hidden');
  } else {
    dlBtn.classList.add('hidden');
  }

  // Favorite button state
  const favBtn = document.getElementById('player-btn-favorite');
  favBtn.innerHTML = isFavorited(track.id) ? '★' : '☆';
  favBtn.classList.toggle('active', isFavorited(track.id));

  // Modal Player Details
  document.getElementById('modal-track-title').textContent = title;
  document.getElementById('modal-track-speaker').textContent = speaker;
  document.getElementById('modal-track-desc').textContent = track.description || track.slogan || 'Siaran kajian dan ceramah Islam.';
  document.getElementById('modal-cover-icon').textContent = thumbIcon.textContent;

  // Highlight active card
  document.querySelectorAll('.item-card, .track-row-card').forEach(el => {
    if (el.dataset.id === track.id) {
      el.classList.add('is-active-playing');
    } else {
      el.classList.remove('is-active-playing');
    }
  });
}

// Scrubber Timeline & Audio Events
nativeAudio.addEventListener('timeupdate', () => {
  const current = nativeAudio.currentTime;
  const duration = nativeAudio.duration;
  
  if (state.currentTrack && (state.currentTrack.type === 'radio' || state.currentTrack.frequency)) {
    document.getElementById('player-time-total').textContent = 'LIVE';
  } else if (duration && isFinite(duration) && !isNaN(duration)) {
    document.getElementById('player-time-total').textContent = formatSeconds(duration);
    const pct = (current / duration) * 100;
    document.getElementById('player-progress-fill').style.width = `${pct}%`;
    document.getElementById('player-progress-thumb').style.left = `${pct}%`;
  } else {
    document.getElementById('player-time-total').textContent = 'LIVE';
  }
  
  document.getElementById('player-time-current').textContent = formatSeconds(current);
});

nativeAudio.addEventListener('progress', () => {
  if (nativeAudio.buffered.length > 0 && nativeAudio.duration && isFinite(nativeAudio.duration)) {
    const bufferedEnd = nativeAudio.buffered.end(nativeAudio.buffered.length - 1);
    const pct = (bufferedEnd / nativeAudio.duration) * 100;
    document.getElementById('player-buffer-bar').style.width = `${pct}%`;
  }
});

// Audio lifecycle events for Connecting Animation
nativeAudio.addEventListener('loadstart', () => {
  setAudioConnectingState(true);
});

nativeAudio.addEventListener('waiting', () => {
  setAudioConnectingState(true);
});

nativeAudio.addEventListener('seeking', () => {
  setAudioConnectingState(true);
});

nativeAudio.addEventListener('canplay', () => {
  setAudioConnectingState(false);
});

nativeAudio.addEventListener('playing', () => {
  setAudioConnectingState(false);
  state.isPlaying = true;
  updatePlayerUI();
  startAudioVisualizer();
});

nativeAudio.addEventListener('pause', () => {
  setAudioConnectingState(false);
  state.isPlaying = false;
  updatePlayerUI();
  stopAudioVisualizer();
});

nativeAudio.addEventListener('ended', () => {
  setAudioConnectingState(false);
  state.isPlaying = false;
  updatePlayerUI();
  stopAudioVisualizer();
});

nativeAudio.addEventListener('error', (e) => {
  setAudioConnectingState(false);
  state.isPlaying = false;
  updatePlayerUI();
  stopAudioVisualizer();
  console.warn('Audio stream error event:', e);
});

// Click on Scrubber
document.getElementById('player-progress-container').addEventListener('click', (e) => {
  if (!nativeAudio.duration || isNaN(nativeAudio.duration)) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = clickX / rect.width;
  nativeAudio.currentTime = pct * nativeAudio.duration;
});

// Volume Slider
document.getElementById('player-volume-slider').addEventListener('input', (e) => {
  state.volume = parseFloat(e.target.value);
  nativeAudio.volume = state.volume;
  if (state.volume === 0) {
    document.getElementById('player-btn-mute').textContent = '🔇';
  } else {
    document.getElementById('player-btn-mute').textContent = '🔊';
  }
});

// Format seconds to mm:ss
function formatSeconds(sec) {
  if (sec === Infinity || !isFinite(sec)) return 'LIVE';
  if (isNaN(sec) || sec === null || sec < 0) return '00:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Simulated Dynamic Audio Visualizer
function startAudioVisualizer() {
  const canvas = document.getElementById('audio-visualizer-canvas');
  const modalCanvas = document.getElementById('modal-visualizer-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const mCtx = modalCanvas ? modalCanvas.getContext('2d') : null;
  const bars = 20;

  function renderWave() {
    if (!state.isPlaying) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mCtx) mCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    const barWidth = canvas.width / bars - 2;
    for (let i = 0; i < bars; i++) {
      // Dynamic simulated heights
      const h = Math.random() * (canvas.height - 4) + 4;
      const x = i * (barWidth + 2);
      const y = canvas.height - h;

      // Emerald to Gold gradient
      const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(1, '#34d399');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, h);

      if (mCtx) {
        const mBarWidth = modalCanvas.width / bars - 4;
        const mh = Math.random() * (modalCanvas.height - 8) + 8;
        const mx = i * (mBarWidth + 4);
        const my = modalCanvas.height - mh;

        const mGrad = mCtx.createLinearGradient(0, modalCanvas.height, 0, 0);
        mGrad.addColorStop(0, '#10b981');
        mGrad.addColorStop(1, '#f59e0b');
        mCtx.fillStyle = mGrad;
        mCtx.fillRect(mx, my, mBarWidth, mh);
      }
    }

    state.visualizerAnimId = requestAnimationFrame(renderWave);
  }

  cancelAnimationFrame(state.visualizerAnimId);
  renderWave();
}

function stopAudioVisualizer() {
  cancelAnimationFrame(state.visualizerAnimId);
  const canvas = document.getElementById('audio-visualizer-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ==========================================================================
// SLEEP TIMER CONTROLLER
// ==========================================================================

function setSleepTimer(minutes) {
  clearSleepTimer();
  state.sleepTimerSecondsLeft = minutes * 60;
  
  document.getElementById('timer-label').textContent = `${minutes}m`;
  showToast(`Sleep timer diaktifkan: ${minutes} menit`);
  
  state.sleepTimerInterval = setInterval(() => {
    state.sleepTimerSecondsLeft--;
    const minsLeft = Math.ceil(state.sleepTimerSecondsLeft / 60);
    document.getElementById('timer-label').textContent = `${minsLeft}m`;
    
    if (state.sleepTimerSecondsLeft <= 0) {
      clearSleepTimer();
      if (state.isPlaying) {
        nativeAudio.pause();
        state.isPlaying = false;
        updatePlayerUI();
        stopAudioVisualizer();
        showToast('Sleep timer selesai. Pemutaran dihentikan.');
      }
    }
  }, 1000);
  
  closeModal('modal-sleep-timer');
}

function clearSleepTimer() {
  if (state.sleepTimerInterval) clearInterval(state.sleepTimerInterval);
  state.sleepTimerInterval = null;
  state.sleepTimerSecondsLeft = 0;
  document.getElementById('timer-label').textContent = 'Off';
}

// ==========================================================================
// TV SUNNAH CONTROLLER (20 Saluran Live Streaming Mandiri - Bebas YouTube)
// ==========================================================================

let _hlsInstance = null;
let _currentTvStreamUrl = null;

function setTvStreamStatus(type, text) {
  const el = document.getElementById('tv-stream-status');
  const textEl = document.getElementById('tv-stream-status-text');
  if (!el || !textEl) return;
  el.className = 'tv-stream-status';
  el.classList.remove('hidden');
  el.classList.add(type);
  const dot = (type === 'live-hls' || type === 'live-web')
    ? '<span class="live-dot"></span>' : '';
  textEl.innerHTML = dot + ' ' + text;
}

function hideTvOfflineOverlay() {
  const overlay = document.getElementById('tv-offline-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function showTvOfflineOverlay(channel) {
  const overlay = document.getElementById('tv-offline-overlay');
  const titleEl = document.getElementById('tv-offline-title');
  const descEl = document.getElementById('tv-offline-desc');
  const siteBtn = document.getElementById('btn-tv-visit-site');
  if (!overlay) return;

  if (titleEl) titleEl.textContent = `Siaran ${channel.name} Sedang Menyiapkan Transmisi`;
  if (descEl) descEl.textContent = `Server sedang menghubungkan transmisi siaran live streaming (${channel.satelit}). Silakan coba sambungkan kembali atau kunjungi situs resmi stasiun.`;
  if (siteBtn) siteBtn.href = channel.website || '#';

  overlay.classList.remove('hidden');
  setTvStreamStatus('error', 'Siaran Sedang Menyiapkan Tautan');
}

function loadHlsStream(channel, streamUrl, autoPlay) {
  const video = document.getElementById('tv-video-player');
  const iframe = document.getElementById('tv-iframe-player');

  hideTvOfflineOverlay();

  // Bersihkan pemutar HLS sebelumnya
  if (_hlsInstance) {
    _hlsInstance.destroy();
    _hlsInstance = null;
  }

  video.style.display = 'block';
  iframe.style.display = 'none';
  iframe.src = '';

  _currentTvStreamUrl = streamUrl;
  setTvStreamStatus('loading', 'Menghubungkan ke siaran langsung...');

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 1000
    });
    _hlsInstance = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hideTvOfflineOverlay();
      if (autoPlay) {
        video.muted = true; // Diperlukan agar autoplay diizinkan browser policy
        video.play().catch(() => {});
      }
      setTvStreamStatus('live-hls', 'LIVE • HLS Stream');
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.warn('[HLS] Kendala transmisi pada stream:', streamUrl, data);
        hls.destroy();
        _hlsInstance = null;

        // Coba stream cadangan jika ada dan belum dicoba
        if (channel.backupStream && streamUrl !== channel.backupStream) {
          console.log('[HLS] Beralih ke stream cadangan:', channel.backupStream);
          loadHlsStream(channel, channel.backupStream, autoPlay);
          return;
        }

        // Coba web embed resmi jika ada (misal Castr)
        if (channel.webEmbed) {
          loadWebEmbed(channel, autoPlay);
          return;
        }

        // Tampilkan overlay rekoneksi ramah pengguna tanpa membuka YouTube
        showTvOfflineOverlay(channel);
      }
    });

  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari di iOS / macOS)
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => {
      hideTvOfflineOverlay();
      if (autoPlay) video.play().catch(() => {});
      setTvStreamStatus('live-hls', 'LIVE • HLS Stream');
    }, { once: true });
    video.addEventListener('error', () => {
      if (channel.backupStream && streamUrl !== channel.backupStream) {
        loadHlsStream(channel, channel.backupStream, autoPlay);
      } else if (channel.webEmbed) {
        loadWebEmbed(channel, autoPlay);
      } else {
        showTvOfflineOverlay(channel);
      }
    }, { once: true });

  } else {
    if (channel.webEmbed) {
      loadWebEmbed(channel, autoPlay);
    } else {
      showTvOfflineOverlay(channel);
    }
  }
}

function loadWebEmbed(channel, autoPlay) {
  const video = document.getElementById('tv-video-player');
  const iframe = document.getElementById('tv-iframe-player');

  hideTvOfflineOverlay();

  if (_hlsInstance) {
    _hlsInstance.destroy();
    _hlsInstance = null;
  }

  video.style.display = 'none';
  video.pause();
  video.src = '';

  iframe.style.display = 'block';
  iframe.src = channel.webEmbed;

  setTvStreamStatus('live-web', 'LIVE • Web Stream');
}

function switchTvChannel(channelId, autoPlay = true, notify = true) {
  const channel = tvChannels.find(c => c.id === channelId);
  if (!channel) return;

  state.activeTvId = channelId;

  if (autoPlay) {
    saveToHistory({
      id: channel.id,
      title: channel.name,
      speaker: channel.tagline,
      type: 'tv',
      url: channel.liveStream || channel.webEmbed,
      logo: channel.logo
    });
  }

  // Muat live stream utama
  if (channel.liveStream) {
    loadHlsStream(channel, channel.liveStream, autoPlay);
  } else if (channel.webEmbed) {
    loadWebEmbed(channel, autoPlay);
  } else {
    showTvOfflineOverlay(channel);
  }

  document.getElementById('current-tv-title').textContent = channel.name;
  document.getElementById('current-tv-origin').textContent = `${channel.origin} • Satelit: ${channel.satelit}`;
  document.getElementById('current-tv-desc').textContent = channel.description;
  document.getElementById('btn-tv-open-official').href = channel.website;

  // Update programs list
  const progUl = document.getElementById('current-tv-programs');
  progUl.innerHTML = channel.programs.map(p => `<li>${p}</li>`).join('');

  // Update Fav Icon
  const isFav = isFavorited(channel.id);
  document.getElementById('tv-fav-icon').textContent = isFav ? '★' : '☆';

  // Highlight in Grid
  document.querySelectorAll('.tv-channel-card').forEach(card => {
    if (card.dataset.id === channelId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  if (notify) {
    showToast(`▶ ${channel.name} – Siaran Langsung`);
  }
}

// ==========================================================================
// RENDERING VIEWS
// ==========================================================================

// 1. Render Beranda View
function renderHomeView() {
  // Radio Pilihan (Top 4)
  const homeRadioGrid = document.getElementById('home-radios-grid');
  const featuredRadios = radioStations.slice(0, 4);
  homeRadioGrid.innerHTML = featuredRadios.map(r => createRadioCardHtml(r)).join('');

  // TV Populer (Top 3)
  const homeTvGrid = document.getElementById('home-tv-grid');
  const featuredTv = tvChannels.slice(0, 3);
  homeTvGrid.innerHTML = featuredTv.map(t => createTvCardHtml(t)).join('');

  // Kajian Audio (Top 4)
  const homeAudioGrid = document.getElementById('home-audio-grid');
  const featuredAudio = kajianAudioList.slice(0, 4);
  homeAudioGrid.innerHTML = featuredAudio.map(a => createAudioCardHtml(a)).join('');

  updateHeroLastPlayedBox();
}

// 2. Render Full Radio List
function renderRadiosView() {
  const container = document.getElementById('radios-full-grid');
  const { region, search } = state.radioFilter;
  
  let list = radioStations;
  if (region !== 'all') {
    list = list.filter(r => r.region === region);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(r => 
      r.name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.pembina.toLowerCase().includes(q) ||
      r.frequency.toLowerCase().includes(q)
    );
  }

  document.getElementById('radio-count-display').textContent = `${list.length} Stasiun Ditemukan`;
  container.innerHTML = list.map(r => createRadioCardHtml(r)).join('');
}

// 3. Render 20 TV Channels
function renderTvChannelsView() {
  const container = document.getElementById('tv-channels-grid');
  let list = tvChannels;
  
  if (state.tvFilter !== 'all') {
    if (state.tvFilter === 'haramain') {
      list = list.filter(c => c.category.includes('Haramain') || c.id.includes('makkah') || c.id.includes('saudi'));
    } else if (state.tvFilter === 'kitab') {
      list = list.filter(c => c.category.includes('Kitab') || c.category.includes('Fatwa'));
    } else if (state.tvFilter === 'keluarga') {
      list = list.filter(c => c.category.includes('Keluarga') || c.category.includes('Dakwah') || c.category.includes('Pemuda'));
    } else if (state.tvFilter === 'pesantren') {
      list = list.filter(c => c.category.includes('Pesantren'));
    } else if (state.tvFilter === 'edukasi') {
      list = list.filter(c => c.category.includes('Edukasi') || c.category.includes('Bahasa') || c.category.includes('Pendidikan'));
    }
  }

  container.innerHTML = list.map(c => `
    <div class="tv-channel-card ${c.id === state.activeTvId ? 'active' : ''}" data-id="${c.id}">
      <div class="tv-chan-logo" style="border-left: 3px solid ${c.color}">
        ${c.id.includes('makkah') || c.id.includes('saudi') ? '🕋' : (c.category.includes('Edukasi') || c.category.includes('Bahasa') ? '📖' : '📺')}
      </div>
      <div class="tv-chan-meta">
        <h4>${c.name}</h4>
        <p>${c.tagline}</p>
        <span class="text-xs text-muted">${c.origin.split(',')[0]}</span>
      </div>
    </div>
  `).join('');

  // Click handler for TV channels
  container.querySelectorAll('.tv-channel-card').forEach(card => {
    card.addEventListener('click', () => {
      switchTvChannel(card.dataset.id);
    });
  });
}

// 4. Render Kajian Audio Tracks (Kajian.net)
function renderAudioView() {
  const container = document.getElementById('audio-tracks-container');
  const { speaker, category, search } = state.audioFilter;

  let list = kajianAudioList;
  if (speaker !== 'all') {
    list = list.filter(a => a.speakerKey === speaker);
  }
  if (category !== 'all') {
    list = list.filter(a => a.category.includes(category));
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(a => 
      a.title.toLowerCase().includes(q) ||
      a.speaker.toLowerCase().includes(q) ||
      a.album.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  }

  document.getElementById('audio-count-display').textContent = `Menampilkan ${list.length} Kajian`;
  
  if (list.length === 0) {
    container.innerHTML = `
      <div class="card-glass text-center p-8">
        <p class="text-muted">Tidak ada kajian yang cocok dengan filter pencarian Anda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(a => `
    <div class="track-row-card ${state.currentTrack?.id === a.id ? 'is-active-playing' : ''}" data-id="${a.id}">
      <button class="btn-track-play" data-action="play-audio" data-id="${a.id}">▶</button>
      <div class="track-meta">
        <h4>${a.title}</h4>
        <div class="track-meta-details">
          <span class="speaker-badge">${a.speaker}</span>
          <span class="category-badge">${a.category}</span>
          <span class="album-tag">📁 ${a.album}</span>
        </div>
      </div>
      <div class="track-extra-info">
        <span>⏱️ ${a.duration}</span>
        <span>💾 ${a.size}</span>
      </div>
      <div class="track-actions">
        <button class="btn-track-action" data-action="note-audio" data-id="${a.id}" title="Tulis Faidah">📝</button>
        <button class="btn-track-action ${isFavorited(a.id) ? 'text-gold' : ''}" data-action="fav-audio" data-id="${a.id}" title="Simpan ke Favorit">
          ${isFavorited(a.id) ? '★' : '☆'}
        </button>
        <a href="${a.downloadUrl}" target="_blank" download class="btn-track-action" title="Download MP3 Kajian.net">⬇️</a>
      </div>
    </div>
  `).join('');

  // Attach event listeners for audio track actions
  container.querySelectorAll('[data-action="play-audio"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = kajianAudioList.find(a => a.id === btn.dataset.id);
      if (track) playAudioTrack({ ...track, type: 'audio' });
    });
  });

  container.querySelectorAll('[data-action="fav-audio"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = kajianAudioList.find(a => a.id === btn.dataset.id);
      if (track) toggleFavorite({ ...track, type: 'audio' });
    });
  });

  container.querySelectorAll('[data-action="note-audio"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = kajianAudioList.find(a => a.id === btn.dataset.id);
      if (track) openNoteModal(track.title, track.speaker);
    });
  });
}

// 5. Render Video & Dei Kids
function renderVideosView() {
  const container = document.getElementById('videos-grid');
  let list = kajianVideoList;

  if (state.videoFilter !== 'all') {
    if (state.videoFilter === 'kids') {
      list = list.filter(v => v.isKids);
    } else {
      list = list.filter(v => v.category.includes(state.videoFilter));
    }
  }

  container.innerHTML = list.map(v => `
    <div class="item-card" data-id="${v.id}">
      <div>
        <div class="tv-card-thumb-wrap" data-ytid="${v.youtubeId}">
          <img src="${v.thumbnail}" alt="${v.title}" onerror="this.src='https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=500&q=80'">
          <div class="tv-thumb-overlay-play">▶</div>
        </div>
        <div class="mb-2">
          <span class="card-badge ${v.isKids ? 'gold' : 'emerald'}">${v.category}</span>
        </div>
        <h3 class="radio-title">${v.title}</h3>
        <p class="radio-slogan">${v.speaker} • ${v.channel}</p>
        <p class="text-xs text-muted mt-2">${v.description}</p>
      </div>
      <div class="radio-card-footer mt-3">
        <span class="text-xs text-muted">⏱️ ${v.duration}</span>
        <button class="btn-play-card" data-action="watch-video" data-id="${v.id}">Tonton Video</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-action="watch-video"], .tv-card-thumb-wrap').forEach(el => {
    el.addEventListener('click', (e) => {
      const card = e.currentTarget.closest('.item-card');
      const v = kajianVideoList.find(x => x.id === card.dataset.id);
      if (v) {
        playKajianVideo(v);
      }
    });
  });
}

function playKajianVideo(v) {
  if (!v) return;

  // Hentikan audio player jika sedang memutar siaran lain
  if (state.isPlaying) {
    audioElement.pause();
    state.isPlaying = false;
    updatePlayerBarUI();
  }

  // Hentikan video TV Sunnah jika sedang aktif
  const tvVideo = document.getElementById('tv-video-player');
  if (tvVideo && !tvVideo.paused) {
    tvVideo.pause();
  }

  const theaterWrapper = document.getElementById('video-theater-container');
  const iframe = document.getElementById('video-iframe-player');
  const titleEl = document.getElementById('current-video-title');
  const speakerEl = document.getElementById('current-video-speaker');
  const descEl = document.getElementById('current-video-desc');
  const categoryEl = document.getElementById('current-video-category');
  const durationEl = document.getElementById('current-video-duration');
  const viewsEl = document.getElementById('current-video-views');
  const btnShare = document.getElementById('btn-share-video-theater');

  if (theaterWrapper) {
    theaterWrapper.classList.remove('hidden');
    theaterWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (iframe) {
    iframe.src = `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0&enablejsapi=1`;
  }

  if (titleEl) titleEl.textContent = v.title;
  if (speakerEl) speakerEl.textContent = `${v.speaker} • ${v.channel}`;
  if (descEl) descEl.textContent = v.description;
  if (categoryEl) {
    categoryEl.textContent = v.category;
    categoryEl.className = `card-badge ${v.isKids ? 'gold' : 'emerald'}`;
  }
  if (durationEl) durationEl.textContent = `⏱️ ${v.duration}`;
  if (viewsEl) viewsEl.textContent = `👁️ ${v.views || 'Tersedia'}`;

  if (btnShare) {
    btnShare.onclick = () => {
      const shareText = `*Kajian Sunnah - Ibnu Masyruf App:*\n\n*${v.title}*\n${v.speaker} • ${v.channel}\nhttps://www.youtube.com/watch?v=${v.youtubeId}\n\n_Diputar via Ibnu Masyruf App_`;
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    };
  }

  saveToHistory({
    id: v.id,
    title: v.title,
    speaker: v.speaker,
    type: 'video',
    url: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    thumbnail: v.thumbnail
  });

  showToast(`Memutar video: ${v.title}`);
}

function closeVideoTheater() {
  const theaterWrapper = document.getElementById('video-theater-container');
  const iframe = document.getElementById('video-iframe-player');
  if (iframe) iframe.src = '';
  if (theaterWrapper) theaterWrapper.classList.add('hidden');
}

// 6. Render LocalStorage Engine Views (History, Favorites, Notes)
function renderHistoryView() {
  const container = document.getElementById('history-items-container');
  const history = getStorageItem(STORAGE_KEYS.HISTORY, []);
  
  let list = history;
  if (state.historyFilter !== 'all') {
    list = list.filter(h => h.type === state.historyFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card-glass text-center p-8">
        <p class="text-muted">Belum ada riwayat pemutaran. Putar salah satu radio, TV, atau audio kajian untuk menyimpannya di sini.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(h => {
    const dateFormatted = new Date(h.lastPlayedAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="history-row" data-id="${h.id}">
        <span class="history-type-tag">${h.type.toUpperCase()}</span>
        <div class="track-meta">
          <h4>${h.title}</h4>
          <p class="text-xs text-muted">${h.speaker} • Diputar ${h.playCount}x • Terakhir: ${dateFormatted}</p>
        </div>
        <button class="btn-play-mini" data-action="resume-history" data-id="${h.id}" title="Putar ulang">▶</button>
        <button class="btn-icon-subtle" data-action="delete-history" data-id="${h.id}" title="Hapus dari riwayat">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action="resume-history"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = history.find(h => h.id === btn.dataset.id);
      if (item) resumeItem(item);
    });
  });

  container.querySelectorAll('[data-action="delete-history"]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeHistoryItem(btn.dataset.id);
    });
  });
}

function renderFavoritesView() {
  const container = document.getElementById('favorites-items-container');
  const favorites = getStorageItem(STORAGE_KEYS.FAVORITES, []);

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="card-glass text-center p-8 w-full">
        <p class="text-muted">Belum ada item favorit. Tekan tombol bintang (☆) pada stasiun radio, saluran TV, atau kajian untuk menyimpannya.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = favorites.map(f => `
    <div class="item-card" data-id="${f.id}">
      <div>
        <div class="radio-card-header">
          <div class="radio-avatar-wrap">
            ${f.type === 'radio' ? '📻' : (f.type === 'tv' ? '📺' : '🎙️')}
          </div>
          <div class="radio-top-meta">
            <h3 class="radio-title">${f.title}</h3>
            <span class="card-badge emerald">${f.type.toUpperCase()}</span>
          </div>
          <button class="btn-card-fav active" data-action="unfav" data-id="${f.id}" title="Hapus dari favorit">★</button>
        </div>
        <p class="radio-slogan">${f.speaker}</p>
      </div>
      <div class="radio-card-footer mt-3">
        <button class="btn-play-card" data-action="play-fav" data-id="${f.id}">Putar Sekarang</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-action="unfav"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = favorites.find(f => f.id === btn.dataset.id);
      if (item) toggleFavorite(item);
    });
  });

  container.querySelectorAll('[data-action="play-fav"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = favorites.find(f => f.id === btn.dataset.id);
      if (item) resumeItem(item);
    });
  });
}

function renderNotesView() {
  const container = document.getElementById('notes-items-container');
  const notes = getStorageItem(STORAGE_KEYS.NOTES, []);

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="card-glass text-center p-8 w-full">
        <p class="text-muted">Belum ada catatan faidah. Tulis catatan faedah ilmu selama mendengarkan kajian melalui tombol 📝 atau 'Tulis Catatan Baru'.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div class="note-card card-glass" data-id="${n.id}">
      <div class="note-header">
        <div>
          <h4>${n.title}</h4>
          <span class="text-xs text-muted">${n.speaker}</span>
        </div>
        <button class="btn-icon-subtle" data-action="delete-note" data-id="${n.id}" title="Hapus catatan">✕</button>
      </div>
      <div class="note-body">${n.content}</div>
      <div class="note-footer">
        <span>📅 ${n.date}</span>
        <button class="btn-text" data-action="edit-note" data-id="${n.id}">Edit</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-action="delete-note"]').forEach(btn => {
    btn.addEventListener('click', () => deleteNote(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="edit-note"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const note = notes.find(x => x.id === btn.dataset.id);
      if (note) openNoteModal(note.title, note.speaker, note.content, note.id);
    });
  });
}

function updateHeroLastPlayedBox() {
  const lastPlayed = getStorageItem(STORAGE_KEYS.LAST_PLAYED, null);
  const box = document.getElementById('hero-last-played-box');
  const headerBtn = document.getElementById('btn-quick-resume');
  
  if (!lastPlayed) {
    box.classList.add('hidden');
    headerBtn.classList.add('hidden');
    return;
  }

  box.classList.remove('hidden');
  headerBtn.classList.remove('hidden');

  document.getElementById('hero-last-played-title').textContent = lastPlayed.title;
  document.getElementById('hero-last-played-subtitle').textContent = lastPlayed.speaker || `${lastPlayed.type.toUpperCase()}`;
  document.getElementById('hero-last-played-icon').textContent = lastPlayed.type === 'radio' ? '📻' : (lastPlayed.type === 'tv' ? '📺' : '🎙️');
  
  const timeFormatted = new Date(lastPlayed.lastPlayedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('hero-last-played-time').textContent = `Pukul ${timeFormatted}`;
}

function resumeItem(item) {
  if (item.type === 'radio') {
    const radio = radioStations.find(r => r.id === item.id) || item;
    playRadioStation(radio);
  } else if (item.type === 'audio') {
    const audio = kajianAudioList.find(a => a.id === item.id) || item;
    playAudioTrack({ ...audio, type: 'audio' });
  } else if (item.type === 'tv') {
    switchTab('tab-tv');
    switchTvChannel(item.id);
  } else if (item.type === 'video') {
    switchTab('tab-kajian-video');
    const v = kajianVideoList.find(x => x.id === item.id) || item;
    playKajianVideo(v);
  }
}

// 7. Render Dzikir View
function renderDzikirView() {
  const container = document.getElementById('dzikir-cards-container');
  container.innerHTML = dzikirPagiPetang.map(d => {
    const currentCount = state.dzikirCounters[d.id] ?? 0;
    const isCompleted = currentCount >= d.count;
    return `
      <div class="dzikir-card card-glass" data-id="${d.id}">
        <div class="dzikir-card-header">
          <h3 class="dzikir-title">${d.title}</h3>
          <span class="card-badge ${isCompleted ? 'emerald' : 'gold'}">
            Target: ${d.count}x
          </span>
        </div>
        <p class="dzikir-arabic">${d.arabic}</p>
        <p class="dzikir-latin">${d.latin}</p>
        <p class="dzikir-translation">${d.translation}</p>
        <div class="dzikir-benefit">
          <strong>Keutamaan Shahih:</strong> ${d.benefit}
        </div>
        <div class="dzikir-counter-bar">
          <span class="text-xs text-muted">Progres: ${currentCount} / ${d.count}x</span>
          <button class="btn-tasbih ${isCompleted ? 'completed' : ''}" data-action="count-dzikir" data-id="${d.id}">
            ${isCompleted ? '✓ Selesai' : `Hitung (+1)`}
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action="count-dzikir"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const dz = dzikirPagiPetang.find(x => x.id === id);
      if (!dz) return;

      const current = state.dzikirCounters[id] || 0;
      if (current < dz.count) {
        state.dzikirCounters[id] = current + 1;
        renderDzikirView();
        if (state.dzikirCounters[id] === dz.count) {
          showToast(`Alhamdulillah, ${dz.title} selesai dibaca!`);
        }
      }
    });
  });

  // Mutiara Salaf List
  const mutiaraContainer = document.getElementById('mutiara-salaf-list');
  mutiaraContainer.innerHTML = mutiaraSalaf.map(m => `
    <div class="card-glass p-6">
      <p class="quote-text text-sm">"${m.quote}"</p>
      <div class="quote-meta mt-3">
        <span class="scholar-name">${m.scholar}</span>
      </div>
      <span class="text-xs text-muted mt-1 block">${m.source}</span>
    </div>
  `).join('');
}

// ==========================================================================
// HTML TEMPLATE HELPERS
// ==========================================================================

function createRadioCardHtml(r) {
  const isFav = isFavorited(r.id);
  return `
    <div class="item-card" data-id="${r.id}">
      <div>
        <div class="radio-card-header">
          <div class="radio-avatar-wrap">
            📻
          </div>
          <div class="radio-top-meta">
            <h3 class="radio-title">${r.name}</h3>
            <span class="radio-freq">${r.frequency}</span>
            <span class="radio-city block">${r.city} (${r.region})</span>
          </div>
          <button class="btn-card-fav ${isFav ? 'active' : ''}" data-action="fav-radio" data-id="${r.id}" title="Favorit">
            ${isFav ? '★' : '☆'}
          </button>
        </div>

        <div class="radio-card-body">
          <p class="radio-slogan">"${r.slogan}"</p>
          <p class="radio-pembina"><strong>Pembina:</strong> ${r.pembina}</p>
        </div>
      </div>

      <div class="radio-card-footer">
        <button class="btn-play-card" data-action="play-radio" data-id="${r.id}">
          ▶ Putar Live
        </button>
        <a href="${r.website}" target="_blank" rel="noreferrer" class="btn-card-site">
          Web Resmi ↗
        </a>
      </div>
    </div>
  `;
}

function createTvCardHtml(t) {
  return `
    <div class="item-card" data-id="${t.id}">
      <div>
        <div class="tv-card-thumb-wrap" data-tvid="${t.id}">
          <div class="tv-thumb-overlay-play">▶</div>
        </div>
        <div class="mb-2">
          <span class="card-badge live">LIVE</span>
          <span class="card-badge gold">${t.category}</span>
        </div>
        <h3 class="radio-title">${t.name}</h3>
        <p class="radio-slogan">${t.tagline}</p>
        <p class="text-xs text-muted mt-2">${t.origin}</p>
      </div>
      <div class="radio-card-footer mt-3">
        <button class="btn-play-card" data-action="watch-tv" data-id="${t.id}">
          Tonton Saluran
        </button>
        <a href="${t.website}" target="_blank" rel="noreferrer" class="btn-card-site">
          Situs Resmi ↗
        </a>
      </div>
    </div>
  `;
}

function createAudioCardHtml(a) {
  const isFav = isFavorited(a.id);
  return `
    <div class="item-card" data-id="${a.id}">
      <div>
        <div class="mb-2 flex justify-between">
          <span class="card-badge emerald">${a.category}</span>
          <button class="btn-card-fav ${isFav ? 'active' : ''}" data-action="fav-audio" data-id="${a.id}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <h3 class="radio-title">${a.title}</h3>
        <p class="speaker-badge mt-1">${a.speaker}</p>
        <p class="text-xs text-muted mt-2">${a.description}</p>
      </div>
      <div class="radio-card-footer mt-3">
        <span class="text-xs text-muted">⏱️ ${a.duration}</span>
        <button class="btn-play-card" data-action="play-audio" data-id="${a.id}">
          ▶ Putar MP3
        </button>
      </div>
    </div>
  `;
}

function playRadioStation(station) {
  playAudioTrack({
    id: station.id,
    title: station.name,
    speaker: `${station.slogan} • ${station.city}`,
    type: 'radio',
    streamUrl: station.streamUrl,
    backupUrl: station.backupUrl,
    logo: station.logo,
    frequency: station.frequency
  });
}

function updateHistoryBadges() {
  const history = getStorageItem(STORAGE_KEYS.HISTORY, []);
  const badge = document.getElementById('history-badge-count');
  const countSpan = document.getElementById('count-history-badge');
  if (badge) {
    badge.textContent = history.length;
    badge.classList.toggle('hidden', history.length === 0);
  }
  if (countSpan) countSpan.textContent = history.length;
}

function updateFavoritesBadges() {
  const favorites = getStorageItem(STORAGE_KEYS.FAVORITES, []);
  const badge = document.getElementById('favorites-badge-count');
  const countSpan = document.getElementById('count-favorites-badge');
  if (badge) {
    badge.textContent = favorites.length;
    badge.classList.toggle('hidden', favorites.length === 0);
  }
  if (countSpan) countSpan.textContent = favorites.length;
}

function updateCardFavoriteIcons() {
  document.querySelectorAll('[data-action^="fav-"]').forEach(btn => {
    const id = btn.dataset.id;
    const isFav = isFavorited(id);
    btn.innerHTML = isFav ? '★' : '☆';
    btn.classList.toggle('active', isFav);
  });
}

// ==========================================================================
// TOAST NOTIFICATIONS & MODALS
// ==========================================================================

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}
window.showToast = showToast;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function openNoteModal(title = '', speaker = '', content = '', noteId = '') {
  document.getElementById('note-input-title').value = title;
  document.getElementById('note-input-speaker').value = speaker;
  document.getElementById('note-input-body').value = content;
  document.getElementById('note-modal-title').textContent = noteId ? '✍️ Edit Catatan Faidah' : '✍️ Tulis Catatan Faidah Baru';
  document.getElementById('btn-save-note').dataset.noteId = noteId;
  openModal('modal-note-editor');
}

// ==========================================================================
// NAVIGATION & ROUTING
// ==========================================================================

function switchTab(tabId) {
  state.activeTab = tabId;

  // Jika berpindah dari tab TV ke tab lain, hentikan/pause pemutar agar tidak bersuara di latar belakang
  if (tabId !== 'tab-tv') {
    // Pause HTML5 video (HLS)
    const video = document.getElementById('tv-video-player');
    if (video && !video.paused) {
      video.pause();
    }
    // Pause YouTube iframe jika sedang aktif
    const iframe = document.getElementById('tv-iframe-player');
    if (iframe && iframe.contentWindow && iframe.style.display !== 'none') {
      try {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } catch (err) {
        console.warn('Could not postMessage to iframe:', err);
      }
    }
  }

  // Jika berpindah dari tab Kajian Video ke tab lain, jeda video YouTube
  if (tabId !== 'tab-kajian-video') {
    const vIframe = document.getElementById('video-iframe-player');
    if (vIframe && vIframe.contentWindow && vIframe.src) {
      try {
        vIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } catch (err) {}
    }
  }

  // Update nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab sections
  document.querySelectorAll('.tab-section').forEach(sec => {
    if (sec.id === tabId) {
      sec.classList.add('active');
    } else {
      sec.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// SPLASH / LOADING SCREEN CONTROLLER
// ==========================================================================

function updateSplashProgress(percent, statusText) {
  const bar = document.getElementById('splash-progress-bar');
  const text = document.getElementById('splash-status-text');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (text && statusText) {
    text.style.opacity = '0';
    setTimeout(() => {
      text.textContent = statusText;
      text.style.opacity = '1';
    }, 120);
  }
}

let _splashDismissed = false;
function dismissSplashScreen() {
  if (_splashDismissed) return;
  _splashDismissed = true;
  
  const splash = document.getElementById('app-splash-screen');
  if (!splash) return;

  updateSplashProgress(100, 'Selamat Datang di Ibnu Masyruf App');

  // Beri jeda 700ms agar status 100% dan animasi icon dinikmati pengguna
  setTimeout(() => {
    splash.classList.add('splash-fading');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 850);
  }, 700);
}

function startSplashScreenSequence() {
  // Rangkaian animasi loading bertahap (~2.8 detik total durasi optimal)
  updateSplashProgress(18, 'Menyiapkan media dakwah & belajar...');

  setTimeout(() => {
    updateSplashProgress(45, 'Menghubungkan 20 saluran TV & 23 radio sunnah...');
  }, 750);

  setTimeout(() => {
    updateSplashProgress(72, 'Menyiapkan arsip ceramah & audio ilmiah...');
  }, 1500);

  setTimeout(() => {
    updateSplashProgress(92, 'Menghubungkan pustaka faidah & dzikir...');
  }, 2250);

  setTimeout(() => {
    dismissSplashScreen();
  }, 2900);
}

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================

function initApp() {
  console.log('Initializing Ibnu Masyruf App...');
  
  // Jalankan animasi splash screen berdurasi terencana
  startSplashScreenSequence();

  // 1. Populate Asatidzah & Category options in Audio Filter
  const speakerSelect = document.getElementById('select-speaker');
  const uniqueSpeakers = [...new Set(kajianAudioList.map(a => a.speakerKey))];
  uniqueSpeakers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    speakerSelect.appendChild(opt);
  });

  const categorySelect = document.getElementById('select-category');
  const allCategories = ['Aqidah', 'Manhaj', 'Fiqih', 'Muamalah', 'Tazkiyatun Nufus', 'Sirah', 'Syarah Hadits', 'Wanita & Keluarga'];
  allCategories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  });

  updateSplashProgress(65, 'Menyiapkan arsip audio & video...');

  // 2. Initial Render of all views
  renderHomeView();
  renderRadiosView();
  renderTvChannelsView();
  renderAudioView();
  renderVideosView();
  renderHistoryView();
  renderFavoritesView();
  renderNotesView();
  renderDzikirView();
  updateHistoryBadges();
  updateFavoritesBadges();

  updateSplashProgress(85, 'Menghubungkan pustaka & faidah...');

  // Initialize TV player default (tanpa autoplay, tanpa simpan riwayat & tanpa toast saat inisialisasi awal)
  switchTvChannel('rodja-tv', false, false);

  // 3. Tab switching listeners
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-brand-home').addEventListener('click', () => switchTab('tab-beranda'));
  document.getElementById('btn-see-all-radios').addEventListener('click', () => switchTab('tab-radio'));
  document.getElementById('btn-see-all-tv').addEventListener('click', () => switchTab('tab-tv'));
  document.getElementById('btn-see-all-audio').addEventListener('click', () => switchTab('tab-kajian-audio'));

  // Hero Quick Buttons
  document.getElementById('btn-hero-play-radio').addEventListener('click', () => {
    playRadioStation(radioStations[0]); // Radio Rodja
  });
  document.getElementById('btn-hero-watch-tv').addEventListener('click', () => {
    switchTab('tab-tv');
    switchTvChannel('rodja-tv');
  });
  document.getElementById('btn-hero-browse-audio').addEventListener('click', () => {
    switchTab('tab-kajian-audio');
  });
  const btnHeroOpenTarjim = document.getElementById('btn-hero-open-tarjim');
  if (btnHeroOpenTarjim) {
    btnHeroOpenTarjim.addEventListener('click', () => switchTab('tab-smart-tarjim'));
  }
  const btnHomeLaunchTarjim = document.getElementById('btn-home-launch-tarjim');
  if (btnHomeLaunchTarjim) {
    btnHomeLaunchTarjim.addEventListener('click', () => switchTab('tab-smart-tarjim'));
  }

  // Tombol tutup pemutar video kajian
  const btnCloseVideo = document.getElementById('btn-close-video-theater');
  if (btnCloseVideo) {
    btnCloseVideo.addEventListener('click', closeVideoTheater);
  }

  // Initialize Smart Tarjim AI Module
  initSmartTarjim();

  // Header quick buttons
  document.getElementById('btn-header-history').addEventListener('click', () => {
    switchTab('tab-riwayat');
    document.querySelector('.subtab-btn[data-subtab="subtab-history"]').click();
  });
  document.getElementById('btn-header-favorites').addEventListener('click', () => {
    switchTab('tab-riwayat');
    document.querySelector('.subtab-btn[data-subtab="subtab-favorites"]').click();
  });
  document.getElementById('btn-quick-resume').addEventListener('click', () => {
    const lastPlayed = getStorageItem(STORAGE_KEYS.LAST_PLAYED, null);
    if (lastPlayed) resumeItem(lastPlayed);
  });
  document.getElementById('hero-btn-resume').addEventListener('click', () => {
    const lastPlayed = getStorageItem(STORAGE_KEYS.LAST_PLAYED, null);
    if (lastPlayed) resumeItem(lastPlayed);
  });

  // Global Search Input
  const globalSearchInput = document.getElementById('global-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');

  globalSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    btnClearSearch.classList.toggle('hidden', !val);
    
    // Propagate search to active views
    state.audioFilter.search = val;
    state.radioFilter.search = val;
    renderAudioView();
    renderRadiosView();
  });

  btnClearSearch.addEventListener('click', () => {
    globalSearchInput.value = '';
    btnClearSearch.classList.add('hidden');
    state.audioFilter.search = '';
    state.radioFilter.search = '';
    renderAudioView();
    renderRadiosView();
  });

  // Audio Filters Listeners
  document.getElementById('select-speaker').addEventListener('change', (e) => {
    state.audioFilter.speaker = e.target.value;
    renderAudioView();
  });
  document.getElementById('select-category').addEventListener('change', (e) => {
    state.audioFilter.category = e.target.value;
    renderAudioView();
  });
  document.getElementById('input-audio-search').addEventListener('input', (e) => {
    state.audioFilter.search = e.target.value;
    renderAudioView();
  });
  document.getElementById('btn-reset-audio-filter').addEventListener('click', () => {
    state.audioFilter = { speaker: 'all', category: 'all', search: '' };
    document.getElementById('select-speaker').value = 'all';
    document.getElementById('select-category').value = 'all';
    document.getElementById('input-audio-search').value = '';
    renderAudioView();
  });

  // Radio Filters Listeners
  document.getElementById('radio-region-select').addEventListener('change', (e) => {
    state.radioFilter.region = e.target.value;
    renderRadiosView();
  });
  document.getElementById('radio-filter-search').addEventListener('input', (e) => {
    state.radioFilter.search = e.target.value;
    renderRadiosView();
  });

  // TV Filter Pills
  document.querySelectorAll('#tv-filter-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tv-filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tvFilter = btn.dataset.filter;
      renderTvChannelsView();
    });
  });

  // Video Filter Pills
  document.querySelectorAll('#video-filter-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#video-filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.videoFilter = btn.dataset.vfilter;
      renderVideosView();
    });
  });

  // Storage Subtabs Listeners
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.subtab).classList.add('active');
    });
  });

  // History Filter Pills
  document.querySelectorAll('#history-filter-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#history-filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.historyFilter = btn.dataset.hfilter;
      renderHistoryView();
    });
  });

  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);
  document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);
  document.getElementById('btn-add-new-note').addEventListener('click', () => openNoteModal());

  // Mutiara quote cycler
  let quoteIdx = 0;
  document.getElementById('btn-next-quote').addEventListener('click', () => {
    quoteIdx = (quoteIdx + 1) % mutiaraSalaf.length;
    const q = mutiaraSalaf[quoteIdx];
    document.getElementById('quote-text').textContent = `"${q.quote}"`;
    document.getElementById('quote-scholar').textContent = q.scholar;
    document.getElementById('quote-source').textContent = q.source;
  });

  // Dzikir Mode Switcher
  document.getElementById('btn-dzikir-pagi').addEventListener('click', () => {
    document.getElementById('btn-dzikir-pagi').classList.add('active');
    document.getElementById('btn-dzikir-petang').classList.remove('active');
    state.dzikirTime = 'pagi';
    renderDzikirView();
  });
  document.getElementById('btn-dzikir-petang').addEventListener('click', () => {
    document.getElementById('btn-dzikir-petang').classList.add('active');
    document.getElementById('btn-dzikir-pagi').classList.remove('active');
    state.dzikirTime = 'petang';
    renderDzikirView();
  });

  // TV Theater Mode Toggle
  document.getElementById('btn-tv-theater-mode').addEventListener('click', () => {
    const wrap = document.querySelector('.tv-theater-container');
    wrap.classList.toggle('theater-fullscreen');
    showToast('Mode bioskop diperbarui');
  });

  // TV Retry Stream Button (pada overlay rekoneksi)
  const btnTvRetry = document.getElementById('btn-tv-retry-stream');
  if (btnTvRetry) {
    btnTvRetry.addEventListener('click', () => {
      if (state.activeTvId) {
        showToast('Menghubungkan ulang siaran live...');
        switchTvChannel(state.activeTvId, true, false);
      }
    });
  }

  document.getElementById('btn-tv-fav-toggle').addEventListener('click', () => {
    const chan = tvChannels.find(c => c.id === state.activeTvId);
    if (chan) {
      const isFav = toggleFavorite({ ...chan, type: 'tv' });
      document.getElementById('tv-fav-icon').textContent = isFav ? '★' : '☆';
    }
  });

  // Global delegate clicks for dynamically added cards
  document.addEventListener('click', (e) => {
    // Play Radio card
    const playRadioBtn = e.target.closest('[data-action="play-radio"]');
    if (playRadioBtn) {
      const radio = radioStations.find(r => r.id === playRadioBtn.dataset.id);
      if (radio) playRadioStation(radio);
      return;
    }

    // Fav Radio
    const favRadioBtn = e.target.closest('[data-action="fav-radio"]');
    if (favRadioBtn) {
      const radio = radioStations.find(r => r.id === favRadioBtn.dataset.id);
      if (radio) toggleFavorite({ ...radio, type: 'radio' });
      return;
    }

    // Watch TV card
    const watchTvBtn = e.target.closest('[data-action="watch-tv"]');
    if (watchTvBtn) {
      switchTab('tab-tv');
      switchTvChannel(watchTvBtn.dataset.id);
      return;
    }

    // Play Audio card on Home
    const playAudioBtn = e.target.closest('[data-action="play-audio"]');
    if (playAudioBtn && !playAudioBtn.closest('#audio-tracks-container')) {
      const track = kajianAudioList.find(a => a.id === playAudioBtn.dataset.id);
      if (track) playAudioTrack({ ...track, type: 'audio' });
      return;
    }
  });

  // Sticky Player Bar controls
  document.getElementById('player-btn-play').addEventListener('click', togglePlayPause);
  document.getElementById('player-btn-rewind').addEventListener('click', () => seekRelative(-10));
  document.getElementById('player-btn-forward').addEventListener('click', () => seekRelative(10));
  document.getElementById('player-btn-speed').addEventListener('click', cyclePlaybackSpeed);
  document.getElementById('player-btn-mute').addEventListener('click', toggleMute);
  document.getElementById('player-btn-favorite').addEventListener('click', () => {
    if (state.currentTrack) toggleFavorite(state.currentTrack);
  });

  // Expand Player Modal
  const expandPlayer = () => openModal('modal-expanded-player');
  document.getElementById('btn-expand-player').addEventListener('click', expandPlayer);
  document.getElementById('btn-expand-player-text').addEventListener('click', expandPlayer);
  document.getElementById('player-btn-maximize').addEventListener('click', expandPlayer);
  document.getElementById('btn-close-expanded-player').addEventListener('click', () => closeModal('modal-expanded-player'));

  // Sleep Timer Modal
  document.getElementById('player-btn-timer').addEventListener('click', () => openModal('modal-sleep-timer'));
  document.getElementById('btn-close-timer-modal').addEventListener('click', () => closeModal('modal-sleep-timer'));
  document.getElementById('btn-cancel-timer').addEventListener('click', () => {
    clearSleepTimer();
    closeModal('modal-sleep-timer');
    showToast('Sleep timer dinonaktifkan.');
  });
  document.querySelectorAll('.btn-timer-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setSleepTimer(parseInt(btn.dataset.minutes));
    });
  });

  // Notes Modal save
  document.getElementById('btn-close-note-modal').addEventListener('click', () => closeModal('modal-note-editor'));
  document.getElementById('btn-cancel-note').addEventListener('click', () => closeModal('modal-note-editor'));
  document.getElementById('btn-save-note').addEventListener('click', (e) => {
    const title = document.getElementById('note-input-title').value.trim();
    const speaker = document.getElementById('note-input-speaker').value.trim();
    const content = document.getElementById('note-input-body').value.trim();
    const noteId = e.currentTarget.dataset.noteId;

    if (!title || !content) {
      alert('Judul dan isi catatan tidak boleh kosong.');
      return;
    }

    saveNote({ id: noteId, title, speaker, content });
    closeModal('modal-note-editor');
  });

  // Notes inside Expanded Player
  document.getElementById('btn-save-current-note').addEventListener('click', () => {
    const text = document.getElementById('modal-note-textarea').value.trim();
    if (!text) {
      alert('Catatan belum diisi.');
      return;
    }
    const track = state.currentTrack;
    saveNote({
      title: track ? `Faidah: ${track.title || track.name}` : 'Catatan Kajian',
      speaker: track ? (track.speaker || '') : '',
      content: text
    });
    document.getElementById('note-save-status').textContent = '✓ Tersimpan di LocalStorage';
  });

  // Handle URL hash navigation (e.g. from PWA shortcuts)
  const hashRoutes = {
    '#radio': 'tab-radio',
    '#tv': 'tab-tv',
    '#audio': 'tab-kajian-audio',
    '#video': 'tab-video',
    '#riwayat': 'tab-riwayat',
    '#history': 'tab-riwayat',
    '#dzikir': 'tab-dzikir'
  };
  const currentHash = window.location.hash;
  if (currentHash && hashRoutes[currentHash]) {
    switchTab(hashRoutes[currentHash]);
  }

  // Initialize PWA Features
  registerServiceWorker();
  initPWAInstall();
  initNetworkStatusMonitor();

  // Safety timeout jika ada keterlambatan di perangkat tertentu
  setTimeout(() => {
    dismissSplashScreen();
  }, 4500);

  console.log('Ibnu Masyruf App is ready!');
}

// ==========================================================================
// PWA (PROGRESSIVE WEB APP) ENGINE
// ==========================================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          console.log('[PWA] Service Worker terdaftar dengan scope:', reg.scope);

          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showToast('Pembaruan Ibnu Masyruf App tersedia!');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Pendaftaran Service Worker gagal:', err);
        });
    });
  }
}

let deferredInstallPrompt = null;

function initPWAInstall() {
  const btnInstall = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstall) {
      btnInstall.classList.remove('hidden');
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log(`[PWA] Install prompt outcome: ${outcome}`);
      if (outcome === 'accepted') {
        showToast('Terima kasih! Ibnu Masyruf App sedang diinstal...');
      }
      deferredInstallPrompt = null;
      btnInstall.classList.add('hidden');
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Ibnu Masyruf App sukses diinstal');
    if (btnInstall) btnInstall.classList.add('hidden');
    showToast('Alhamdulillah! Aplikasi berhasil diinstal ke perangkat Anda.');
  });
}

function initNetworkStatusMonitor() {
  const offlineBanner = document.getElementById('offline-banner');

  function updateStatus() {
    if (navigator.onLine) {
      if (offlineBanner) offlineBanner.classList.add('hidden');
    } else {
      if (offlineBanner) offlineBanner.classList.remove('hidden');
      showToast('⚠️ Anda sedang offline. Fitur streaming radio/TV memerlukan internet.');
    }
  }

  window.addEventListener('online', () => {
    updateStatus();
    showToast('✅ Koneksi internet kembali aktif!');
  });
  window.addEventListener('offline', updateStatus);

  if (!navigator.onLine && offlineBanner) {
    offlineBanner.classList.remove('hidden');
  }
}

// Start application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
