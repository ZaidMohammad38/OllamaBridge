package com.OllamaBridge.dto;

public class SessionUpdateRequest {
    private String model;
    private String systemPrompt;
    private String title;

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
