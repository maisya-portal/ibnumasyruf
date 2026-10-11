// ==========================================================================
// SMART TARJIM - ARABIC AI TRANSLATOR & ISLAMIC KNOWLEDGE ASSISTANT
// Integrated into Ibnu Masyruf App (Powered by Tarjim-AI Engine)
// ==========================================================================

const API_CONFIG = {
  ENDPOINT: 'https://erkrxuqjjovtzxisnllj.supabase.co/functions/v1/translate',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVya3J4dXFqam92dHp4aXNubGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NzY2OTQsImV4cCI6MjA5MDE1MjY5NH0.bIk7UygInWQkceYYBcMkrzHnNeqT7S2Uss3yAQWuy0k',
  STORAGE_HISTORY: 'ibnumasyruf_smart_tarjim_history_v1',
  STORAGE_CHAT: 'ibnumasyruf_smart_tarjim_chat_v1'
};

// In-Memory State
const tarjimState = {
  activeSubtab: 'subtab-translate',
  sourceLang: 'auto',
  targetLang: 'id',
  selectedExplanations: ['nahwushorof'], // default explanation topic
  isTranslating: false,
  isChatting: false,
  isScanning: false,
  history: [],
  chatMessages: [
    {
      role: 'assistant',
      content: 'Ahlan wa sahlan! Saya **Salluni** (اسألني), asisten cerdas bahasa Arab & studi Islam di **Smart Tarjim**.\n\nAnda dapat bertanya seputar:\n* **Kaidah Nahwu & Shorof** (I\'rab, wazan kata, susunan kalimat)\n* **Kosakata & Makna Kitab Kuning**\n* **Faidah Hadits & Mufradat Al-Qur\'an**\n* **Latihan Percakapan Bahasa Arab**\n\nSilakan ajukan pertanyaan Anda di bawah ini!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]
};

// ==========================================================================
// UTILITY FUNCTIONS: MARKDOWN RENDERER & SANITIZATION
// ==========================================================================

/**
 * Lightweight Markdown-to-HTML converter tailored for Arabic & Islamic text.
 */
export function renderMarkdown(md) {
  if (!md) return '';
  
  let html = md
    // Escape standard HTML tags for safety
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore blockquotes that were escaped (> became &gt;)
  html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote class="tarjim-quote">$1</blockquote>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="tarjim-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="tarjim-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="tarjim-h2">$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Bullet points
  html = html.replace(/^\* (.*$)/gim, '<li class="tarjim-li">$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li class="tarjim-li">$1</li>');
  html = html.replace(/(<li class="tarjim-li">.*<\/li>)/gms, '<ul class="tarjim-ul">$1</ul>');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="tarjim-link">$1 ↗</a>');

  // Detect Arabic paragraphs & wrap with Arabic typography styling
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    // If line contains significant Arabic characters
    if (/[\u0600-\u06FF]/.test(line) && !line.startsWith('<h') && !line.startsWith('<ul') && !line.startsWith('<li')) {
      return `<div class="tarjim-arabic-block">${line}</div>`;
    }
    return line;
  });

  return processedLines.join('<br>').replace(/(<br>\s*)+/g, '<br>');
}

/**
 * Check if text contains Arabic characters
 */
function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

// ==========================================================================
// TEXT-TO-SPEECH (TTS) AUDIO SYNTHESIZER
// ==========================================================================

