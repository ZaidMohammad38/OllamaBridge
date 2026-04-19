package com.OllamaBridge.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.OllamaBridge.dto.ChatRequest;
import com.OllamaBridge.dto.ChatResponse;
import com.OllamaBridge.entity.ChatMessage;
import com.OllamaBridge.entity.ChatSession;
import com.OllamaBridge.service.ChatMemoryService;
import com.OllamaBridge.service.ChatSessionService;
import com.OllamaBridge.service.OllamaService;

@RestController
@RequestMapping("/chat")
public class ChatController {

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

    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request,
            @RequestParam String userId,
            @RequestParam Long chatId) {

        // 1. Save User Message
        memoryService.saveMessage(userId, chatId, request.getPrompt(), "USER");

        // 2. Build Context & Get AI Response
        String context = memoryService.buildContext(chatId);
        String finalPrompt = context + "\nUser: " + request.getPrompt() + "\nAI:";
        String aiResponse = ollamaService.askOllama(finalPrompt);

        // 3. Save AI Response
        memoryService.saveMessage(userId, chatId, aiResponse, "AI");

        // 4. DYNAMIC TITLE GENERATION
        ChatSession currentSession = sessionService.getSessionById(chatId);

        // Only rename if it's the default title (avoids renaming every message)
        if ("New Chat".equals(currentSession.getTitle())) {
            String titlePrompt = "Summarize this request in 3 words max: " + request.getPrompt();
            String shortTitle = ollamaService.askOllama(titlePrompt).trim();

            // Clean up AI chatter (remove quotes/dots)
            shortTitle = shortTitle.replaceAll("[\".]", "");

            sessionService.updateTitle(chatId, shortTitle);
        }

        return new ChatResponse(aiResponse);
    }

    @GetMapping("/history")
    public List<ChatMessage> getHistory(@RequestParam Long chatId) {
        // We now only need chatId (Session ID) to get history
        return memoryService.getSessionHistory(chatId);
    }

    @PostMapping("/session")
    public ChatSession createSession(@RequestParam String userId,
            @RequestParam String title) {
        return sessionService.createSession(userId, title);
    }

    @GetMapping("/sessions")
    public List<ChatSession> getSessions(@RequestParam String userId) {
        return sessionService.getAllSessions(userId);
    }

    @DeleteMapping("/clear")
    public String clear(@RequestParam String userId) {
        memoryService.clearMemory(userId);
        sessionService.clearSessions(userId);
        return "History wiped for user: " + userId;
    }
}