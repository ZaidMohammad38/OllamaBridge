# OllamaBridge

> A local AI chat interface built with **Spring Boot** + **vanilla JS** that connects to your locally running [Ollama](https://ollama.com) instance. Fully offline — no cloud, no API keys, no data leaves your machine.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [How It Works](#how-it-works)
- [Recommended Models](#recommended-models)
- [Known Limitations](#known-limitations)
- [Future Ideas](#future-ideas)

---

## Features

| Feature | Description |
|---|---|
| 🌊 **Streaming responses** | Tokens appear word-by-word in real time via SSE |
| 🤖 **Model switcher** | Switch between any locally installed Ollama model per session |
| 🧠 **Conversation memory** | Full context window with last 20 messages per session |
| ✏️ **Message editing** | Click edit on any user message — rewrites history from that point |
| 🔁 **Regenerate** | Re-run the last AI response with one click |
| ⚙️ **System prompts** | Set a custom persona/instruction per session |
| 📤 **Export chat** | Download any conversation as a Markdown file |
| 👥 **Multi-user** | Username stored in localStorage, fully isolated history per user |
| 📊 **Token & timing stats** | Every AI response shows token count and response time |
| 📏 **Context window indicator** | Visual progress bar showing how full the context is |
| ❤️ **Ollama health check** | Startup check + live status dot in the UI |
| ⌨️ **Keyboard shortcuts** | Full keyboard navigation |
| 🎨 **Dark UI** | Animated glassmorphism design, zero external CSS dependencies |

---

## Tech Stack

**Backend**
- Java 17+
- Spring Boot 3.x
- Spring Data JPA
- MySQL 8
- `RestTemplate` for Ollama HTTP calls
- `SseEmitter` for streaming

**Frontend**
- Vanilla HTML/CSS/JS (no framework)
- [marked.js](https://cdn.jsdelivr.net/npm/marked/) for Markdown rendering
- Served as static files from Spring Boot

**AI Runtime**
- [Ollama](https://ollama.com) — runs models locally on CPU or GPU

---

## Project Structure

```
OllamaBridge/
└── src/
    └── main/
        ├── java/com/OllamaBridge/
        │   ├── OllamaBridgeApplication.java     # Entry point + RestTemplate bean
        │   │
        │   ├── controller/
        │   │   └── ChatController.java           # All REST + SSE endpoints
        │   │
        │   ├── service/
        │   │   ├── OllamaService.java            # Ollama API calls (stream + non-stream)
        │   │   ├── ChatMemoryService.java         # Save/load/truncate messages
        │   │   └── ChatSessionService.java        # Session CRUD + settings
        │   │
        │   ├── entity/
        │   │   ├── ChatMessage.java              # Stored message (USER or AI)
        │   │   └── ChatSession.java              # Session with model + system prompt
        │   │
        │   ├── repository/
        │   │   ├── ChatRepository.java           # JPA queries for messages
        │   │   └── ChatSessionRepository.java    # JPA queries for sessions
        │   │
        │   ├── dto/
        │   │   ├── ChatRequest.java              # Incoming chat payload
        │   │   ├── ChatResponse.java             # Non-streaming response
        │   │   ├── OllamaResult.java             # Parsed Ollama API response
        │   │   └── SessionUpdateRequest.java     # Settings update payload
        │   │
        │   └── health/
        │       └── OllamaHealthRunner.java        # Startup health check
        │
        └── resources/
            ├── application.properties
            └── static/
                └── index.html                    # Entire frontend (single file)
```

---

## Prerequisites

Make sure you have all of these installed before starting:

| Requirement | Version | Notes |
|---|---|---|
| Java JDK | 17 or higher | [Download](https://adoptium.net) |
| Maven | 3.8+ | Usually bundled with IDEs |
| MySQL | 8.0+ | Must be running on port 3306 |
| Ollama | Latest | [Download](https://ollama.com/download) |
| A pulled model | Any | e.g. `qwen2.5-coder:3b` |

---

## Installation & Setup

### Step 1 — Install and start Ollama

```bash
# Download from https://ollama.com/download and install
# Then pull a model (this downloads it locally)
ollama pull qwen2.5-coder:3b

# Start the Ollama server (keep this running in the background)
ollama serve
```

Verify it's working:
```bash
curl http://localhost:11434
# Should return: Ollama is running
```

### Step 2 — Set up MySQL

```sql
-- Connect to MySQL and run:
CREATE DATABASE IF NOT EXISTS ollamabridge;
-- Tables are created automatically by Spring Boot on first run (ddl-auto=update)
```

### Step 3 — Configure the application

Open `src/main/resources/application.properties` and update your database credentials:

```properties
spring.datasource.username=your_mysql_username
spring.datasource.password=your_mysql_password
```

If your default Ollama model is different, update `OllamaService.java`:
```java
private static final String DEFAULT_MODEL = "qwen2.5-coder:3b"; // change this
```

### Step 4 — Run the application

```bash
# From the project root
mvn spring-boot:run

# Or build and run the JAR
mvn clean package
java -jar target/OllamaBridge-0.0.1-SNAPSHOT.jar
```

### Step 5 — Open the UI

```
http://localhost:8080
```

You'll be prompted for a username on first visit. This is stored only in your browser's `localStorage`.

---

## Configuration

All configuration lives in `src/main/resources/application.properties`:

```properties
# Database
spring.datasource.url=jdbc:mysql://localhost:3306/ollamabridge?createDatabaseIfNotExist=true
spring.datasource.username=root
spring.datasource.password=root

# JPA — tables auto-created/updated on startup
spring.jpa.hibernate.ddl-auto=update

# SSE streaming timeout (milliseconds) — increase for slow/large models
spring.mvc.async.request-timeout=180000
```

To change the default Ollama model or base URL, edit `OllamaService.java`:

```java
private static final String OLLAMA_BASE   = "http://localhost:11434";
private static final String DEFAULT_MODEL = "qwen2.5-coder:3b";
```

To change the context window size (how many messages the AI remembers), edit `ChatMemoryService.java`:

```java
private static final int MAX_CONTEXT_MESSAGES = 20;
```

---

## API Reference

All endpoints are prefixed with `/chat`.

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat/stream` | **Primary** — streams response via SSE |
| `POST` | `/chat` | Non-streaming fallback, returns full response |
| `POST` | `/chat/regenerate` | Deletes last AI message, re-streams a new one |
| `POST` | `/chat/edit` | Truncates history from `messageId`, re-streams |

**Stream request body:**
```json
{
  "prompt": "Explain recursion",
  "model": "qwen2.5-coder:3b"
}
```

**Stream SSE events:**
```
event: token
data: {"t":" Hello"}

event: token
data: {"t":" there"}

event: done
data: {"tokenCount":23,"responseTimeMs":4200,"model":"qwen2.5-coder:3b"}
```

### Sessions

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `POST` | `/chat/session` | `userId`, `title`, `model` | Create new session |
| `GET` | `/chat/sessions` | `userId` | List all sessions (newest first) |
| `PUT` | `/chat/session/{id}` | — | Update model, system prompt, or title |
| `DELETE` | `/chat/session/{id}` | — | Delete a single session |
| `DELETE` | `/chat/clear` | `userId` | Delete all sessions and messages for a user |

### Utility

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/chat/history` | Full message history for a session |
| `GET` | `/chat/context-stats` | `{inContext, maxContext}` counts |
| `GET` | `/chat/models` | List of all locally installed Ollama models |
| `GET` | `/chat/health` | Ollama reachability + model list |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Ctrl + K` | Focus the input box |
| `Ctrl + N` | Start a new conversation |
| `Ctrl + ,` | Open session settings |
| `Ctrl + E` | Export current chat as Markdown |
| `Ctrl + /` | Show keyboard shortcuts panel |
| `Escape` | Close any open panel / cancel edit |

---

## How It Works

### Streaming (SSE)

The frontend sends a `POST` to `/chat/stream`. The backend opens an `SseEmitter` and submits the Ollama call to a cached thread pool. Ollama's streaming API (`"stream": true`) returns newline-delimited JSON — one object per token. The backend reads these with a `BufferedReader` line by line and emits each token as an SSE event:

```
event: token
data: {"t":"Hello"}
```

Tokens are wrapped in JSON (`{"t": "..."}`) so that spaces inside the token value are never corrupted by SSE envelope parsing. The frontend reads the stream with `fetch` + `ReadableStream`, parses each SSE frame manually, and appends tokens to the bubble in real time using `marked.parse()`.

### Message Editing

When a user edits a message, the frontend calls `POST /chat/edit?messageId=X`. The backend runs a single `DELETE` query that removes all messages with `id >= X` from that session, then saves the new edited message and streams a fresh AI response. This cleanly rewrites history from the edit point onward — both in the database and in the UI.

### Context Building

`ChatMemoryService.buildContext()` fetches the last 20 messages for the session, prepends the session's system prompt, and formats them as:
```
[System prompt]

User: ...
Assistant: ...
User: ...
Assistant:
```
This string is sent as the full prompt to Ollama. The trailing `Assistant:` guides the model to continue from there.

### Auto Title Generation

On the first exchange of a new session (when `messageCount <= 2`), the backend makes a second Ollama call asking it to summarize the first user message in 3–5 words. This becomes the session title visible in the sidebar.

---

## Recommended Models

These all run well on 8GB RAM. Pull with `ollama pull <name>`.

| Model | Size | Best For |
|---|---|---|
| `qwen2.5-coder:3b` | ~2GB | Code, debugging, technical questions |
| `qwen2.5:3b` | ~2GB | General chat, better at conversation |
| `gemma2:2b` | ~1.6GB | Explanations, writing, beginner-friendly answers |
| `phi3:mini` | ~2.3GB | Reasoning, math, structured thinking |

> **Tip:** If you have an NVIDIA GPU, set `OLLAMA_GPU_LAYERS=99` before running `ollama serve` to offload the model to VRAM. This gives dramatically faster responses and frees up system RAM.

---

## Known Limitations

- **No authentication** — this is a local tool, not designed for public internet exposure. The `userId` is just a string from `localStorage`, not a secured identity.
- **Single database user** — MySQL credentials are in `application.properties` as plaintext. Use environment variables for any shared deployment.
- **Title generation costs an extra Ollama call** — on slow hardware this adds 5–10 seconds after the first message. You can disable it by removing the title generation block in `ChatController.java`.
- **Context window is fixed at 20 messages** — older messages are silently dropped. The UI shows a progress bar so you know when you're close to the limit.
- **No image/file support** — text only.

---

## Future Ideas

- [ ] Streaming title generation (so the extra call doesn't block)
- [ ] Per-session temperature and top-p controls
- [ ] Conversation search
- [ ] PWA support (installable as a desktop app)
- [ ] Docker Compose setup (Spring Boot + MySQL together)
- [ ] Support for Ollama's vision models (image input)
- [ ] RAG — attach a PDF and chat with it

---

## Author

Built by **Zaid** as a personal local AI interface.  
Stack: Spring Boot · MySQL · Vanilla JS · Ollama

---

*Running entirely on your machine. No cloud. No tracking. No API keys.*
