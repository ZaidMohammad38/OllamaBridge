package com.OllamaBridge.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.OllamaBridge.dto.ChatRequest;
import com.OllamaBridge.dto.ChatResponse;
import com.OllamaBridge.dto.OllamaResult;
import com.OllamaBridge.dto.SessionUpdateRequest;
import com.OllamaBridge.entity.ChatMessage;
import com.OllamaBridge.entity.ChatSession;
import com.OllamaBridge.service.ChatMemoryService;
import com.OllamaBridge.service.ChatSessionService;
import com.OllamaBridge.service.OllamaService;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final OllamaService ollamaService;
    private final ChatMemoryService memoryService;
    private final ChatSessionService sessionService;

    public ChatController(OllamaService ollamaService,
            ChatMemoryService memoryService,
            ChatSessionService sessionService) {
        this.ollamaService = ollamaService;
        this.memoryService = memoryService;
        this.sessionService = sessionService;
    }

    // ── Streaming chat ────────────────────────────────────────────
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest request,
            @RequestParam String userId,
            @RequestParam Long chatId) {

        SseEmitter emitter = new SseEmitter(180_000L);

        ollamaService.getStreamExecutor().submit(() -> {
            try {
                ChatSession session = sessionService.getSessionById(chatId);
                String model = resolve(request.getModel(), session.getModel());

                memoryService.saveMessage(userId, chatId, request.getPrompt(), "USER");

                String context = memoryService.buildContext(chatId);
                String finalPrompt = context + "Assistant:";

                long startMs = System.currentTimeMillis();

                OllamaResult result = ollamaService.askStreaming(finalPrompt, model, token -> {
                    try { emitter.send(SseEmitter.event().name("token").data(Map.of("t", token))); }
                    catch (IOException e) { log.warn("Client disconnected during stream"); }
                });

                long elapsed = System.currentTimeMillis() - startMs;
                memoryService.saveMessage(userId, chatId, result.getResponse(), "AI",
                        result.getEvalCount(), elapsed);

                // Auto-title on first exchange only
                session = sessionService.getSessionById(chatId);
                if (session.getMessageCount() <= 2) {
                    String title = ollamaService.generateTitle(request.getPrompt(), model);
                    sessionService.updateTitle(chatId, title);
                }

                String meta = metaJson(result.getEvalCount(), elapsed, model);
                emitter.send(SseEmitter.event().name("done").data(meta));
                emitter.complete();

            } catch (Exception e) {
                log.error("Stream error: {}", e.getMessage());
                try { emitter.send(SseEmitter.event().name("error").data(e.getMessage())); }
                catch (IOException ignored) {}
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // ── Non-streaming fallback ────────────────────────────────────
    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request,
            @RequestParam String userId,
            @RequestParam Long chatId) {

        ChatSession session = sessionService.getSessionById(chatId);
        String model = resolve(request.getModel(), session.getModel());

        memoryService.saveMessage(userId, chatId, request.getPrompt(), "USER");

        String context = memoryService.buildContext(chatId);
        long startMs = System.currentTimeMillis();
        OllamaResult result = ollamaService.ask(context + "Assistant:", model);
        long elapsed = System.currentTimeMillis() - startMs;

        memoryService.saveMessage(userId, chatId, result.getResponse(), "AI",
                result.getEvalCount(), elapsed);

        session = sessionService.getSessionById(chatId);
        if (session.getMessageCount() <= 2) {
            sessionService.updateTitle(chatId, ollamaService.generateTitle(request.getPrompt(), model));
        }

        return new ChatResponse(result.getResponse(), result.getEvalCount(), elapsed, model);
    }

    // ── Regenerate last AI response ───────────────────────────────
    @PostMapping(value = "/regenerate", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter regenerate(@RequestParam String userId,
            @RequestParam Long chatId) {

        SseEmitter emitter = new SseEmitter(180_000L);

        ollamaService.getStreamExecutor().submit(() -> {
            try {
                List<ChatMessage> history = memoryService.getSessionHistory(chatId);
                if (history.isEmpty()) {
                    emitter.send(SseEmitter.event().name("error").data("No messages to regenerate"));
                    emitter.complete(); return;
                }

                // Find and delete last AI message
                for (int i = history.size() - 1; i >= 0; i--) {
                    if ("AI".equals(history.get(i).getSender())) {
                        memoryService.truncateFromMessage(chatId, history.get(i).getId());
                        break;
                    }
                }

                ChatSession session = sessionService.getSessionById(chatId);
                String model = session.getModel();
                String context = memoryService.buildContext(chatId);

                long startMs = System.currentTimeMillis();
                OllamaResult result = ollamaService.askStreaming(context + "Assistant:", model, token -> {
                    try { emitter.send(SseEmitter.event().name("token").data(Map.of("t", token))); }
                    catch (IOException e) { log.warn("Client disconnected during regenerate"); }
                });

                long elapsed = System.currentTimeMillis() - startMs;
                memoryService.saveMessage(userId, chatId, result.getResponse(), "AI",
                        result.getEvalCount(), elapsed);

                emitter.send(SseEmitter.event().name("done").data(metaJson(result.getEvalCount(), elapsed, model)));
                emitter.complete();

            } catch (Exception e) {
                log.error("Regenerate error: {}", e.getMessage());
                try { emitter.send(SseEmitter.event().name("error").data(e.getMessage())); }
                catch (IOException ignored) {}
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // ── Edit message ──────────────────────────────────────────────
    @PostMapping(value = "/edit", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter editMessage(@RequestBody ChatRequest request,
            @RequestParam String userId,
            @RequestParam Long chatId,
            @RequestParam Long messageId) {

        SseEmitter emitter = new SseEmitter(180_000L);

        ollamaService.getStreamExecutor().submit(() -> {
            try {
                // Truncate history from the edited message onward
                memoryService.truncateFromMessage(chatId, messageId);

                // Save the new (edited) user message
                memoryService.saveMessage(userId, chatId, request.getPrompt(), "USER");

                ChatSession session = sessionService.getSessionById(chatId);
                String model = resolve(request.getModel(), session.getModel());
                String context = memoryService.buildContext(chatId);

                long startMs = System.currentTimeMillis();
                OllamaResult result = ollamaService.askStreaming(context + "Assistant:", model, token -> {
                    try { emitter.send(SseEmitter.event().name("token").data(Map.of("t", token))); }
                    catch (IOException e) { log.warn("Client disconnected during edit stream"); }
                });

                long elapsed = System.currentTimeMillis() - startMs;
                memoryService.saveMessage(userId, chatId, result.getResponse(), "AI",
                        result.getEvalCount(), elapsed);

                emitter.send(SseEmitter.event().name("done").data(metaJson(result.getEvalCount(), elapsed, model)));
                emitter.complete();

            } catch (Exception e) {
                log.error("Edit error: {}", e.getMessage());
                try { emitter.send(SseEmitter.event().name("error").data(e.getMessage())); }
                catch (IOException ignored) {}
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // ── History ───────────────────────────────────────────────────
    @GetMapping("/history")
    public List<ChatMessage> getHistory(@RequestParam Long chatId) {
        return memoryService.getSessionHistory(chatId);
    }

    // ── Session CRUD ──────────────────────────────────────────────
    @PostMapping("/session")
    public ChatSession createSession(@RequestParam String userId,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String model) {
        return sessionService.createSession(userId, title, model);
    }

    @GetMapping("/sessions")
    public List<ChatSession> getSessions(@RequestParam String userId) {
        return sessionService.getAllSessions(userId);
    }

    @PutMapping("/session/{sessionId}")
    public ChatSession updateSession(@PathVariable Long sessionId,
            @RequestBody SessionUpdateRequest req) {
        return sessionService.updateSession(sessionId, req);
    }

    @DeleteMapping("/session/{sessionId}")
    public ResponseEntity<String> deleteSession(@PathVariable Long sessionId) {
        memoryService.clearSession(sessionId);
        sessionService.deleteSession(sessionId);
        return ResponseEntity.ok("Session deleted");
    }

    // ── Context stats ─────────────────────────────────────────────
    @GetMapping("/context-stats")
    public Map<String, Integer> getContextStats(@RequestParam Long chatId) {
        return Map.of(
                "inContext", memoryService.getContextMessageCount(chatId),
                "maxContext", memoryService.getMaxContextMessages()
        );
    }

    // ── Models & Health ───────────────────────────────────────────
    @GetMapping("/models")
    public List<String> getModels() {
        return ollamaService.listModels();
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        boolean ok = ollamaService.isOllamaReachable();
        return Map.of(
                "ollamaReachable", ok,
                "models", ok ? ollamaService.listModels() : List.of(),
                "defaultModel", ollamaService.getDefaultModel()
        );
    }

    // ── Clear all ─────────────────────────────────────────────────
    @DeleteMapping("/clear")
    public String clear(@RequestParam String userId) {
        memoryService.clearMemory(userId);
        sessionService.clearSessions(userId);
        return "History cleared for user: " + userId;
    }

    // ── Helpers ───────────────────────────────────────────────────
    private String resolve(String override, String sessionModel) {
        if (override != null && !override.isBlank()) return override;
        if (sessionModel != null && !sessionModel.isBlank()) return sessionModel;
        return ollamaService.getDefaultModel();
    }

    private String metaJson(int tokens, long ms, String model) {
        return String.format("{\"tokenCount\":%d,\"responseTimeMs\":%d,\"model\":\"%s\"}",
                tokens, ms, model);
    }
}
