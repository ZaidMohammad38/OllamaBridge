package com.OllamaBridge.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.OllamaBridge.entity.ChatMessage;

import jakarta.transaction.Transactional;

@Repository
public interface ChatRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatSessionIdOrderByIdAsc(Long chatSessionId);

    // Delete all messages after a given message ID within a session
    // Used for message editing — truncates everything after the edited message
    @Transactional
    @Modifying
    @Query("DELETE FROM ChatMessage m WHERE m.chatSession.id = :sessionId AND m.id >= :fromId")
    void deleteFromMessageOnward(Long sessionId, Long fromId);

    @Transactional
    @Modifying
    void deleteByUserId(String userId);

    @Transactional
    @Modifying
    void deleteByChatSessionId(Long chatSessionId);
}
