package com.OllamaBridge.service;

import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;

@Service
public class OllamaStreamService {
    private final WebClient webClient;
    public OllamaStreamService(WebClient webClient){
        this.webClient=webClient;
    }

    public Flux streamResponse(String prompt){
        Map<String, Object> request = Map.of(
            "model","qwen2.5-coder:3b",
            "prompt",prompt,
            "stream",true
        );
        return webClient.post()
        .uri("http://localhost:11434/api/generate")
        .bodyValue(request)
        .retrieve()
        .bodyToFlux(Map.class)
        .map(chunk -> chunk.get("response").toString());
    }
}
