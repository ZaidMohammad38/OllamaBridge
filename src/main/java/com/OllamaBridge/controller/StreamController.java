package com.OllamaBridge.controller;

import org.springframework.web.bind.annotation.RestController;

import com.OllamaBridge.service.OllamaStreamService;

import reactor.core.publisher.Flux;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequestMapping("/stream")
public class StreamController {
    
    private final OllamaStreamService streamService;

    public StreamController(OllamaStreamService streamService){
        this.streamService=streamService;
    }

    @GetMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> streamChat(@RequestParam String prompt) {
    return streamService.streamResponse(prompt);
}
}
