import { generateSummary } from './context.js';

export async function passThroughToChatGPT(editor, textToInject) {
    editor.innerHTML = `<p>${textToInject}</p>`;
    console.log("Passing to ChatGPT:", textToInject);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    
    // Modern react applications sometimes ignore synthetic enter keys. 
    // Button click is much more reliable. We increase timeout slightly so React can register the input.
    setTimeout(() => {
        const sendBtn = document.querySelector('[data-testid="send-button"]');
        if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
        } else {
            // fallback if button isn't found
            editor.dispatchEvent(new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                bubbles: true,
                cancelable: true,
            }));
        }
    }, 150);
}
