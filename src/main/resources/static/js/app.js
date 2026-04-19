// ===========================
// OllamaBridge — app.js
// ===========================

let currentChatId = null;
const USER_ID = 'zaid';

// ===========================
// INIT
// ===========================
window.onload = function () {
    spawnParticles();
    loadSessions();
    // We don't call newChat() here anymore to avoid "Ghost Sessions"
};

// ===========================
// CORE CHAT LOGIC
// ===========================

async function sendMessage() {
    const ta = document.getElementById('prompt');
    const prompt = ta.value.trim();
    const chatBox = document.getElementById('chatBox');

    if (!prompt) return;

    // 1. If no session exists, create one first
    if (!currentChatId) {
        try {
            // Use the first 20 chars of the prompt as the title
            const title = prompt.length > 20 ? prompt.substring(0, 20) + "..." : prompt;
            const response = await fetch(`/chat/session?userId=${USER_ID}&title=${encodeURIComponent(title)}`, {
                method: "POST"
            });
            const session = await response.json();
            currentChatId = session.id;
        } catch (err) {
            console.error("Failed to create session:", err);
            return;
        }
    }

    // 2. UI Updates
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.remove();

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add User Message & Thinking Indicator
    chatBox.innerHTML += `
        <div class="message user">
            <div class="msg-header">
                <div class="avatar user-av">U</div>
                <span>${ts}</span>
            </div>
            <div class="bubble">${escapeHtml(prompt)}</div>
        </div>
        <div class="message ai" id="thinking-bubble">
            <div class="msg-header">
                <div class="avatar ai-av">AI</div>
                <span>thinking…</span>
            </div>
            <div class="bubble">
                <div class="thinking-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;

    chatBox.scrollTop = chatBox.scrollHeight;
    ta.value = '';
    autoResize(ta);

    // 3. Send Message to Backend
    fetch(`/chat?userId=${USER_ID}&chatId=${currentChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
    .then(r => r.json())
    .then(() => {
        loadHistory(); 
        loadSessions(); // Refresh sidebar to show the new/updated session
    })
    .catch(err => {
        const tb = document.getElementById('thinking-bubble');
        if (tb) {
            tb.querySelector('.bubble').innerHTML = `<span style="color:#f472b6">Error: ${err}</span>`;
        }
    });
}

// ===========================
// SESSION MANAGEMENT
// ===========================

function newChat() {
    currentChatId = null; // Reset the ID locally
    const chatBox = document.getElementById("chatBox");
    
    // Reset UI to Welcome Screen
    chatBox.innerHTML = `
        <div class="welcome" id="welcomeScreen">
            <div class="welcome-orb zm-orb">ZM</div>
            <h1>OllamaBridge AI</h1>
            <p>Your anime-inspired AI companion. Ask me anything.</p>
            <div class="suggestion-grid">
                <div class="suggestion" onclick="fillPrompt('Explain quantum computing simply')">🔮 Explain quantum</div>
                <div class="suggestion" onclick="fillPrompt('Write a short haiku about code')">🌸 Write a haiku</div>
                <div class="suggestion" onclick="fillPrompt('Help me debug my JavaScript')">⚡ Help me debug</div>
            </div>
        </div>
    `;
    
    // Highlights the reset in the sidebar
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

function loadSessions() {
    fetch(`/chat/sessions?userId=${USER_ID}`)
        .then(response => response.json())
        .then(data => {
            const history = document.getElementById("chatHistory");
            history.innerHTML = "";

            data.forEach(session => {
                const div = document.createElement("div");
                div.className = "chat-item";
                if (session.id === currentChatId) div.classList.add('active');
                div.dataset.chatId = session.id;
                div.textContent = session.title;
                div.onclick = () => openChat(session.id);
                history.appendChild(div);
            });
        });
}

function openChat(chatId) {
    currentChatId = chatId;
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.remove();
    
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId == chatId);
    });
    loadHistory();
}

function loadHistory() {
    if (!currentChatId) return;

    fetch(`/chat/history?userId=${USER_ID}&chatId=${currentChatId}`)
        .then(response => response.json())
        .then(data => {
            const chatBox = document.getElementById("chatBox");
            chatBox.innerHTML = "";

            data.forEach(msg => {
                const senderClass = msg.sender === "USER" ? "user" : "ai";
                const content = msg.sender === "AI" ? marked.parse(msg.message) : escapeHtml(msg.message);

                chatBox.innerHTML += `
                    <div class="message ${senderClass}">
                        <div class="bubble">${content}</div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

function clearAllChats() {
    if (!confirm("Are you sure you want to delete all chat history?")) return;
    
    fetch(`/chat/clear?userId=${USER_ID}`, { method: 'DELETE' })
    .then(() => {
        newChat();
        loadSessions();
    });
}

// ===========================
// UTILS & HELPERS
// ===========================

function spawnParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['#7c5cbf', '#c084fc', '#f472b6', '#818cf8', '#34d399'];
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        p.style.cssText = `
            width: ${size}px; height: ${size}px;
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            animation-duration: ${Math.random() * 18 + 14}s;
        `;
        container.appendChild(p);
    }
}

function fillPrompt(text) {
    const ta = document.getElementById('prompt');
    ta.value = text;
    ta.focus();
    autoResize(ta);
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Keyboard Listeners
const promptInput = document.getElementById('prompt');
promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});