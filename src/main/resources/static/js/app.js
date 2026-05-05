// ════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════
let USER_ID       = '';
let currentChatId = null;
let isSending     = false;
let availModels   = [];
let currentModel  = '';
 
marked.setOptions({ breaks: true, gfm: true });
 
// ════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════
window.onload = function () {
  spawnParticles();
  setupScrollBtn();
  buildShortcutsList();
  checkUsername();
};
 
function checkUsername() {
  const saved = localStorage.getItem('ob_username');
  if (saved && saved.trim()) {
    USER_ID = saved.trim();
    document.getElementById('userModal').style.display = 'none';
    boot();
  } else {
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('usernameInput').focus();
    document.getElementById('usernameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveUsername();
    });
  }
}
 
function saveUsername() {
  const val = document.getElementById('usernameInput').value.trim();
  if (!val) { showToast('Please enter a name', 'error'); return; }
  USER_ID = val;
  localStorage.setItem('ob_username', val);
  document.getElementById('userModal').style.display = 'none';
  boot();
}
 
async function boot() {
  await checkHealth();
  await loadModels();
  await loadSessions();
}
 
// ════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════
async function checkHealth() {
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  dot.className = 'status-dot checking';
  label.textContent = 'Checking…';
  try {
    const r = await fetch('/chat/health');
    const d = await r.json();
    if (d.ollamaReachable) {
      dot.className = 'status-dot online';
      label.textContent = 'Ollama online';
      availModels = d.models || [];
      if (!currentModel && d.defaultModel) currentModel = d.defaultModel;
    } else {
      dot.className = 'status-dot offline';
      label.textContent = 'Ollama offline';
      showToast('⚠️ Ollama is not running. Start it with: ollama serve', 'error');
    }
  } catch {
    dot.className = 'status-dot offline';
    label.textContent = 'Cannot connect';
  }
}
 
// ════════════════════════════════════════════════════════
//  MODELS
// ════════════════════════════════════════════════════════
async function loadModels() {
  try {
    const r = await fetch('/chat/models');
    availModels = await r.json();
    if (availModels.length && !currentModel) currentModel = availModels[0];
    updateModelUI();
  } catch { /* offline — keep existing */ }
}
 
function updateModelUI() {
  document.getElementById('modelLabel').textContent = shortModelName(currentModel) || '—';
  // Rebuild model dropdown
  const dd = document.getElementById('modelDropdown');
  dd.innerHTML = '';
  if (!availModels.length) {
    dd.innerHTML = '<div class="dropdown-item" style="opacity:.5">No models found</div>';
    return;
  }
  availModels.forEach(m => {
    const el = document.createElement('div');
    el.className = 'dropdown-item' + (m === currentModel ? ' active' : '');
    el.textContent = m;
    el.onclick = e => { e.stopPropagation(); switchModel(m); };
    dd.appendChild(el);
  });
  // Settings model select
  const sel = document.getElementById('settingsModel');
  sel.innerHTML = '';
  availModels.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    if (m === currentModel) o.selected = true;
    sel.appendChild(o);
  });
}
 
