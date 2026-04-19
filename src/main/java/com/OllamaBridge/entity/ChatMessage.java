package com.OllamaBridge.entity;

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

    private String userId; // important for multi-user support

    @Column(columnDefinition = "LONGTEXT")
    private String message;

    private String sender; // USER or AI

    // private Long chatId;

    @ManyToOne
    @JoinColumn(name = "chat_session_id", nullable = false)
    private ChatSession chatSession;
    
    

}
