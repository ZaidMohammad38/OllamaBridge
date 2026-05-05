package com.OllamaBridge.dto;

public class ChatRequest {
    private String prompt;
    private String model;       // optional override; if null uses session model
    private String systemPrompt; // optional override

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }
}