function switchModel(model) {
  currentModel = model;
  updateModelUI();
  closeModelDropdown();
  // If there's an active session, update it
  if (currentChatId) {
    fetch(`/chat/session/${currentChatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    }).catch(() => {});
  }
  showToast(`Switched to ${shortModelName(model)}`, 'info');
}
 
function shortModelName(m) {
  if (!m) return '';
  return m.length > 22 ? m.substring(0, 20) + '…' : m;
}
 
function toggleModelDropdown() {
  const dd = document.getElementById('modelDropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
function closeModelDropdown() {
  document.getElementById('modelDropdown').style.display = 'none';
}
document.addEventListener('click', e => {
  if (!document.getElementById('modelSelector').contains(e.target)) closeModelDropdown();
});
 
// ════════════════════════════════════════════════════════
//  SEND MESSAGE  (streaming via SSE)
// ════════════════════════════════════════════════════════
async function sendMessage() {
  const ta     = document.getElementById('prompt');
  const prompt = ta.value.trim();
  if (!prompt || isSending) return;
 
  isSending = true;
  setSendDisabled(true);
 
  // Create session lazily
  if (!currentChatId) {
    try {
      const r = await fetch(
        `/chat/session?userId=${encodeURIComponent(USER_ID)}&title=${encodeURIComponent(prompt.substring(0, 35))}&model=${encodeURIComponent(currentModel)}`,
        { method: 'POST' }
      );
      if (!r.ok) throw new Error('Session creation failed');
      const s = await r.json();
      currentChatId = s.id;
      currentModel  = s.model || currentModel;
    } catch (err) {
      showToast('Failed to create session: ' + err.message, 'error');
      isSending = false; setSendDisabled(false); return;
    }
  }
 
  removeWelcome();
  const userText = prompt;
  ta.value = ''; autoResize(ta);
 
  // Render user message
  const userMsgId = 'um-' + Date.now();
  appendUserMessage(userText, userMsgId);
 
  // Thinking bubble
  const thinkId = 'think-' + Date.now();
  appendThinking(thinkId);
  scrollBottom();
 
  await streamFromEndpoint(
    `/chat/stream?userId=${encodeURIComponent(USER_ID)}&chatId=${currentChatId}`,
    'POST',
    { prompt: userText, model: currentModel },
    thinkId,
    userMsgId
  );
 
  isSending = false;
  setSendDisabled(false);
  updateContextStats();
  loadSessions();
}
 
// ════════════════════════════════════════════════════════
//  REGENERATE
// ════════════════════════════════════════════════════════
async function regenerate() {
  if (!currentChatId || isSending) return;
  isSending = true; setSendDisabled(true);
 
  // Remove last AI message from DOM
  const msgs = document.querySelectorAll('.message.ai');
  if (msgs.length) msgs[msgs.length - 1].remove();
 
  const thinkId = 'regen-' + Date.now();
  appendThinking(thinkId);
  scrollBottom();
 
  await streamFromEndpoint(
    `/chat/regenerate?userId=${encodeURIComponent(USER_ID)}&chatId=${currentChatId}`,
    'POST',
    null,
    thinkId,
    null
  );
 
  isSending = false; setSendDisabled(false);
  updateContextStats();
}
 
// ════════════════════════════════════════════════════════
//  EDIT MESSAGE
// ════════════════════════════════════════════════════════
function startEdit(msgEl, messageId, originalText) {
  if (isSending) return;
  const bubble = msgEl.querySelector('.bubble');
  const actions = msgEl.querySelector('.msg-actions');
  if (actions) actions.style.display = 'none';
 
  bubble.innerHTML = `
    <div class="edit-area-wrap">
      <textarea class="edit-textarea" id="edit-ta-${messageId}">${escHtml(originalText)}</textarea>
      <div class="edit-actions">
        <button class="edit-save-btn" onclick="submitEdit(${messageId}, '${msgEl.id}')">Send Edit</button>
        <button class="edit-cancel-btn" onclick="cancelEdit('${msgEl.id}', ${messageId}, \`${escHtml(originalText).replace(/`/g,'\\`')}\`)">Cancel</button>
      </div>
    </div>
  `;
  const ta = document.getElementById(`edit-ta-${messageId}`);
  ta.focus(); ta.select();
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(messageId, msgEl.id); }
    if (e.key === 'Escape') cancelEdit(msgEl.id, messageId, originalText);
  });
}
 
function cancelEdit(msgElId, messageId, originalText) {
  const msgEl = document.getElementById(msgElId);
  if (!msgEl) return;
  const bubble = msgEl.querySelector('.bubble');
  bubble.innerHTML = escHtml(originalText);
  const actions = msgEl.querySelector('.msg-actions');
  if (actions) actions.style.display = '';
}
 
async function submitEdit(messageId, msgElId) {
  const ta = document.getElementById(`edit-ta-${messageId}`);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;
  if (isSending) return;
 
  isSending = true; setSendDisabled(true);
 
  // Remove all DOM messages from this message element onward
  const msgEl = document.getElementById(msgElId);
  let el = msgEl;
  const toRemove = [];
  while (el) { toRemove.push(el); el = el.nextElementSibling; }
  toRemove.forEach(e => e.remove());
 
  // Re-render new user message
  const newUserMsgId = 'um-edit-' + Date.now();
  appendUserMessage(newText, newUserMsgId, messageId);
 
  const thinkId = 'think-edit-' + Date.now();
  appendThinking(thinkId);
  scrollBottom();
 
  await streamFromEndpoint(
    `/chat/edit?userId=${encodeURIComponent(USER_ID)}&chatId=${currentChatId}&messageId=${messageId}`,
    'POST',
    { prompt: newText, model: currentModel },
    thinkId,
    newUserMsgId
  );
 
  isSending = false; setSendDisabled(false);
  updateContextStats();
  loadSessions();
}
 
// ════════════════════════════════════════════════════════
//  CORE STREAMING ENGINE
// ════════════════════════════════════════════════════════
async function streamFromEndpoint(url, method, body, thinkId, userMsgId) {
  return new Promise(resolve => {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.querySelector('.bubble').innerHTML = '<span class="stream-cursor"></span>';
 
    const opts = { method };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
 
    fetch(url, opts).then(response => {
      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let tokenCount = 0;
      let responseTimeMs = 0;
      let model = currentModel;
 
      const aiMsgEl = document.getElementById(thinkId);
      const bubble = aiMsgEl?.querySelector('.bubble');
 
 
      let eventName = '';
 
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            finalize();
            resolve();
            return;
          }
 
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line
 
          for (const line of lines) {
            // SSE spec: blank line = end of event block
            if (!line.trim()) { eventName = ''; continue; }
 
            if (line.startsWith('event:')) {
              // Trim only the field name prefix, preserve data value exactly
              eventName = line.slice(6).trim();
              continue;
            }
 
            if (line.startsWith('data:')) {
              // Slice off "data:" (5 chars) — do NOT trim the rest, spaces are content
              // Spring SseEmitter adds one space after "data:" per SSE spec, strip just that one
              const raw = line.slice(5);
              const data = raw.startsWith(' ') ? raw.slice(1) : raw;
 
              if (eventName === 'token') {
                // Backend sends JSON: {"t":"Hello world"} — parse to preserve spaces exactly
                try {
                  const parsed = JSON.parse(data);
                  fullText += parsed.t || '';
                } catch {
                  // Fallback: use raw data if not JSON (shouldn't happen)
                  fullText += data;
                }
                if (bubble) {
                  bubble.innerHTML = marked.parse(fullText) + '<span class="stream-cursor"></span>';
                  scrollBottom();
                }
              } else if (eventName === 'done') {
                try {
                  const meta = JSON.parse(data);
                  tokenCount = meta.tokenCount || 0;
                  responseTimeMs = meta.responseTimeMs || 0;
                  model = meta.model || currentModel;
                } catch {}
                finalize();
                resolve();
                return;
              } else if (eventName === 'error') {
                if (bubble) bubble.innerHTML = `<span style="color:var(--red)">⚠️ ${escHtml(data)}</span>`;
                showToast('AI error: ' + data, 'error');
                finalizeEl(aiMsgEl, fullText || data, tokenCount, responseTimeMs, model, userMsgId);
                resolve();
                return;
              }
            }
          }
          read();
        }).catch(err => {
          showToast('Stream read error: ' + err.message, 'error');
          resolve();
        });
      }
 
      function finalize() {
        finalizeEl(aiMsgEl, fullText, tokenCount, responseTimeMs, model, userMsgId);
      }
 
      read();
    }).catch(err => {
      const thinkEl = document.getElementById(thinkId);
      if (thinkEl) thinkEl.querySelector('.bubble').innerHTML = `<span style="color:var(--red)">⚠️ ${escHtml(err.message)}</span>`;
      showToast('Request failed: ' + err.message, 'error');
      resolve();
    });
  });
}
 
function finalizeEl(aiMsgEl, fullText, tokenCount, responseTimeMs, model, userMsgId) {
  if (!aiMsgEl) return;
 
  // Set final rendered markdown
  const bubble = aiMsgEl.querySelector('.bubble');
  if (bubble) bubble.innerHTML = marked.parse(fullText || '(no response)');
 
  // Attach copy buttons to code blocks
  attachCopyBtns(aiMsgEl);
 
  // Add stats line
  if (tokenCount || responseTimeMs) {
    const statsEl = document.createElement('div');
    statsEl.className = 'msg-stats';
    statsEl.innerHTML = `
      <span>⚡ ${tokenCount} tokens</span>
      <span>⏱ ${(responseTimeMs/1000).toFixed(1)}s</span>
      <span>🤖 ${escHtml(shortModelName(model))}</span>
    `;
    aiMsgEl.appendChild(statsEl);
  }
 
  // Add action bar to AI message
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'msg-actions';
  actionsDiv.innerHTML = `
    <button class="msg-action-btn copy-msg" onclick="copyText(\`${fullText.replace(/`/g,'\\`').replace(/\n/g,'\\n')}\`)">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      Copy
    </button>
    <button class="msg-action-btn regen" onclick="regenerate()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
      Regenerate
    </button>
  `;
  aiMsgEl.appendChild(actionsDiv);
 
  scrollBottom();
}
 
// ════════════════════════════════════════════════════════
//  DOM HELPERS
// ════════════════════════════════════════════════════════
function appendUserMessage(text, elemId, dbMessageId) {
  const chatBox = document.getElementById('chatBox');
  const ts = timestamp();
  const div = document.createElement('div');
  div.className = 'message user';
  div.id = elemId;
  div.innerHTML = `
    <div class="msg-meta">
      <div class="av av-u">${escHtml(USER_ID.charAt(0).toUpperCase())}</div>
      <span>${escHtml(USER_ID)}</span>
      <span style="opacity:.5">${ts}</span>
    </div>
    <div class="bubble">${escHtml(text)}</div>
    <div class="msg-actions">
      <button class="msg-action-btn copy-msg" onclick="copyText(\`${text.replace(/`/g,'\\`').replace(/\n/g,'\\n')}\`)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy
      </button>
      ${dbMessageId ? `<button class="msg-action-btn edit-btn" onclick="startEdit(document.getElementById('${elemId}'), ${dbMessageId}, \`${text.replace(/`/g,'\\`').replace(/\n/g,'\\n')}\`)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </button>` : ''}
    </div>
  `;
  chatBox.appendChild(div);
}
 
function appendThinking(thinkId) {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'message ai';
  div.id = thinkId;
  div.innerHTML = `
    <div class="msg-meta">
      <div class="av av-a">AI</div>
      <span>OllamaBridge</span>
    </div>
    <div class="bubble">
      <div class="thinking"><span></span><span></span><span></span></div>
    </div>
  `;
  chatBox.appendChild(div);
}
 
function removeWelcome() {
  const w = document.getElementById('welcomeScreen');
  if (w) w.remove();
}
 
// ════════════════════════════════════════════════════════
//  HISTORY LOAD  (full render with edit buttons)
// ════════════════════════════════════════════════════════
async function loadHistory(chatId) {
  if (!chatId) return;
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text-dim);font-size:12.5px;padding:48px">Loading history…</div>`;
 
  try {
    const r = await fetch(`/chat/history?chatId=${chatId}`);
    const messages = await r.json();
    chatBox.innerHTML = '';
 
    if (!messages || !messages.length) {
      chatBox.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text-dim);font-size:12.5px;padding:48px">No messages yet.</div>`;
      return;
    }
 
    for (const msg of messages) {
      const ts = msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
 
      if (msg.sender === 'USER') {
        const elemId = 'um-hist-' + msg.id;
        const div = document.createElement('div');
        div.className = 'message user';
        div.id = elemId;
        const safeText = escHtml(msg.message);
        const rawForJs = (msg.message || '').replace(/`/g,'\\`').replace(/\n/g,'\\n');
        div.innerHTML = `
          <div class="msg-meta">
            <div class="av av-u">${escHtml(USER_ID.charAt(0).toUpperCase())}</div>
            <span>${escHtml(USER_ID)}</span>
            <span style="opacity:.5">${ts}</span>
          </div>
          <div class="bubble">${safeText}</div>
          <div class="msg-actions">
            <button class="msg-action-btn copy-msg" onclick="copyText(\`${rawForJs}\`)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 00-2 2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
            <button class="msg-action-btn edit-btn" onclick="startEdit(document.getElementById('${elemId}'), ${msg.id}, \`${rawForJs}\`)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          </div>
        `;
        chatBox.appendChild(div);
 
      } else {
        const div = document.createElement('div');
        div.className = 'message ai';
        const rawForJs = (msg.message || '').replace(/`/g,'\\`').replace(/\n/g,'\\n');
        div.innerHTML = `
          <div class="msg-meta">
            <div class="av av-a">AI</div>
            <span>OllamaBridge</span>
            <span style="opacity:.5">${ts}</span>
          </div>
          <div class="bubble">${marked.parse(msg.message || '')}</div>
          ${(msg.tokenCount || msg.responseTimeMs) ? `
          <div class="msg-stats">
            ${msg.tokenCount ? `<span>⚡ ${msg.tokenCount} tokens</span>` : ''}
            ${msg.responseTimeMs ? `<span>⏱ ${(msg.responseTimeMs/1000).toFixed(1)}s</span>` : ''}
          </div>` : ''}
          <div class="msg-actions">
            <button class="msg-action-btn copy-msg" onclick="copyText(\`${rawForJs}\`)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 00-2 2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
            <button class="msg-action-btn regen" onclick="regenerate()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Regenerate
            </button>
          </div>
        `;
        attachCopyBtns(div);
        chatBox.appendChild(div);
      }
    }
    scrollBottom();
    updateContextStats();
  } catch (err) {
    chatBox.innerHTML = `<div style="margin:auto;text-align:center;color:var(--red);padding:48px">Failed to load history: ${escHtml(err.message)}</div>`;
  }
}
 
// ════════════════════════════════════════════════════════
//  SESSIONS
// ════════════════════════════════════════════════════════
async function loadSessions() {
  try {
    const r = await fetch(`/chat/sessions?userId=${encodeURIComponent(USER_ID)}`);
    const sessions = await r.json();
    const list = document.getElementById('chatHistory');
 
    if (!sessions.length) {
      list.innerHTML = '<div class="no-sessions">No conversations yet</div>';
      return;
    }
 
    list.innerHTML = '';
    sessions.forEach(s => {
      const el = document.createElement('div');
      el.className = 'chat-item' + (s.id === currentChatId ? ' active' : '');
      el.dataset.chatId = s.id;
      el.innerHTML = `<span class="chat-item-ico">💬</span><span class="chat-item-title">${escHtml(s.title)}</span>`;
      el.onclick = () => openChat(s.id, s.title, s.model);
      list.appendChild(el);
    });
  } catch {}
}
 
function openChat(chatId, title, model) {
  currentChatId = chatId;
  if (model) currentModel = model;
  updateModelUI();
  document.getElementById('topbarTitle').textContent = title || 'Chat';
  document.querySelectorAll('.chat-item').forEach(el => el.classList.toggle('active', el.dataset.chatId == chatId));
  loadHistory(chatId);
}
 
function newChat() {
  currentChatId = null;
  document.getElementById('topbarTitle').textContent = 'New Conversation';
  document.getElementById('contextFill').style.width = '0%';
  document.getElementById('contextLabel').textContent = '0 / 20 msgs in context';
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  document.getElementById('chatBox').innerHTML = `
    <div class="welcome" id="welcomeScreen">
      <div class="welcome-orb">ZM</div>
      <h1>OllamaBridge AI</h1>
      <p>Fully local, fully offline. Running on your machine. Ask anything.</p>
      <div class="suggestions">
        <div class="sug" onclick="fillPrompt('Explain quantum computing in simple terms')"><span class="sug-ico">🔮</span>Explain quantum computing</div>
        <div class="sug" onclick="fillPrompt('Write a haiku about writing code at 2am')"><span class="sug-ico">🌸</span>Haiku about coding at 2am</div>
        <div class="sug" onclick="fillPrompt('What are the SOLID principles in software engineering?')"><span class="sug-ico">📐</span>SOLID principles explained</div>
        <div class="sug" onclick="fillPrompt('Write a Spring Boot REST API boilerplate in Java')"><span class="sug-ico">☕</span>Spring Boot REST boilerplate</div>
      </div>
    </div>
  `;
}
 
// ════════════════════════════════════════════════════════
//  SETTINGS PANEL
// ════════════════════════════════════════════════════════
function openSettings() {
  if (!currentChatId) { showToast('Start a conversation first', 'info'); return; }
  const overlay = document.getElementById('settingsOverlay');
  overlay.classList.add('open');
 
  // Pre-fill from current session
  fetch(`/chat/sessions?userId=${encodeURIComponent(USER_ID)}`)
    .then(r => r.json())
    .then(sessions => {
      const s = sessions.find(x => x.id === currentChatId);
      if (s) {
        document.getElementById('settingsTitle').value = s.title || '';
        document.getElementById('settingsSystemPrompt').value = s.systemPrompt || '';
        const sel = document.getElementById('settingsModel');
        if (s.model) {
          for (let o of sel.options) if (o.value === s.model) { o.selected = true; break; }
        }
      }
    }).catch(() => {});
}
 
function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
}
 
