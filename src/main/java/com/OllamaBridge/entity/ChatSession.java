package com.OllamaBridge.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class ChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userId;

    private String title;

    // Which Ollama model this session uses
    private String model;

    // Optional system prompt for this session
    @Column(columnDefinition = "TEXT")
    private String systemPrompt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    // Total messages in this session (used for title generation trigger)
    private int messageCount = 0;
}
