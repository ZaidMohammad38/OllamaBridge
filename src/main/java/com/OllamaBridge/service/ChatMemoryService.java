package com.OllamaBridge.service;

import java.util.List;
import org.springframework.stereotype.Service;
import com.OllamaBridge.entity.ChatMessage;
import com.OllamaBridge.entity.ChatSession;
import com.OllamaBridge.repository.ChatRepository;
import com.OllamaBridge.repository.ChatSessionRepository;

import jakarta.transaction.Transactional;

@Service
public class ChatMemoryService {
    private final ChatRepository repository;
    private final ChatSessionRepository sessionRepository;

    public ChatMemoryService(ChatRepository repository, ChatSessionRepository sessionRepository) {
        this.repository = repository;
        this.sessionRepository = sessionRepository;
    }

    public void saveMessage(String userId, Long sessionId, String message, String sender) {
        // Find the actual session object to create the link
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found with ID: " + sessionId));

        ChatMessage chat = new ChatMessage();
        chat.setUserId(userId);
        chat.setMessage(message);
        chat.setSender(sender);
        chat.setChatSession(session); // This is the @ManyToOne link

        repository.save(chat);
    }

    // UPDATED: Now uses the relationship to build context
    public String buildContext(Long sessionId) {
        List<ChatMessage> messages = repository.findByChatSessionIdOrderByIdAsc(sessionId);

        StringBuilder context = new StringBuilder();
        for (ChatMessage msg : messages) {
            context.append(msg.getSender())
                    .append(": ")
                    .append(msg.getMessage())
                    .append("\n");
        }
        return context.toString();
    }

    // NEW: Needed for the Controller's getHistory endpoint
    public List<ChatMessage> getSessionHistory(Long sessionId) {
        return repository.findByChatSessionIdOrderByIdAsc(sessionId);
    }

    @Transactional
    public void clearMemory(String userId) {
        repository.deleteByUserId(userId);
    }
}