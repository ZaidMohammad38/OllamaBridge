// =========================
// GLOBAL VARIABLES
// =========================
let currentChatId = null;

// Load chat history when page opens
window.onload = function () {
    newChat();
};

// =========================
// NON-STREAMING VERSION
// Recommended for normal use
// Saves instantly to DB
// =========================
function sendMessage() {
    const promptInput = document.getElementById("prompt");
    const prompt = promptInput.value.trim();
    const chatBox = document.getElementById("chatBox");

    if (!prompt) return;

    // Add sidebar title only for first message
    if (chatBox.innerHTML.trim() === "") {
        addChatToSidebar(prompt);
    }

    // Show temporary UI
    chatBox.innerHTML += `
        <div class="message user">
            <div class="bubble">${prompt}</div>
        </div>

        <div class="message ai">
            <div class="bubble thinking">Thinking...</div>
        </div>
    `;

    chatBox.scrollTop = chatBox.scrollHeight;

    // Send to backend
    fetch("/chat?userId=zaid&chatId=" + currentChatId, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt
        })
    })
        .then(response => response.json())
        .then(data => {
            loadHistory();
        })
        .catch(error => {
            chatBox.innerHTML += `
            <div class="message ai">
                <div class="bubble">
                    Error: ${error}
                </div>
            </div>
        `;
            chatBox.scrollTop = chatBox.scrollHeight;
        });

    promptInput.value = "";
}

/*
=========================
STREAMING VERSION
Uncomment this if you want live typing effect
DB updates only after stream ends
=========================

function sendMessageStreaming() {
    const promptInput = document.getElementById("prompt");
    const prompt = promptInput.value.trim();
    const chatBox = document.getElementById("chatBox");

    if (!prompt) return;

    if (chatBox.innerHTML.trim() === "") {
        addChatToSidebar(prompt);
    }

    chatBox.innerHTML += `
        <div class="message user">
            <div class="bubble">${prompt}</div>
        </div>

        <div class="message ai">
            <div class="bubble" id="streamingResponse"></div>
        </div>
    `;

    const aiBubble = document.getElementById("streamingResponse");

    const eventSource = new EventSource(
        "/stream/chat?prompt=" + encodeURIComponent(prompt)
    );

    eventSource.onmessage = function (event) {
        aiBubble.textContent += event.data + " ";
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    eventSource.onerror = function () {
        eventSource.close();
        loadHistory();
    };

    promptInput.value = "";
}
*/

// =========================
// LOAD CHAT HISTORY
// =========================
function loadHistory() {
    if (!currentChatId) return;

    fetch("/chat/history?userId=zaid&chatId=" + currentChatId)
        .then(response => response.json())
        .then(data => {
            const chatBox = document.getElementById("chatBox");
            chatBox.innerHTML = "";

            data.forEach(msg => {
                const senderClass =
                    msg.sender === "USER" ? "user" : "ai";

                chatBox.innerHTML += `
                    <div class="message ${senderClass}">
                        <div class="bubble">
                            ${msg.message}
                        </div>
                    </div>
                `;
            });

            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

// =========================
// NEW CHAT
// =========================
function newChat() {
    currentChatId = Date.now(); // temporary unique id
    document.getElementById("chatBox").innerHTML = "";
}

// =========================
// CLEAR ALL CHATS FROM DB
// =========================
function clearAllChats() {
    fetch("/chat/clear?userId=zaid", {
        method: "DELETE"
    })
        .then(() => {
            // Reset current session
            currentChatId = null;

            // Clear chat UI
            document.getElementById("chatBox").innerHTML = "";

            // Clear sidebar titles
            clearSidebar();

            // Start a fresh new chat session
            newChat();
        });
}


// =========================
// SIDEBAR TITLE ADD
// =========================
function addChatToSidebar(title) {
    const history = document.getElementById("chatHistory");

    // Clean title
    let formattedTitle = title.trim();

    // Capitalize first letter
    formattedTitle =
        formattedTitle.charAt(0).toUpperCase() +
        formattedTitle.slice(1);

    // Limit length
    if (formattedTitle.length > 30) {
        formattedTitle =
            formattedTitle.substring(0, 30) + "...";
    }

    history.innerHTML += `
        <div class="chat-item"
             onclick="openChat(${currentChatId})">
            ${formattedTitle}
        </div>
    `;
}

//openChat
function openChat(chatId) {
    currentChatId = chatId;
    loadHistory();
}

// =========================
// CLEAR SIDEBAR ONLY
// =========================
function clearSidebar() {
    const history = document.getElementById("chatHistory");
    history.innerHTML = "";
}

// =========================
// ENTER KEY SEND
// =========================
document.getElementById("prompt")
    .addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });