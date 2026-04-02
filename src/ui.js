import * as smd from "streaming-markdown"
export function getConversationContainer() {
    const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"], section[data-turn]');
    if (turns.length > 0) {
        return turns[turns.length - 1].parentElement || document.body;
    }

    const existingHost = document.getElementById("local-thread-host");
    if (existingHost) {
        return existingHost;
    }

    const composer = document.querySelector("#prompt-textarea");
    const composerForm = composer ? composer.closest("form") : null;
    const main = document.querySelector("main") || document.body;
    const host = document.createElement("div");
    host.id = "local-thread-host";
    host.style.cssText = `
        width: 100%;
        max-width: 48rem;
        margin: 0 auto 16px;
        padding: 0 16px;
        box-sizing: border-box;
    `;

    if (composerForm && composerForm.parentElement) {
        composerForm.parentElement.insertAdjacentElement("beforebegin", host);
    } else {
        main.appendChild(host);
    }

    return host;
}

export function renderLocalUserPrompt(query) {
    const container = getConversationContainer();
    const section = document.createElement("section");
    section.setAttribute("data-turn", "user");
    section.style.cssText = "margin-top: 12px; display: flex; justify-content: flex-end;";

    const bubble = document.createElement("div");
    bubble.className = "user-message-bubble-color corner-superellipse/0.98 relative rounded-[22px] px-4 py-2.5 leading-6 max-w-(--user-chat-width,70%)";
    bubble.style.cssText = `
        white-space: pre-wrap;
        word-break: break-word;
    `;
    bubble.innerText = query;

    section.appendChild(bubble);
    container.appendChild(section);
    section.scrollIntoView({ block: "end", behavior: "smooth" });
    return section;
}

export function createResponseBubble(routeInfo) {
    const container = getConversationContainer();
    const section = document.createElement("section");
    section.setAttribute("data-turn", "assistant");
    section.style.marginTop = "12px";

    const badge = document.createElement("div");
    applyRouteBadge(badge, routeInfo);

    const bubble = document.createElement("div");
    const isPending = routeInfo.decision === "pending";
    const isLocal = routeInfo.decision === "local";
    const accent = isPending ? "#c6c6c6" : (isLocal ? "#10a37f" : "#e55300");
    bubble.style.cssText = `
        padding: 12px 16px;
        background: #2d2d2d;
        color: #f0f0f0;
        border-radius: 10px;
        border-left: 3px solid ${accent};
        font-family: ui-monospace, monospace;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    const wrapper = document.createElement("div");
    wrapper.appendChild(badge);
    wrapper.appendChild(bubble);
    section.appendChild(wrapper);
    container.appendChild(section);
    section.scrollIntoView({ block: "end", behavior: "smooth" });

    return { section, badge, bubble };
}

export function applyRouteBadge(badge, routeInfo) {
    const decision = routeInfo?.decision || "pending";
    const isPending = decision === "pending";
    const isLocal = decision === "local";
    const background = isPending ? "#5f5f5f33" : (isLocal ? "#10a37f22" : "#e5530022");
    const color = isPending ? "#d0d0d0" : (isLocal ? "#10a37f" : "#e55300");
    const border = isPending ? "#c6c6c655" : (isLocal ? "#10a37f55" : "#e5530055");

    const label = isPending
        ? (routeInfo?.label || "Routing...")
        : (isLocal
            ? `Local | ${routeInfo.confidence || "unknown"} confidence | Layer ${routeInfo.layer || "1"} `
            : `ChatGPT | ${routeInfo.override || routeInfo.confidence || "cloud"}`);

    badge.style.cssText = `
        display: inline-block;
        font-size: 11px;
        font-family: monospace;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 6px;
        background: ${background};
        color: ${color};
        border: 1px solid ${border};
    `;
    badge.innerText = label;
}

export function ensureCursorStyle() {
    if (document.getElementById("llm-cursor-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "llm-cursor-style";
    style.textContent = "@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }";
    document.head.appendChild(style);
}

export async function injectStreamingResponse(tokenGenerator, routeInfo, existingResponseUi = null) {
    const responseUi = existingResponseUi || createResponseBubble(routeInfo);
    const bubble = responseUi.bubble;
    applyRouteBadge(responseUi.badge, routeInfo);

    const cursor = setThinkingState(bubble, "Thinking");

    let started = false;
    let parser;
    let renderer;

    try {
        for await (const token of tokenGenerator) {
            if (!started) {
                started = true;

                bubble.innerHTML = "";

                const mdContainer = document.createElement("span");
                bubble.appendChild(mdContainer);
                bubble.appendChild(cursor);

                renderer = smd.default_renderer(mdContainer);
                parser = smd.parser(renderer);
            }

            smd.parser_write(parser, token);
        }

    } catch (err) {
        bubble.innerText = `Error: ${err.message}`;
        console.error("Streaming error:", err);
        return;
    }

    cursor.remove();
    if (smd.parser_end) {
        smd.parser_end(parser);
    } else if (parser && parser.end) {
        parser.end();
    }

    console.log("Streaming complete");
}

export function setThinkingState(bubble, message = "Thinking") {
    ensureCursorStyle();
    bubble.innerHTML = "";

    const thinking = document.createElement("span");
    thinking.innerText = message;
    thinking.style.opacity = "0.7";

    const dots = document.createElement("span");
    dots.innerText = "...";
    dots.style.cssText = "animation: blink 1s infinite;";

    const cursor = document.createElement("span");
    cursor.innerText = "|";
    cursor.style.cssText = "animation: blink 0.7s step-end infinite;";

    bubble.appendChild(thinking);
    bubble.appendChild(dots);
    bubble.appendChild(cursor);
    return cursor;
}

export function createPendingResponseBubble(label = "Routing local model...") {
    const responseUi = createResponseBubble({ decision: "pending", label });
    setThinkingState(responseUi.bubble, "Thinking");
    return responseUi;
}
