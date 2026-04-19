package com.OllamaBridge.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.OllamaBridge.entity.ChatSession;
import com.OllamaBridge.repository.ChatSessionRepository;

import jakarta.transaction.Transactional;

@Service
public class ChatSessionService {
    private final ChatSessionRepository repository;

    public ChatSessionService(ChatSessionRepository repository) {
        this.repository = repository;
    }

    public ChatSession createSession(String userId, String title) {
        // Optional: Check if the last session has 0 messages.
        // If so, return that ID instead of creating a new one.
        ChatSession session = new ChatSession();
        session.setUserId(userId);
        session.setTitle(title);
        session.setCreatedAt(LocalDateTime.now());
        return repository.save(session);
    }

    public List<ChatSession> getAllSessions(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public void clearSessions(String userId) {
        repository.deleteByUserId(userId);
    }

    public ChatSession getSessionById(Long sessionId) {
        return repository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
    }

    public void updateTitle(Long sessionId, String newTitle) {
        ChatSession session = getSessionById(sessionId);
        session.setTitle(newTitle);
        repository.save(session);
    }
}
