package com.OllamaBridge.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.OllamaBridge.entity.ChatMessage;

@Repository
public interface ChatRepository extends JpaRepository<ChatMessage, Long> {

        List<ChatMessage> findByUserIdOrderByIdAsc(String userId);

        List<ChatMessage> findByUserIdAndChatIdOrderByIdAsc(String userId, Long chatId);

        List<ChatMessage> findByUserIdAndChatId(String userId, Long chatId);
}
