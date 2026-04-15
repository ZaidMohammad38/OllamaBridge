package com.OllamaBridge.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.OllamaBridge.entity.ChatMessage;
import com.OllamaBridge.repository.ChatRepository;

@Service
public class ChatMemoryService {
    private final ChatRepository repository;

    public ChatMemoryService(ChatRepository repository) {
        this.repository = repository;
    }

    public void saveMessage(String userId, Long chatId,String message, String sender ) {
        ChatMessage chat = new ChatMessage();
        chat.setUserId(userId);
        chat.setChatId(chatId);
        chat.setMessage(message);
        chat.setSender(sender);

        repository.save(chat);
    }

    public String buildContext(String userId,Long chatId) {
        List<ChatMessage> messages =
                repository.findByUserIdAndChatIdOrderByIdAsc(userId,chatId);

        StringBuilder context = new StringBuilder();

        for (ChatMessage msg : messages) {
            context.append(msg.getSender())
                   .append(": ")
                   .append(msg.getMessage())
                   .append("\n");
        }

        return context.toString();
    }

    public void clearMemory(String userId) {
        repository.deleteAll(repository.findByUserIdOrderByIdAsc(userId));
    }
}