async function saveSettings() {
  if (!currentChatId) return;
  const model        = document.getElementById('settingsModel').value;
  const systemPrompt = document.getElementById('settingsSystemPrompt').value.trim();
  const title        = document.getElementById('settingsTitle').value.trim();
 
  try {
    const r = await fetch(`/chat/session/${currentChatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, systemPrompt, title })
    });
    const updated = await r.json();
    currentModel = updated.model || model;
    updateModelUI();
    if (title) document.getElementById('topbarTitle').textContent = title;
    closeSettings();
    showToast('Settings saved ✓', 'success');
    loadSessions();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}
 
// ════════════════════════════════════════════════════════
//  EXPORT
// ════════════════════════════════════════════════════════
async function exportChat() {
  if (!currentChatId) { showToast('No active chat to export', 'info'); return; }
  try {
    const r = await fetch(`/chat/history?chatId=${currentChatId}`);
    const msgs = await r.json();
    const title = document.getElementById('topbarTitle').textContent;
    let md = `# ${title}\n\n_Exported from OllamaBridge · ${new Date().toLocaleString()}_\n\n---\n\n`;
    msgs.forEach(m => {
      const role = m.sender === 'USER' ? `**${USER_ID}**` : '**OllamaBridge AI**';
      md += `### ${role}\n\n${m.message}\n\n`;
      if (m.tokenCount) md += `_${m.tokenCount} tokens · ${(m.responseTimeMs/1000).toFixed(1)}s_\n\n`;
      md += '---\n\n';
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`;
    a.click();
    showToast('Chat exported as Markdown ✓', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}
 
// ════════════════════════════════════════════════════════
//  CONTEXT STATS
// ════════════════════════════════════════════════════════
async function updateContextStats() {
  if (!currentChatId) return;
  try {
    const r = await fetch(`/chat/context-stats?chatId=${currentChatId}`);
    const d = await r.json();
    const pct = Math.min(100, (d.inContext / d.maxContext) * 100);
    document.getElementById('contextFill').style.width = pct + '%';
    document.getElementById('contextLabel').textContent = `${d.inContext} / ${d.maxContext} msgs in context`;
  } catch {}
}
 
// ════════════════════════════════════════════════════════
//  CLEAR ALL
// ════════════════════════════════════════════════════════
function confirmClearAll() {
  if (!confirm(`Delete ALL chat history for "${USER_ID}"? This cannot be undone.`)) return;
  fetch(`/chat/clear?userId=${encodeURIComponent(USER_ID)}`, { method: 'DELETE' })
    .then(() => { newChat(); loadSessions(); showToast('All history cleared', 'success'); })
    .catch(err => showToast('Clear failed: ' + err.message, 'error'));
}
 
// ════════════════════════════════════════════════════════
//  CODE COPY BUTTONS
// ════════════════════════════════════════════════════════
function attachCopyBtns(container) {
  container.querySelectorAll('pre:not([data-cb])').forEach(pre => {
    pre.setAttribute('data-cb', '1');
    const code = pre.querySelector('code');
    const lang = code?.className?.replace('language-', '') || 'code';
 
    const header = document.createElement('div');
    header.className = 'pre-header';
    header.innerHTML = `<span>${lang}</span>`;
 
    const copyBtn = document.createElement('button');
    copyBtn.className = 'pre-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(code?.textContent || pre.textContent).then(() => {
        copyBtn.textContent = '✓ Copied';
        copyBtn.classList.add('ok');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('ok'); }, 2000);
      });
    };
    header.appendChild(copyBtn);
    pre.insertBefore(header, pre.firstChild);
  });
}
 
// ════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ════════════════════════════════════════════════════════
const SHORTCUTS = [
  { keys: ['Enter'],           desc: 'Send message' },
  { keys: ['Shift', 'Enter'], desc: 'New line in message' },
  { keys: ['Ctrl', 'K'],      desc: 'Focus input' },
  { keys: ['Ctrl', 'N'],      desc: 'New conversation' },
  { keys: ['Ctrl', ','],      desc: 'Open settings' },
  { keys: ['Ctrl', 'E'],      desc: 'Export chat' },
  { keys: ['Ctrl', '/'],      desc: 'Show shortcuts' },
  { keys: ['Escape'],         desc: 'Close panel / cancel edit' },
];
 
function buildShortcutsList() {
  const el = document.getElementById('shortcutsList');
  el.innerHTML = SHORTCUTS.map(s => `
    <div class="shortcut-row">
      <span style="color:var(--text-muted)">${s.desc}</span>
      <div class="shortcut-keys">${s.keys.map(k => `<span class="kbd">${k}</span>`).join('+')}</div>
    </div>
  `).join('');
}
 
function openShortcuts() {
  document.getElementById('shortcutsOverlay').classList.add('open');
}
 
document.addEventListener('keydown', e => {
  // Ctrl+K — focus input
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('prompt').focus(); }
  // Ctrl+N — new chat
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newChat(); }
  // Ctrl+, — settings
  if (e.ctrlKey && e.key === ',') { e.preventDefault(); openSettings(); }
  // Ctrl+E — export
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportChat(); }
  // Ctrl+/ — shortcuts
  if (e.ctrlKey && e.key === '/') { e.preventDefault(); openShortcuts(); }
  // Escape — close any open panel
  if (e.key === 'Escape') {
    document.getElementById('settingsOverlay').classList.remove('open');
    document.getElementById('shortcutsOverlay').classList.remove('open');
    closeModelDropdown();
  }
});
 
// ════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════
function fillPrompt(text) {
  const ta = document.getElementById('prompt');
  ta.value = text; ta.focus(); autoResize(ta);
}
 
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}
 
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
 
function timestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
 
function setSendDisabled(v) {
  document.getElementById('sendBtn').disabled = v;
}
 
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard ✓', 'success'));
}
 
function showToast(msg, type = '') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
 
function scrollBottom() {
  const cb = document.getElementById('chatBox');
  cb.scrollTop = cb.scrollHeight;
}
 
function setupScrollBtn() {
  const cb  = document.getElementById('chatBox');
  const btn = document.getElementById('scrollBtn');
  cb.addEventListener('scroll', () => {
    btn.classList.toggle('show', cb.scrollHeight - cb.scrollTop - cb.clientHeight > 220);
  });
  btn.addEventListener('click', scrollBottom);
}
 
function spawnParticles() {
  const colors = ['#7c6bff','#b06bff','#ff6b9d','#818cf8','#4ade80'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 3 + 1.5;
    Object.assign(p.style, {
      position: 'fixed',
      width: size+'px', height: size+'px',
      left: Math.random()*100+'%',
      background: colors[Math.floor(Math.random()*colors.length)],
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: '0',
      animation: `particleRise ${Math.random()*18+16}s linear ${-Math.random()*20}s infinite`,
      opacity: '0',
    });
    document.body.appendChild(p);
  }
}
 
// Inject particle keyframe
const pStyle = document.createElement('style');
pStyle.textContent = `@keyframes particleRise{0%{transform:translateY(100vh) rotate(0);opacity:0}8%{opacity:.4}92%{opacity:.15}100%{transform:translateY(-10vh) rotate(540deg);opacity:0}}`;
document.head.appendChild(pStyle);
 
// Auto-resize textarea
document.getElementById('prompt').addEventListener('input', function() { autoResize(this); });
document.getElementById('prompt').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
 
// Close settings on overlay click
document.getElementById('settingsOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});
document.getElementById('shortcutsOverlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});