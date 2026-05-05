package com.OllamaBridge.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Data;

@Data
@Entity
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userId;

    @Column(columnDefinition = "LONGTEXT")
    private String message;

    private String sender; // "USER" or "AI"

    private LocalDateTime createdAt;

    // Token count returned by Ollama (only set for AI messages)
    private Integer tokenCount;

    // Response time in milliseconds (only set for AI messages)
    private Long responseTimeMs;

    @ManyToOne
    @JoinColumn(name = "chat_session_id", nullable = false)
    private ChatSession chatSession;
}
