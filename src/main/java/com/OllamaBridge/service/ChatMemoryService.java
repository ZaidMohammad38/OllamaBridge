package com.OllamaBridge.service;

import java.time.LocalDateTime;
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

    private static final int MAX_CONTEXT_MESSAGES = 20;

    public ChatMemoryService(ChatRepository repository, ChatSessionRepository sessionRepository) {
        this.repository = repository;
        this.sessionRepository = sessionRepository;
    }

    // ─────────────────────────────────────────────────────────────
    // SAVE MESSAGE
    // ─────────────────────────────────────────────────────────────
    public ChatMessage saveMessage(String userId, Long sessionId, String message, String sender,
            Integer tokenCount, Long responseTimeMs) {

        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

        ChatMessage chat = new ChatMessage();
        chat.setUserId(userId);
        chat.setMessage(message);
        chat.setSender(sender);
        chat.setChatSession(session);
        chat.setCreatedAt(LocalDateTime.now());
        chat.setTokenCount(tokenCount);
        chat.setResponseTimeMs(responseTimeMs);

        ChatMessage saved = repository.save(chat);

        session.setUpdatedAt(LocalDateTime.now());
        session.setMessageCount(session.getMessageCount() + 1);
        sessionRepository.save(session);

        return saved;
    }

    // Convenience overload without stats
    public ChatMessage saveMessage(String userId, Long sessionId, String message, String sender) {
        return saveMessage(userId, sessionId, message, sender, null, null);
    }

    // ─────────────────────────────────────────────────────────────
    // BUILD CONTEXT (respects session system prompt)
    // ─────────────────────────────────────────────────────────────
    public String buildContext(Long sessionId) {
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

        List<ChatMessage> messages = repository.findByChatSessionIdOrderByIdAsc(sessionId);

        // Keep only last N messages
        int start = Math.max(0, messages.size() - MAX_CONTEXT_MESSAGES);
        List<ChatMessage> recent = messages.subList(start, messages.size());

        StringBuilder ctx = new StringBuilder();

        // Use session system prompt if set, otherwise default
        String sysPrompt = (session.getSystemPrompt() != null && !session.getSystemPrompt().isBlank())
                ? session.getSystemPrompt()
                : "You are a helpful, concise AI assistant. Answer clearly and directly.";

        ctx.append(sysPrompt).append("\n\n");

        for (ChatMessage msg : recent) {
            String role = "USER".equals(msg.getSender()) ? "User" : "Assistant";
            ctx.append(role).append(": ").append(msg.getMessage()).append("\n");
        }

        return ctx.toString();
    }

    // ─────────────────────────────────────────────────────────────
    // HISTORY
    // ─────────────────────────────────────────────────────────────
    public List<ChatMessage> getSessionHistory(Long sessionId) {
        return repository.findByChatSessionIdOrderByIdAsc(sessionId);
    }

    // ─────────────────────────────────────────────────────────────
    // MESSAGE EDIT: delete from that message onward, resend
    // ─────────────────────────────────────────────────────────────
    @Transactional
    public void truncateFromMessage(Long sessionId, Long messageId) {
        repository.deleteFromMessageOnward(sessionId, messageId);

        // Recount messages
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));
        long count = repository.findByChatSessionIdOrderByIdAsc(sessionId).size();
        session.setMessageCount((int) count);
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepository.save(session);
    }

    // ─────────────────────────────────────────────────────────────
    // CLEAR
    // ─────────────────────────────────────────────────────────────
    @Transactional
    public void clearMemory(String userId) {
        repository.deleteByUserId(userId);
    }

    @Transactional
    public void clearSession(Long sessionId) {
        repository.deleteByChatSessionId(sessionId);
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));
        session.setMessageCount(0);
        sessionRepository.save(session);
    }

    public int getContextMessageCount(Long sessionId) {
        int total = repository.findByChatSessionIdOrderByIdAsc(sessionId).size();
        return Math.min(total, MAX_CONTEXT_MESSAGES);
    }

    public int getMaxContextMessages() {
        return MAX_CONTEXT_MESSAGES;
    }
}
