package com.OllamaBridge.health;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.OllamaBridge.service.OllamaService;

@Component
public class OllamaHealthRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OllamaHealthRunner.class);

    private final OllamaService ollamaService;

    public OllamaHealthRunner(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        log.info("  OllamaBridge — Startup Health Check");
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (ollamaService.isOllamaReachable()) {
            log.info("  ✅ Ollama is REACHABLE at localhost:11434");

            List<String> models = ollamaService.listModels();
            if (models.isEmpty()) {
                log.warn("  ⚠️  No models found. Run: ollama pull qwen2.5-coder:3b");
            } else {
                log.info("  📦 Available models ({}):", models.size());
                models.forEach(m -> log.info("       • {}", m));
            }
        } else {
            log.warn("  ❌ Ollama is NOT reachable at localhost:11434");
            log.warn("     → Start it with: ollama serve");
            log.warn("     → The app will still start, but chat will fail until Ollama is running.");
        }

        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}