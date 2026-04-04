import { semanticRoute } from "./routing.js";
import { generateSummary } from "./context.js";
import {
    streamOllamaResponse,
    getLocalStreamingResponse,
    resolveSelectedLocalModel,
} from "./ollama.js";
import { passThroughToChatGPT } from "./chatgpt.js";
import {
    renderLocalUserPrompt,
    createPendingResponseBubble,
    injectStreamingResponse
} from "./ui.js";
import { getChatHistory} from "./chatdb.js";
import { getQueryEmbedding } from "./context.js";
import { allocateTokenBudget } from "./advanceContext.js";
console.log("Extension loaded");

let lastText = "";
let isProcessing = false;
let userMode = "hybrid";
let lastresponse = true;
let currentLocalModel = null;
let localModelInitPromise = null;

function getCurrentChatId() {
    return window.location.pathname.split("/").filter(Boolean).pop() || "default";
}

document.addEventListener("input", () => {
    const inputBox = document.querySelector("#prompt-textarea");
    if (inputBox) {
        lastText = inputBox.innerText.trim();
    }
});

function sendToPopup(type, value) {
    if (type === "TOKEN_UPDATE") {
        chrome.storage.local.get(["tokensSaved"], (res) => {
            chrome.storage.local.set({ tokensSaved: (res.tokensSaved || 0) + value });
        });
    } else if (type === "LOCAL_QUERY_UPDATE") {
        chrome.storage.local.get(["localQueries"], (res) => {
            chrome.storage.local.set({ localQueries: (res.localQueries || 0) + value });
        });
    } else if (type === "CLOUD_QUERY_UPDATE") {
        chrome.storage.local.get(["cloudQueries"], (res) => {
            chrome.storage.local.set({ cloudQueries: (res.cloudQueries || 0) + value });
        });
    }
}

async function initializeLocalModelSelection() {
    if (!localModelInitPromise) {
        localModelInitPromise = resolveSelectedLocalModel()
            .then(({ selectedModel }) => {
                currentLocalModel = selectedModel || null;
                console.log("Resolved local model:", currentLocalModel || "none");
                return currentLocalModel;
            })
            .catch((err) => {
                currentLocalModel = null;
                console.error("Failed to resolve local model:", err);
                return null;
            })
            .finally(() => {
                localModelInitPromise = null;
            });
    }

    return localModelInitPromise;
}

async function getResolvedLocalModel() {
    if (currentLocalModel) {
        return currentLocalModel;
    }

    return initializeLocalModelSelection();
}

function showLocalModelUnavailable(label = "No local model available") {
    const pendingUi = createPendingResponseBubble(label);
    pendingUi.bubble.innerText = "No local model is available. Start Ollama and select a model in the extension popup.";
    return pendingUi;
}

async function passQueryToCloud(editor, userQuery, localModel = currentLocalModel, chatId = "default") {
    sendToPopup("CLOUD_QUERY_UPDATE", 1);

    if (lastresponse === false) {
        // const summary = await generateSummary(localModel, chatId);
        const memory = getChatHistory(chatId)
            .filter(msg => msg.role === "user");
        const queryEmbedding = await getQueryEmbedding(userQuery);
        const { finalContext ,usedTokens, selected } = allocateTokenBudget(memory, queryEmbedding);
        if (finalContext) {
            passThroughToChatGPT(editor, finalContext + "\n\nUser Query: " + userQuery);
        } else {
            passThroughToChatGPT(editor, userQuery);
        }
    } else {
        passThroughToChatGPT(editor, userQuery);
    }

    lastresponse = true;
}

initializeLocalModelSelection();

chrome.storage.local.get(["userChoice"], (res) => {
    userMode = res.userChoice || "hybrid";
    console.log("Initial userMode:", userMode);
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.userChoice) {
        userMode = changes.userChoice.newValue || "hybrid";
        console.log("userMode updated:", userMode);
    }

    if (changes.selectedLocalModel) {
        currentLocalModel = changes.selectedLocalModel.newValue || null;
        console.log("selectedLocalModel updated:", currentLocalModel || "none");
    }
});

document.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || e.shiftKey) {
        return;
    }

    if (isProcessing) {
        return;
    }

    const editor = document.querySelector("#prompt-textarea");
    if (!editor) {
        return;
    }

    const userQuery = editor.innerText.trim();
    if (!userQuery) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    editor.innerText = "";
    isProcessing = true;
    console.log("Intercepted query in mode:", userMode);

    try {
        const selectedModel = await getResolvedLocalModel();
        const currentChatId = getCurrentChatId();
        console.log("Current chat ID:", currentChatId);

        if (userMode === "local") {
            renderLocalUserPrompt(userQuery);

            if (!selectedModel) {
                showLocalModelUnavailable("Local model unavailable");
                return;
            }

            const localRouteInfo = {
                decision: "local",
                confidence: "high",
                override: null,
                layer: 1,
            };
            const userToken = Math.ceil(userQuery.length / 4);
            sendToPopup("TOKEN_UPDATE", userToken);
            sendToPopup("LOCAL_QUERY_UPDATE", 1);
            const pendingUi = createPendingResponseBubble(`Local model selected: ${selectedModel}`);
            const streamResponse = await getLocalStreamingResponse(userQuery, selectedModel, currentChatId);
            await injectStreamingResponse(streamOllamaResponse(streamResponse, currentChatId,userQuery), localRouteInfo, pendingUi);
            lastresponse = false;

        } else if (userMode === "cloud") {
            await passQueryToCloud(editor, userQuery, selectedModel, currentChatId);
        } else {
            const userPromptSection = renderLocalUserPrompt(userQuery);
            const pendingUi = createPendingResponseBubble("Routing...");
            try {
                const routeInfo = await semanticRoute(userQuery, selectedModel);
                console.log("Final route:", routeInfo);

                if (routeInfo.decision === "local" && selectedModel) {
                    const userToken = Math.ceil(userQuery.length / 4);
                    sendToPopup("TOKEN_UPDATE", userToken);
                    sendToPopup("LOCAL_QUERY_UPDATE", 1);
                    const streamResponse = await getLocalStreamingResponse(userQuery, selectedModel, currentChatId);
                    await injectStreamingResponse(streamOllamaResponse(streamResponse, currentChatId,userQuery), routeInfo, pendingUi);
                    lastresponse = false;

                } else {
                    userPromptSection.remove();
                    pendingUi.section.remove();
                    await passQueryToCloud(editor, userQuery, selectedModel, currentChatId);
                }
            } catch (err) {
                console.error("Routing error, falling back to cloud:", err);
                userPromptSection.remove();
                pendingUi.section.remove();
                await passQueryToCloud(editor, userQuery, selectedModel, currentChatId);
                }
        }
    } catch (err) {
        console.error("Fatal error in keydown handler:", err);
    } finally {
        setTimeout(() => {
            isProcessing = false;
        }, 300);
    }
}, true);