export function speakText(text, preferredLang = 'ar-SA') {
  if (!('speechSynthesis' in window)) {
    if (window.showToast) window.showToast('Fitur suara tidak didukung browser ini', 'info');
    return;
  }

  // Stop any currently playing audio
  window.speechSynthesis.cancel();

  // Strip Markdown markers and symbols
  const cleanText = text
    .replace(/[#*`_>~\[\]\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const langCode = isArabic(cleanText) ? 'ar-SA' : (preferredLang || 'id-ID');
  utterance.lang = langCode;
  utterance.rate = langCode.startsWith('ar') ? 0.85 : 0.95; // Slightly slower for clear Arabic pronunciation

  // Find preferred voice if available
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith(langCode.slice(0, 2)));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

// ==========================================================================
// CORE API CALLER WITH STREAMING PARSING
// ==========================================================================

async function callTarjimStream(payload, onChunk, onDone, onError) {
  try {
    const response = await fetch(API_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server status ${response.status}: ${errText.slice(0, 100)}`);
    }

    // Process ReadableStream if supported
    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line for next iteration

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              onChunk(accumulated, delta);
            }
          } catch (e) {
            // Ignore parse errors on split chunks
          }
        }
      }

      onDone(accumulated);
      return accumulated;
    } else {
      // Fallback: full text response
      const fullText = await response.text();
      const lines = fullText.split('\n').filter(l => l.startsWith('data: '));
      let accumulated = '';

      for (const line of lines) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          accumulated += parsed.choices?.[0]?.delta?.content || '';
        } catch (e) {}
      }

      onChunk(accumulated, accumulated);
      onDone(accumulated);
      return accumulated;
    }
  } catch (err) {
    console.error('Smart Tarjim API Error:', err);
    onError(err);
  }
}

// ==========================================================================
// LOCAL STORAGE HISTORY MANAGEMENT
// ==========================================================================

function loadTarjimHistory() {
  try {
    const raw = localStorage.getItem(API_CONFIG.STORAGE_HISTORY);
    tarjimState.history = raw ? JSON.parse(raw) : [];
  } catch (e) {
    tarjimState.history = [];
  }
}

function saveTarjimHistoryItem(sourceText, translatedText, mode = 'sentence') {
  if (!sourceText || !translatedText) return;
  
  const newItem = {
    id: 'st_' + Date.now(),
    sourceText: sourceText.trim(),
    translatedText: translatedText.trim(),
    mode,
    sourceLang: tarjimState.sourceLang,
    targetLang: tarjimState.targetLang,
    timestamp: new Date().toISOString()
  };

  // Prepend, prevent duplicate of latest
  if (tarjimState.history.length > 0 && tarjimState.history[0].sourceText === newItem.sourceText) {
    tarjimState.history[0] = newItem;
  } else {
    tarjimState.history.unshift(newItem);
  }

  // Keep max 50 items
  if (tarjimState.history.length > 50) {
    tarjimState.history = tarjimState.history.slice(0, 50);
  }

  try {
    localStorage.setItem(API_CONFIG.STORAGE_HISTORY, JSON.stringify(tarjimState.history));
  } catch (e) {}

  renderHistoryList();
}

function deleteHistoryItem(id) {
  tarjimState.history = tarjimState.history.filter(item => item.id !== id);
  try {
    localStorage.setItem(API_CONFIG.STORAGE_HISTORY, JSON.stringify(tarjimState.history));
  } catch (e) {}
  renderHistoryList();
  if (window.showToast) window.showToast('Riwayat terjemahan dihapus', 'info');
}

function clearAllHistory() {
  tarjimState.history = [];
  try {
    localStorage.removeItem(API_CONFIG.STORAGE_HISTORY);
  } catch (e) {}
  renderHistoryList();
  if (window.showToast) window.showToast('Semua riwayat terjemahan telah dibersihkan', 'info');
}

// ==========================================================================
// SUBTAB SWITCHING CONTROLLER
// ==========================================================================

export function switchTarjimSubtab(subtabId) {
  tarjimState.activeSubtab = subtabId;

  // Update subtab buttons
  document.querySelectorAll('.tarjim-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subtab === subtabId);
  });

  // Update panels
  document.querySelectorAll('.tarjim-subtab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === subtabId);
  });
}

// ==========================================================================
// TRANSLATE FEATURE ENGINE (TEXT & AUTO-HARAKAT)
// ==========================================================================

export async function executeTranslate() {
  const inputEl = document.getElementById('tarjim-input-text');
  const resultContainer = document.getElementById('tarjim-result-body');
  const resultCard = document.getElementById('tarjim-result-card');
  const btnTranslate = document.getElementById('btn-tarjim-translate');
  const streamBadge = document.getElementById('tarjim-stream-indicator');

  if (!inputEl) return;
  const text = inputEl.value.trim();

  if (!text) {
    if (window.showToast) window.showToast('Silakan ketik atau tempel teks yang ingin diterjemahkan', 'warning');
    inputEl.focus();
    return;
  }

  if (tarjimState.isTranslating) return;

  tarjimState.isTranslating = true;
  btnTranslate.disabled = true;
  btnTranslate.innerHTML = '<span class="tarjim-spinner"></span> <span>Menerjemahkan...</span>';

  resultCard.classList.remove('hidden');
  resultContainer.innerHTML = '<div class="tarjim-loading-placeholder"><span class="tarjim-spinner"></span> Menganalisis teks & tata bahasa...</div>';
  if (streamBadge) streamBadge.classList.remove('hidden');

  let accumulatedResult = '';

  const payload = {
    text: text,
    sourceLang: tarjimState.sourceLang,
    mode: 'sentence',
    explanationTypes: tarjimState.selectedExplanations
  };

  await callTarjimStream(
    payload,
    (acc) => {
      accumulatedResult = acc;
      resultContainer.innerHTML = renderMarkdown(acc);
      // Auto-scroll inside container
      resultContainer.scrollTop = resultContainer.scrollHeight;
    },
    (finalText) => {
      tarjimState.isTranslating = false;
      btnTranslate.disabled = false;
      btnTranslate.innerHTML = '<span>✨</span> <span>Terjemahkan & Harokat</span>';
      if (streamBadge) streamBadge.classList.add('hidden');
      resultContainer.innerHTML = renderMarkdown(finalText);

      // Save to History
      saveTarjimHistoryItem(text, finalText, 'sentence');
      if (window.showToast) window.showToast('Terjemahan selesai!', 'success');
    },
    (err) => {
      tarjimState.isTranslating = false;
      btnTranslate.disabled = false;
      btnTranslate.innerHTML = '<span>✨</span> <span>Terjemahkan & Harokat</span>';
      if (streamBadge) streamBadge.classList.add('hidden');
      resultContainer.innerHTML = `
        <div class="tarjim-error-box">
          <p>⚠️ <strong>Gagal memproses terjemahan:</strong> ${err.message}</p>
          <p class="text-xs text-muted">Pastikan perangkat Anda terhubung ke internet untuk mengakses model Smart Tarjim AI.</p>
        </div>
      `;
      if (window.showToast) window.showToast('Koneksi terganggu, coba lagi', 'error');
    }
  );
}

// ==========================================================================
// TANYA SALLUNI (CHAT ASSISTANT ENGINE)
// ==========================================================================

export async function sendSalluniMessage(customText = null) {
  const inputEl = document.getElementById('salluni-input');
  const chatMessagesEl = document.getElementById('salluni-messages-list');
  const btnSend = document.getElementById('btn-salluni-send');

  const question = (customText || (inputEl ? inputEl.value : '')).trim();
  if (!question) return;

  if (inputEl) inputEl.value = '';
  if (tarjimState.isChatting) return;

  // Add User Message
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  tarjimState.chatMessages.push({
    role: 'user',
    content: question,
    time: now
  });

  // Placeholder for Assistant reply
  const assistantMsgIndex = tarjimState.chatMessages.length;
  tarjimState.chatMessages.push({
    role: 'assistant',
    content: '',
    time: now,
    isStreaming: true
  });

  renderChatMessages();

  tarjimState.isChatting = true;
  if (btnSend) btnSend.disabled = true;

  const payload = {
    text: question,
    sourceLang: 'auto',
    mode: 'chat',
    explanationTypes: []
  };

  await callTarjimStream(
    payload,
    (accumulated) => {
      tarjimState.chatMessages[assistantMsgIndex].content = accumulated;
      renderChatMessages();
    },
    (finalText) => {
      tarjimState.isChatting = false;
      tarjimState.chatMessages[assistantMsgIndex].isStreaming = false;
      tarjimState.chatMessages[assistantMsgIndex].content = finalText;
      if (btnSend) btnSend.disabled = false;
      renderChatMessages();
      saveChatSession();
    },
    (err) => {
      tarjimState.isChatting = false;
      tarjimState.chatMessages[assistantMsgIndex].isStreaming = false;
      tarjimState.chatMessages[assistantMsgIndex].content = `Maaf, terjadi kendala teknis: ${err.message}. Silakan periksa koneksi internet Anda.`;
      if (btnSend) btnSend.disabled = false;
      renderChatMessages();
    }
  );
}

function renderChatMessages() {
  const listEl = document.getElementById('salluni-messages-list');
  if (!listEl) return;

  listEl.innerHTML = tarjimState.chatMessages.map(msg => {
    const isUser = msg.role === 'user';
    return `
      <div class="salluni-bubble-row ${isUser ? 'user-row' : 'bot-row'}">
        <div class="salluni-avatar">
          ${isUser ? '👤' : '✨'}
        </div>
        <div class="salluni-bubble-content">
          <div class="salluni-bubble-meta">
            <span class="sender-name">${isUser ? 'Anda' : 'Salluni (اسألني)'}</span>
            <span class="bubble-time">${msg.time || ''}</span>
          </div>
          <div class="salluni-bubble-text">
            ${msg.content ? renderMarkdown(msg.content) : '<span class="tarjim-typing-dots"><span></span><span></span><span></span></span>'}
          </div>
          ${!isUser && msg.content ? `
            <div class="salluni-bubble-actions">
              <button class="btn-bubble-act" onclick="window.SmartTarjim.speakText('${escapeQuotes(msg.content)}')" title="Dengarkan Suara">🔊</button>
              <button class="btn-bubble-act" onclick="window.SmartTarjim.copyText('${escapeQuotes(msg.content)}')" title="Salin Jawaban">📋</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  listEl.scrollTop = listEl.scrollHeight;
}

function saveChatSession() {
  try {
    localStorage.setItem(API_CONFIG.STORAGE_CHAT, JSON.stringify(tarjimState.chatMessages.slice(-20)));
  } catch (e) {}
}

function loadChatSession() {
  try {
    const saved = localStorage.getItem(API_CONFIG.STORAGE_CHAT);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tarjimState.chatMessages = parsed;
      }
    }
  } catch (e) {}
}

// ==========================================================================
// SCAN & OCR ENGINE (IMAGE, CAMERA & PDF)
// ==========================================================================

export async function processOcrFile(file) {
  if (!file) return;

  const resultContainer = document.getElementById('ocr-result-body');
  const resultCard = document.getElementById('ocr-result-card');
  const previewImg = document.getElementById('ocr-image-preview');
  const statusEl = document.getElementById('ocr-status-text');

  if (tarjimState.isScanning) return;
  tarjimState.isScanning = true;

  if (resultCard) resultCard.classList.remove('hidden');
  if (statusEl) statusEl.textContent = 'Mengekstrak teks dari file...';
  if (resultContainer) resultContainer.innerHTML = '<div class="tarjim-loading-placeholder"><span class="tarjim-spinner"></span> Sedang memindai teks Arab/Indonesia...</div>';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (!isPdf && previewImg) {
      previewImg.src = base64Data;
      previewImg.classList.remove('hidden');
    }

    const payload = {
      mode: 'ocr',
      image: base64Data,
      fileType: isPdf ? 'pdf' : undefined
    };

    await callTarjimStream(
      payload,
      (acc) => {
        if (resultContainer) resultContainer.innerHTML = renderMarkdown(acc);
      },
      (finalText) => {
        tarjimState.isScanning = false;
        if (statusEl) statusEl.textContent = 'Pemindaian Selesai';
        if (resultContainer) resultContainer.innerHTML = renderMarkdown(finalText);
        saveTarjimHistoryItem(`[Scan File: ${file.name}]`, finalText, 'ocr');
        if (window.showToast) window.showToast('Ekstraksi teks berhasil!', 'success');
      },
      (err) => {
        tarjimState.isScanning = false;
        if (statusEl) statusEl.textContent = 'Gagal';
        if (resultContainer) {
          resultContainer.innerHTML = `<div class="tarjim-error-box"><p>Gagal mengekstrak teks: ${err.message}</p></div>`;
        }
        if (window.showToast) window.showToast('Gagal memindai file', 'error');
      }
    );
  };

  reader.onerror = () => {
    tarjimState.isScanning = false;
    if (window.showToast) window.showToast('Gagal membaca file gambar', 'error');
  };

  reader.readAsDataURL(file);
}

// ==========================================================================
// VIDEO TRANSLATE ENGINE
// ==========================================================================

export async function processVideoTranslate() {
  const urlInput = document.getElementById('video-tarjim-url');
  const textInput = document.getElementById('video-tarjim-transcript');
  const resultCard = document.getElementById('video-result-card');
  const resultContainer = document.getElementById('video-result-body');
  const btnTranslate = document.getElementById('btn-video-translate');

  const videoUrl = urlInput ? urlInput.value.trim() : '';
  const transcript = textInput ? textInput.value.trim() : '';

  if (!transcript) {
    if (window.showToast) window.showToast('Masukkan transkrip teks ceramah/video yang ingin diterjemahkan', 'warning');
    if (textInput) textInput.focus();
    return;
  }

  btnTranslate.disabled = true;
  btnTranslate.innerHTML = '<span class="tarjim-spinner"></span> Memproses Video...';
  if (resultCard) resultCard.classList.remove('hidden');
  if (resultContainer) resultContainer.innerHTML = '<div class="tarjim-loading-placeholder"><span class="tarjim-spinner"></span> Menerjemahkan dan merangkum intisari kajian...</div>';

  const payload = {
    mode: 'video',
    text: transcript,
    videoUrl: videoUrl,
    sourceLang: 'auto'
  };

  await callTarjimStream(
    payload,
    (acc) => {
      if (resultContainer) resultContainer.innerHTML = renderMarkdown(acc);
    },
    (finalText) => {
      btnTranslate.disabled = false;
      btnTranslate.innerHTML = '<span>🎬</span> Terjemahkan Kajian Video';
      if (resultContainer) resultContainer.innerHTML = renderMarkdown(finalText);
      saveTarjimHistoryItem(videoUrl ? `[Video Kajian: ${videoUrl}]` : transcript.slice(0, 50), finalText, 'video');
      if (window.showToast) window.showToast('Terjemahan video selesai!', 'success');
    },
    (err) => {
      btnTranslate.disabled = false;
      btnTranslate.innerHTML = '<span>🎬</span> Terjemahkan Kajian Video';
      if (resultContainer) {
        resultContainer.innerHTML = `<div class="tarjim-error-box"><p>Gagal memproses terjemahan: ${err.message}</p></div>`;
      }
    }
  );
}

// ==========================================================================
// HISTORY RENDERER
// ==========================================================================

function renderHistoryList() {
  const container = document.getElementById('tarjim-history-list');
  const emptyState = document.getElementById('tarjim-history-empty');
  if (!container) return;

  if (tarjimState.history.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = tarjimState.history.map(item => {
    const dateFormatted = new Date(item.timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="tarjim-history-card card-glass">
        <div class="history-item-header">
          <span class="history-mode-tag">
            ${item.mode === 'ocr' ? '📷 Scan Dokumen' : item.mode === 'video' ? '🎬 Terjemah Video' : '🌐 Terjemah Teks'}
          </span>
          <span class="history-time">${dateFormatted}</span>
        </div>
        <div class="history-item-body">
          <div class="history-source-text">${item.sourceText}</div>
          <div class="history-target-text">${renderMarkdown(item.translatedText.slice(0, 300))}${item.translatedText.length > 300 ? '...' : ''}</div>
        </div>
        <div class="history-item-actions">
          <button class="btn-action-mini" onclick="window.SmartTarjim.loadHistoryToInput('${item.id}')" title="Muat ke Penerjemah">
            <span>✏️ Buka</span>
          </button>
          <button class="btn-action-mini" onclick="window.SmartTarjim.copyText('${escapeQuotes(item.translatedText)}')" title="Salin Hasil">
            <span>📋 Salin</span>
          </button>
          <button class="btn-action-mini" onclick="window.SmartTarjim.shareToWhatsApp('${escapeQuotes(item.translatedText)}')" title="Kirim ke WhatsApp">
            <span>💬 Bagikan</span>
          </button>
          <button class="btn-action-mini text-danger" onclick="window.SmartTarjim.deleteHistory('${item.id}')" title="Hapus dari Riwayat">
            <span>🗑️ Hapus</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Helper to escape string for inline HTML onclick attributes
function escapeQuotes(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// ==========================================================================
// EXPORTED ACTIONS (USED IN UI BUTTONS)
// ==========================================================================

export function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (window.showToast) window.showToast('Teks berhasil disalin ke clipboard!', 'success');
  }).catch(() => {
    if (window.showToast) window.showToast('Gagal menyalin teks', 'error');
  });
}

export function shareToWhatsApp(text) {
  if (!text) return;
  const shareText = `*Hasil Smart Tarjim - Ibnu Masyruf App:*\n\n${text}\n\n_Diterjemahkan via Ibnu Masyruf App_`;
  const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}

export function shareToTelegram(text) {
  if (!text) return;
  const shareText = `*Hasil Smart Tarjim - Ibnu Masyruf App:*\n\n${text}`;
  const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}

export function loadHistoryToInput(id) {
  const item = tarjimState.history.find(h => h.id === id);
  if (!item) return;

  switchTarjimSubtab('subtab-translate');
  const inputEl = document.getElementById('tarjim-input-text');
  const resultCard = document.getElementById('tarjim-result-card');
  const resultContainer = document.getElementById('tarjim-result-body');

  if (inputEl) inputEl.value = item.sourceText;
  if (resultCard) resultCard.classList.remove('hidden');
  if (resultContainer) resultContainer.innerHTML = renderMarkdown(item.translatedText);
  if (window.showToast) window.showToast('Riwayat berhasil dimuat ke editor', 'info');
}

// ==========================================================================
// INITIALIZATION & EVENT BINDINGS
// ==========================================================================

export function initSmartTarjim() {
  loadTarjimHistory();
  loadChatSession();

  // Attach global functions for HTML onclick hooks
  window.SmartTarjim = {
    speakText,
    copyText,
    shareToWhatsApp,
    shareToTelegram,
    loadHistoryToInput,
    deleteHistory: deleteHistoryItem,
    clearAllHistory,
    sendSalluniMessage
  };

  // Subtab buttons
  document.querySelectorAll('.tarjim-subtab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const subtabId = btn.dataset.subtab;
      if (subtabId) switchTarjimSubtab(subtabId);
    });
  });

  // Language selectors & Swap button
  const btnSwapLang = document.getElementById('btn-tarjim-swap');
  const selectSourceLang = document.getElementById('tarjim-select-source');
  const selectTargetLang = document.getElementById('tarjim-select-target');

  if (selectSourceLang) {
    selectSourceLang.addEventListener('change', (e) => {
      tarjimState.sourceLang = e.target.value;
    });
  }

  if (selectTargetLang) {
    selectTargetLang.addEventListener('change', (e) => {
      tarjimState.targetLang = e.target.value;
    });
  }

  if (btnSwapLang) {
    btnSwapLang.addEventListener('click', () => {
      const curSource = selectSourceLang.value;
      const curTarget = selectTargetLang.value;

      // Swap if both are specific languages
      if (curSource !== 'auto') {
        selectSourceLang.value = curTarget;
        selectTargetLang.value = curSource;
        tarjimState.sourceLang = curTarget;
        tarjimState.targetLang = curSource;
      } else {
        // Toggle from auto to Arabic/Indonesian swap
        selectSourceLang.value = curTarget === 'id' ? 'ar' : 'id';
        selectTargetLang.value = curTarget === 'id' ? 'id' : 'ar';
        tarjimState.sourceLang = selectSourceLang.value;
        tarjimState.targetLang = selectTargetLang.value;
      }
      if (window.showToast) window.showToast('Arah bahasa ditukar', 'info');
    });
  }

  // Explanation topic chips toggles
  document.querySelectorAll('.tarjim-topic-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const topicId = chip.dataset.topic;
      if (!topicId) return;

      chip.classList.toggle('active');
      if (chip.classList.contains('active')) {
        if (!tarjimState.selectedExplanations.includes(topicId)) {
          tarjimState.selectedExplanations.push(topicId);
        }
      } else {
        tarjimState.selectedExplanations = tarjimState.selectedExplanations.filter(t => t !== topicId);
      }
    });
  });

  // Main translate button & clear button
  const btnTranslate = document.getElementById('btn-tarjim-translate');
  const btnClearInput = document.getElementById('btn-tarjim-clear');
  const btnPasteInput = document.getElementById('btn-tarjim-paste');
  const inputTextEl = document.getElementById('tarjim-input-text');

  if (btnTranslate) {
    btnTranslate.addEventListener('click', executeTranslate);
  }

  if (btnClearInput && inputTextEl) {
    btnClearInput.addEventListener('click', () => {
      inputTextEl.value = '';
      inputTextEl.focus();
    });
  }

  if (btnPasteInput && inputTextEl) {
    btnPasteInput.addEventListener('click', async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          inputTextEl.value = clipText;
          if (window.showToast) window.showToast('Teks ditempel dari clipboard', 'info');
        }
      } catch (err) {
        if (window.showToast) window.showToast('Izin clipboard belum diberikan', 'warning');
      }
    });
  }

  // Keyboard shortcut Ctrl+Enter to translate
  if (inputTextEl) {
    inputTextEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeTranslate();
      }
    });
  }

  // Result card actions: Copy, Audio, Share
  const btnCopyResult = document.getElementById('btn-tarjim-copy-result');
  const btnAudioResult = document.getElementById('btn-tarjim-audio-result');
  const btnShareResult = document.getElementById('btn-tarjim-share-result');
  const resultContainer = document.getElementById('tarjim-result-body');

  if (btnCopyResult && resultContainer) {
    btnCopyResult.addEventListener('click', () => {
      copyText(resultContainer.innerText);
    });
  }

  if (btnAudioResult && resultContainer) {
    btnAudioResult.addEventListener('click', () => {
      speakText(resultContainer.innerText, tarjimState.targetLang === 'ar' ? 'ar-SA' : 'id-ID');
    });
  }

  if (btnShareResult && resultContainer) {
    btnShareResult.addEventListener('click', () => {
      shareToWhatsApp(resultContainer.innerText);
    });
  }

  // Salluni Chat Form & Quick Chips
  const salluniForm = document.getElementById('salluni-form');
  const salluniInput = document.getElementById('salluni-input');

  if (salluniForm) {
    salluniForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendSalluniMessage();
    });
  }

  document.querySelectorAll('.salluni-suggest-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) sendSalluniMessage(prompt);
    });
  });

  // OCR Upload & Drag Drop
  const fileDropZone = document.getElementById('ocr-drop-zone');
  const fileInput = document.getElementById('ocr-file-input');
  const btnPickFile = document.getElementById('btn-ocr-pick-file');

  if (btnPickFile && fileInput) {
    btnPickFile.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processOcrFile(e.target.files[0]);
      }
    });
  }

  if (fileDropZone) {
    fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropZone.classList.add('drag-active');
    });
    fileDropZone.addEventListener('dragleave', () => {
      fileDropZone.classList.remove('drag-active');
    });
    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropZone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processOcrFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Clipboard Paste Support (paste image directly on window when OCR tab is active)
  window.addEventListener('paste', (e) => {
    if (tarjimState.activeSubtab !== 'subtab-ocr') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          if (window.showToast) window.showToast('Gambar terdeteksi dari clipboard, memproses...', 'info');
          processOcrFile(file);
        }
        break;
      }
    }
  });

  // Video Translate Button
  const btnVideoTranslate = document.getElementById('btn-video-translate');
  if (btnVideoTranslate) {
    btnVideoTranslate.addEventListener('click', processVideoTranslate);
  }

  // Clear History Button
  const btnClearAllHistory = document.getElementById('btn-tarjim-clear-history');
  if (btnClearAllHistory) {
    btnClearAllHistory.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat terjemahan?')) {
        clearAllHistory();
      }
    });
  }

  // Initial render of chat & history
  renderChatMessages();
  renderHistoryList();
}
