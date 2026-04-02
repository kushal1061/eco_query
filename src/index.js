import { semanticRoute } from "./routing.js";
import { generateSummary } from "./context.js";
import { streamOllamaResponse, getLocalStreamingResponse } from "./ollama.js";
import { passThroughToChatGPT } from "./chatgpt.js";
import {
    renderLocalUserPrompt,
    createPendingResponseBubble,
    injectStreamingResponse
} from "./ui.js";

console.log("Extension loaded");

let lastText = "";
let isProcessing = false;

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

let userMode = "hybrid"; // default mode
let lastresponse = true; // tracks if last response was cloud (true) or local/fresh (false)

// Keep userMode in sync with storage changes (e.g. popup toggle)
chrome.storage.local.get(["userChoice"], (res) => {
    userMode = res.userChoice || "hybrid";
    console.log("Initial userMode:", userMode);
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.userChoice) {
        userMode = changes.userChoice.newValue || "hybrid";
        console.log("userMode updated:", userMode);
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
        if (userMode === "local") {
            const localRouteInfo = {
                decision: "local",
                confidence: "high",
                override: null,
                layer: 1,
            };
            const userToken = Math.ceil(userQuery.length / 4);
            sendToPopup("TOKEN_UPDATE", userToken);
            sendToPopup("LOCAL_QUERY_UPDATE", 1);
            renderLocalUserPrompt(userQuery);
            const pendingUi = createPendingResponseBubble("Local model selected");
            const streamResponse = await getLocalStreamingResponse(userQuery, "ministral-3:8b");
            await injectStreamingResponse(streamOllamaResponse(streamResponse), localRouteInfo, pendingUi);
            lastresponse = false;

        } else if (userMode === "cloud") {
            sendToPopup("CLOUD_QUERY_UPDATE", 1);
            if (lastresponse === false) {
                const summary = await generateSummary();
                passThroughToChatGPT(editor, `summary:${summary},original_query:${userQuery}`);
            } else {
                passThroughToChatGPT(editor, userQuery);
            }
            lastresponse = true;
        } else {
            const userPromptSection = renderLocalUserPrompt(userQuery);
            const pendingUi = createPendingResponseBubble("Routing...");
            try {
                const routeInfo = await semanticRoute(userQuery);
                console.log("Final route:", routeInfo);

                if (routeInfo.decision === "local") {
                    const userToken = Math.ceil(userQuery.length / 4);
                    sendToPopup("TOKEN_UPDATE", userToken);
                    sendToPopup("LOCAL_QUERY_UPDATE", 1);
                    const streamResponse = await getLocalStreamingResponse(userQuery, "ministral-3:8b");
                    await injectStreamingResponse(streamOllamaResponse(streamResponse), routeInfo, pendingUi);
                    lastresponse = false; 

                } else {
                    userPromptSection.remove();
                    pendingUi.section.remove();
                    sendToPopup("CLOUD_QUERY_UPDATE", 1);
                    if (lastresponse === false) {
                        const summary = await generateSummary();
                        passThroughToChatGPT(editor, `summary:${summary},original_query:${userQuery}`);
                    } else {
                        passThroughToChatGPT(editor, userQuery);
                    }
                    lastresponse = true;
                }
            } catch (err) {
                console.error("Routing error, falling back to cloud:", err);
                userPromptSection.remove();
                pendingUi.section.remove();
                sendToPopup("CLOUD_QUERY_UPDATE", 1);
                if (lastresponse === false) {
                    const summary = await generateSummary();
                    passThroughToChatGPT(editor, `summary:${summary},original_query:${userQuery}`);
                } else {
                    passThroughToChatGPT(editor, userQuery);
                }
                lastresponse = true;
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
