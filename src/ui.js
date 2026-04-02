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
    ensureLocalResponseStyles();
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
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.6;
        word-break: break-word;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    bubble.dataset.localResponseBubble = "true";

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

export function ensureLocalResponseStyles() {
    if (document.getElementById("llm-local-response-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "llm-local-response-style";
    style.textContent = `
        [data-local-response-bubble="true"] {
            white-space: normal;
        }

        [data-local-response-bubble="true"] p,
        [data-local-response-bubble="true"] ul,
        [data-local-response-bubble="true"] ol,
        [data-local-response-bubble="true"] blockquote,
        [data-local-response-bubble="true"] pre,
        [data-local-response-bubble="true"] table {
            margin: 0 0 14px;
        }

        [data-local-response-bubble="true"] > :last-child,
        [data-local-response-bubble="true"] p:last-child,
        [data-local-response-bubble="true"] ul:last-child,
        [data-local-response-bubble="true"] ol:last-child,
        [data-local-response-bubble="true"] blockquote:last-child,
        [data-local-response-bubble="true"] pre:last-child,
        [data-local-response-bubble="true"] table:last-child {
            margin-bottom: 0;
        }

        [data-local-response-bubble="true"] h1,
        [data-local-response-bubble="true"] h2,
        [data-local-response-bubble="true"] h3,
        [data-local-response-bubble="true"] h4,
        [data-local-response-bubble="true"] h5,
        [data-local-response-bubble="true"] h6 {
            margin: 18px 0 10px;
            line-height: 1.35;
            font-weight: 600;
        }

        [data-local-response-bubble="true"] h1:first-child,
        [data-local-response-bubble="true"] h2:first-child,
        [data-local-response-bubble="true"] h3:first-child,
        [data-local-response-bubble="true"] h4:first-child,
        [data-local-response-bubble="true"] h5:first-child,
        [data-local-response-bubble="true"] h6:first-child {
            margin-top: 0;
        }

        [data-local-response-bubble="true"] ul,
        [data-local-response-bubble="true"] ol {
            padding-left: 20px;
        }

        [data-local-response-bubble="true"] li + li {
            margin-top: 4px;
        }

        [data-local-response-bubble="true"] blockquote {
            padding-left: 12px;
            border-left: 3px solid rgba(255,255,255,0.18);
            color: rgba(240,240,240,0.8);
        }

        [data-local-response-bubble="true"] :not(pre) > code {
            padding: 0.18em 0.45em;
            border-radius: 6px;
            background: rgba(255,255,255,0.08);
            color: #f8f8f2;
            font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.92em;
        }

        [data-local-response-bubble="true"] .llm-code-block {
            margin: 0 0 14px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 12px;
            overflow: hidden;
            background: #171717;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        [data-local-response-bubble="true"] .llm-code-block:last-child {
            margin-bottom: 0;
        }

        [data-local-response-bubble="true"] .llm-code-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: #202020;
        }

        [data-local-response-bubble="true"] .llm-code-lang {
            color: rgba(255,255,255,0.7);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.02em;
            text-transform: none;
        }

        [data-local-response-bubble="true"] .llm-copy-button {
            border: 1px solid rgba(255,255,255,0.14);
            background: rgba(255,255,255,0.04);
            color: #f0f0f0;
            border-radius: 8px;
            padding: 4px 10px;
            font-size: 12px;
            line-height: 1.2;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        }

        [data-local-response-bubble="true"] .llm-copy-button:hover {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.22);
        }

        [data-local-response-bubble="true"] .llm-copy-button:disabled {
            cursor: default;
            opacity: 0.9;
        }

        [data-local-response-bubble="true"] .llm-code-block pre {
            margin: 0;
            padding: 14px 16px 16px;
            background: transparent;
            overflow-x: auto;
            white-space: pre;
            word-break: normal;
        }

        [data-local-response-bubble="true"] .llm-code-block pre code {
            display: block;
            color: #f7f7f3;
            font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 13px;
            line-height: 1.65;
            background: transparent;
        }
    `;
    document.head.appendChild(style);
}

function formatCodeLanguageLabel(language) {
    const normalized = String(language || "").trim().toLowerCase();
    if (!normalized) {
        return "Code";
    }

    const aliases = {
        js: "JavaScript",
        jsx: "JSX",
        ts: "TypeScript",
        tsx: "TSX",
        py: "Python",
        sh: "Shell",
        bash: "Bash",
        zsh: "Zsh",
        html: "HTML",
        css: "CSS",
        scss: "SCSS",
        json: "JSON",
        yml: "YAML",
        yaml: "YAML",
        md: "Markdown",
        sql: "SQL",
        xml: "XML",
        toml: "TOML",
        ini: "INI",
        c: "C",
        cpp: "C++",
        cs: "C#",
        go: "Go",
        java: "Java",
        php: "PHP",
        rb: "Ruby",
        rs: "Rust",
    };

    if (aliases[normalized]) {
        return aliases[normalized];
    }

    return normalized
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getCodeLanguage(code) {
    const rawClass = String(code?.className || "").trim();
    if (!rawClass) {
        return "";
    }

    return rawClass.split(/\s+/)[0];
}

function setCopyButtonLabel(button, label) {
    button.innerText = label;
}

function showCopyButtonState(button, label) {
    if (button._copyResetTimer) {
        window.clearTimeout(button._copyResetTimer);
    }

    setCopyButtonLabel(button, label);
    button.disabled = true;
    button._copyResetTimer = window.setTimeout(() => {
        button.disabled = false;
        setCopyButtonLabel(button, "Copy");
    }, 1600);
}

export function updateCodeHeaderLanguage(pre, code) {
    const shell = pre.closest(".llm-code-block");
    const label = shell?.querySelector(".llm-code-lang");
    if (!label) {
        return;
    }

    label.innerText = formatCodeLanguageLabel(getCodeLanguage(code));
}

export async function copyCodeToClipboard(text, button) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            throw new Error("Clipboard API unavailable");
        }
        showCopyButtonState(button, "Copied");
    } catch (clipboardError) {
        try {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.cssText = `
                position: fixed;
                opacity: 0;
                pointer-events: none;
                top: -9999px;
                left: -9999px;
            `;
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            const copied = document.execCommand("copy");
            textarea.remove();

            if (!copied) {
                throw clipboardError;
            }

            showCopyButtonState(button, "Copied");
        } catch (fallbackError) {
            console.error("Code copy failed:", fallbackError);
            showCopyButtonState(button, "Copy failed");
        }
    }
}

export function enhanceCodeBlock(pre, code) {
    const shell = document.createElement("div");
    shell.className = "llm-code-block";

    const header = document.createElement("div");
    header.className = "llm-code-header";

    const languageLabel = document.createElement("span");
    languageLabel.className = "llm-code-lang";
    languageLabel.innerText = formatCodeLanguageLabel(getCodeLanguage(code));

    const copyButton = document.createElement("button");
    copyButton.className = "llm-copy-button";
    copyButton.type = "button";
    copyButton.innerText = "Copy";
    copyButton.addEventListener("click", async () => {
        await copyCodeToClipboard(code.textContent || "", copyButton);
    });

    header.appendChild(languageLabel);
    header.appendChild(copyButton);

    pre.parentElement.insertBefore(shell, pre);
    shell.appendChild(header);
    shell.appendChild(pre);
    pre.dataset.codeBlockEnhanced = "true";
}

export function decorateCodeBlocks(root) {
    if (!root) {
        return;
    }

    const blocks = root.querySelectorAll("pre > code");
    blocks.forEach(code => {
        const pre = code.parentElement;
        if (!pre) {
            return;
        }

        if (pre.dataset.codeBlockEnhanced === "true") {
            updateCodeHeaderLanguage(pre, code);
            return;
        }

        enhanceCodeBlock(pre, code);
        updateCodeHeaderLanguage(pre, code);
    });
}

export async function injectStreamingResponse(tokenGenerator, routeInfo, existingResponseUi = null) {
    const responseUi = existingResponseUi || createResponseBubble(routeInfo);
    const bubble = responseUi.bubble;
    applyRouteBadge(responseUi.badge, routeInfo);
    ensureLocalResponseStyles();

    const cursor = setThinkingState(bubble, "Thinking");

    let started = false;
    let parser;
    let mdContainer;

    try {
        for await (const token of tokenGenerator) {
            if (!started) {
                started = true;

                bubble.innerHTML = "";

                mdContainer = document.createElement("div");
                bubble.appendChild(mdContainer);
                bubble.appendChild(cursor);

                parser = smd.parser(smd.default_renderer(mdContainer));
            }

            smd.parser_write(parser, token);
            decorateCodeBlocks(mdContainer);
        }

    } catch (err) {
        bubble.innerText = `Error: ${err.message}`;
        console.error("Streaming error:", err);
        return;
    }

    cursor.remove();
    if (parser && smd.parser_end) {
        smd.parser_end(parser);
    } else if (parser && parser.end) {
        parser.end();
    }

    decorateCodeBlocks(mdContainer);

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
