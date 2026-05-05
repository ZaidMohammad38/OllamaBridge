package com.OllamaBridge.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.OllamaBridge.dto.SessionUpdateRequest;
import com.OllamaBridge.entity.ChatSession;
import com.OllamaBridge.repository.ChatSessionRepository;

import jakarta.transaction.Transactional;

@Service
public class ChatSessionService {

    private final ChatSessionRepository repository;
    private final OllamaService ollamaService;

    public ChatSessionService(ChatSessionRepository repository, OllamaService ollamaService) {
        this.repository = repository;
        this.ollamaService = ollamaService;
    }

    public ChatSession createSession(String userId, String title, String model) {
        ChatSession session = new ChatSession();
        session.setUserId(userId);
        session.setTitle(title != null && !title.isBlank() ? title : "New Chat");
        session.setModel(model != null && !model.isBlank() ? model : ollamaService.getDefaultModel());
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        session.setMessageCount(0);
        return repository.save(session);
    }

    public List<ChatSession> getAllSessions(String userId) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional
    public void clearSessions(String userId) {
        repository.deleteByUserId(userId);
    }

    @Transactional
    public void deleteSession(Long sessionId) {
        repository.deleteById(sessionId);
    }

    public ChatSession getSessionById(Long sessionId) {
        return repository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));
    }

    public void updateTitle(Long sessionId, String newTitle) {
        ChatSession session = getSessionById(sessionId);
        session.setTitle(newTitle);
        repository.save(session);
    }

    public ChatSession updateSession(Long sessionId, SessionUpdateRequest req) {
        ChatSession session = getSessionById(sessionId);
        if (req.getModel() != null && !req.getModel().isBlank()) session.setModel(req.getModel());
        if (req.getSystemPrompt() != null) session.setSystemPrompt(req.getSystemPrompt());
        if (req.getTitle() != null && !req.getTitle().isBlank()) session.setTitle(req.getTitle());
        session.setUpdatedAt(LocalDateTime.now());
        return repository.save(session);
    }
}
