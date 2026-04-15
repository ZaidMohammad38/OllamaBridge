package com.OllamaBridge.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.OllamaBridge.dto.ChatRequest;
import com.OllamaBridge.dto.ChatResponse;
import com.OllamaBridge.entity.ChatMessage;
import com.OllamaBridge.repository.ChatRepository;
import com.OllamaBridge.service.ChatMemoryService;
import com.OllamaBridge.service.OllamaService;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private final OllamaService ollamaService;
    private final ChatMemoryService memoryService;
    private final ChatRepository repository;

    public ChatController(OllamaService ollamaService,
            ChatMemoryService memoryService,
            ChatRepository repository) {
        this.ollamaService = ollamaService;
        this.memoryService = memoryService;
        this.repository = repository;
    }

    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request,
            @RequestParam String userId,
            @RequestParam Long chatId) {

        memoryService.saveMessage(userId, chatId, request.getPrompt(), "USER");

        String context = memoryService.buildContext(userId, chatId);

        String finalPrompt = context + "\nUser: " + request.getPrompt() + "\nAI:";

        String aiResponse = ollamaService.askOllama(finalPrompt);

        memoryService.saveMessage(userId, chatId, aiResponse, "AI");

        return new ChatResponse(aiResponse);
    }

    @DeleteMapping("/clear")
    public String clear(@RequestParam String userId) {
        memoryService.clearMemory(userId);
        return "Memory cleared for user: " + userId;
    }

    @DeleteMapping("/message/{id}")
    public String deleteMessage(@PathVariable Long id) {
        repository.deleteById(id);
        return "Deleted";
    }

    @GetMapping("/history")
    public List<ChatMessage> getHistory(
            @RequestParam String userId,
            @RequestParam Long chatId) {

        return repository.findByUserIdAndChatId(userId, chatId);
    }

}
