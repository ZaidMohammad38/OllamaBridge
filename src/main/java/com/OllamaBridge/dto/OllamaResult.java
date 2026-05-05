package com.OllamaBridge.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Maps the non-streaming JSON response from Ollama /api/generate.
 * Ollama returns snake_case keys (eval_count, eval_duration) — @JsonProperty
 * handles that.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OllamaResult {

    private String response;

    @JsonProperty("eval_count")
    private int evalCount;

    @JsonProperty("eval_duration")
    private long evalDuration;

    public OllamaResult() {
    }

    public String getResponse() {
        return response != null ? response : "";
    }

    public void setResponse(String response) {
        this.response = response;
    }

    public int getEvalCount() {
        return evalCount;
    }

    public void setEvalCount(int evalCount) {
        this.evalCount = evalCount;
    }

    public long getEvalDuration() {
        return evalDuration;
    }

    public void setEvalDuration(long evalDuration) {
        this.evalDuration = evalDuration;
    }

    /** eval_duration is in nanoseconds — convert to milliseconds */
    public long getResponseTimeMs() {
        return evalDuration > 0 ? evalDuration / 1_000_000 : 0;
    }
}
