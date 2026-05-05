package com.OllamaBridge.dto;

public class ChatResponse {
    private String response;
    private int tokenCount;
    private long responseTimeMs;
    private String model;

    public ChatResponse(String response, int tokenCount, long responseTimeMs, String model) {
        this.response = response;
        this.tokenCount = tokenCount;
        this.responseTimeMs = responseTimeMs;
        this.model = model;
    }

    public String getResponse() { return response; }
    public int getTokenCount() { return tokenCount; }
    public long getResponseTimeMs() { return responseTimeMs; }
    public String getModel() { return model; }
}