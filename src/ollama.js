import { addMessage } from './context.js';

export async function* streamOllamaResponse(response) {
    if (!response.ok) {
        throw new Error(`Ollama HTTP error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = "";
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const json = JSON.parse(trimmed);
            result += json.response || "";
            
            if (json.response) {
                yield json.response;
            }
            if (json.done) {
                addMessage("ollama", result);
                console.log("Ollama stream ended");
                return;
            }
            if (json.error) {
                throw new Error(`Ollama: ${json.error}`);
            }
        }
    }

    if (!buffer.trim()) return;

    const json = JSON.parse(buffer.trim());
    if (json.response) {
        yield json.response;
    }
}

export async function getLocalStreamingResponse(query, model = "ministral-3:8b") {
    return fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: model || "ministral-3:8b",
            prompt: query,
            stream: true,
        }),
    });
}

export async function findModels() {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("Available models:", data.models);
    return data.models;
}
