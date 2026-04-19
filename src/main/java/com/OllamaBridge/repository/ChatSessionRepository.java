package com.OllamaBridge.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import com.OllamaBridge.entity.ChatSession;

import jakarta.transaction.Transactional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long>{
    List<ChatSession> findByUserIdOrderByCreatedAtDesc(String userId);
    
    @Transactional
    @Modifying
    void deleteByUserId(String userId);
}
