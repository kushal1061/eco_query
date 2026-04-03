import { addMessage, buildOllamaMessages, getChatHistory } from './chatdb.js';

const OLLAMA_BASE_URL = "http://localhost:11434";
const SELECTED_LOCAL_MODEL_KEY = "selectedLocalModel";

function getExtensionStorage(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
}

function setExtensionStorage(values) {
    return new Promise((resolve) => {
        chrome.storage.local.set(values, resolve);
    });
}

function requireModel(model) {
    if (!model) {
        throw new Error("No local Ollama model selected");
    }

    return model;
}

export async function* streamOllamaResponse(response, chatId) {
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
            const chunk = json.message?.content || json.response || "";
            result += chunk;
            
            if (chunk) {
                yield chunk;
            }
            if (json.done) {
                addMessage("ollama", result, chatId);
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
    const chunk = json.message?.content || json.response || "";
    if (chunk) {
        yield chunk;
    }
}

export async function getLocalStreamingResponse(query, model, chatId) {
    const selectedModel = requireModel(model);
    const existingHistory = getChatHistory(chatId);
    addMessage("user", query, chatId);

    if (existingHistory.length > 0) {
        return fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: selectedModel,
                messages: buildOllamaMessages(chatId),
                stream: true,
            }),
        });
    }

    return fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: selectedModel,
            prompt: query,
            stream: true,
        }),
    });
}

export async function findModels() {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("Available models:", data.models);
    return data.models;
}
export async function resolveSelectedLocalModel() {
    const models = await findModels();
    const modelNames = models
        .map((model) => model?.name)
        .filter(Boolean);

    const { [SELECTED_LOCAL_MODEL_KEY]: storedModel = null } = await getExtensionStorage([SELECTED_LOCAL_MODEL_KEY]);

    let selectedModel = null;

    if (storedModel && modelNames.includes(storedModel)) {
        selectedModel = storedModel;
    } else if (modelNames.length > 0) {
        selectedModel = modelNames[0];
    }

    if (storedModel !== selectedModel) {
        await setExtensionStorage({ [SELECTED_LOCAL_MODEL_KEY]: selectedModel });
    }

    return { selectedModel, models };
}
