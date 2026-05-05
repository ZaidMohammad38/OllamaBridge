package com.OllamaBridge.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.OllamaBridge.dto.OllamaResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class OllamaService {

    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);

    private static final String OLLAMA_BASE   = "http://localhost:11434";
    private static final String GENERATE_URL  = OLLAMA_BASE + "/api/generate";
    private static final String TAGS_URL      = OLLAMA_BASE + "/api/tags";
    private static final String DEFAULT_MODEL = "qwen2.5-coder:3b";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ExecutorService streamExecutor = Executors.newCachedThreadPool();

    public OllamaService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
    }

    // Non-streaming — uses ObjectMapper so @JsonProperty annotations work
    public OllamaResult ask(String fullPrompt, String model) {
        String m = resolve(model);
        try {
            Map<String, Object> body = Map.of("model", m, "prompt", fullPrompt, "stream", false);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<String> raw = restTemplate.postForEntity(
                GENERATE_URL, new HttpEntity<>(body, headers), String.class);
            if (raw.getBody() == null) { OllamaResult r = new OllamaResult(); r.setResponse("Empty response."); return r; }
            return objectMapper.readValue(raw.getBody(), OllamaResult.class);
        } catch (RestClientException e) {
            log.error("Ollama request failed: {}", e.getMessage());
            OllamaResult r = new OllamaResult();
            r.setResponse("Cannot reach Ollama. Ensure it is running on localhost:11434 and model '" + m + "' is pulled.");
            return r;
        } catch (Exception e) {
            log.error("Unexpected Ollama error: {}", e.getMessage());
            OllamaResult r = new OllamaResult(); r.setResponse("Error: " + e.getMessage()); return r;
        }
    }

    // Streaming — raw HttpURLConnection, reads NDJSON line by line
    public OllamaResult askStreaming(String fullPrompt, String model, Consumer<String> tokenConsumer) {
        String m = resolve(model);
        OllamaResult result = new OllamaResult();
        StringBuilder sb = new StringBuilder();
        try {
            String json = objectMapper.writeValueAsString(Map.of("model", m, "prompt", fullPrompt, "stream", true));
            URL url = new URL(GENERATE_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(180_000);
            try (var os = conn.getOutputStream()) { os.write(json.getBytes(StandardCharsets.UTF_8)); os.flush(); }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isBlank()) continue;
                    try {
                        JsonNode node = objectMapper.readTree(line);
                        String token = node.path("response").asText("");
                        boolean done = node.path("done").asBoolean(false);
                        if (!token.isEmpty()) { sb.append(token); tokenConsumer.accept(token); }
                        if (done) {
                            JsonNode ec = node.path("eval_count"), ed = node.path("eval_duration");
                            if (!ec.isMissingNode()) result.setEvalCount(ec.asInt());
                            if (!ed.isMissingNode()) result.setEvalDuration(ed.asLong());
                            break;
                        }
                    } catch (Exception px) { log.warn("Unparseable stream line: {}", line); }
                }
            }
        } catch (Exception e) {
            log.error("Streaming error: {}", e.getMessage());
            String err = "Streaming error: " + e.getMessage();
            tokenConsumer.accept(err); sb.append(err);
        }
        result.setResponse(sb.toString());
        return result;
    }

    public String generateTitle(String firstMsg, String model) {
        String prompt = "In 3-5 words only, give a concise title for a conversation that starts: \""
                + firstMsg.substring(0, Math.min(firstMsg.length(), 100))
                + "\". Reply with ONLY the title, no quotes, no punctuation, no explanation.";
        try {
            String raw = ask(prompt, model).getResponse().trim()
                    .replaceAll("[\"'\\n\\r]", " ").replaceAll("\\s+", " ").trim();
            if (raw.contains(".")) raw = raw.substring(0, raw.indexOf(".")).trim();
            if (raw.length() > 50) raw = raw.substring(0, 50).trim();
            return raw.isBlank() ? firstMsg.substring(0, Math.min(35, firstMsg.length())) : raw;
        } catch (Exception e) {
            return firstMsg.substring(0, Math.min(35, firstMsg.length()));
        }
    }

    @SuppressWarnings("unchecked")
    public List<String> listModels() {
        List<String> models = new ArrayList<>();
        try {
            ResponseEntity<Map> r = restTemplate.getForEntity(TAGS_URL, Map.class);
            if (r.getBody() != null && r.getBody().containsKey("models")) {
                List<Map<String, Object>> list = (List<Map<String, Object>>) r.getBody().get("models");
                list.forEach(m -> { if (m.get("name") != null) models.add(m.get("name").toString()); });
            }
        } catch (Exception e) { log.warn("Could not fetch model list: {}", e.getMessage()); }
        return models;
    }

    public boolean isOllamaReachable() {
        try { restTemplate.getForEntity(OLLAMA_BASE, String.class); return true; }
        catch (Exception e) { return false; }
    }

    public ExecutorService getStreamExecutor() { return streamExecutor; }
    public String getDefaultModel() { return DEFAULT_MODEL; }
    private String resolve(String model) { return (model != null && !model.isBlank()) ? model : DEFAULT_MODEL; }
}
