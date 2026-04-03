const DEFAULT_CHAT_ID = "default";
const MAX_CHAT_HISTORY = 20;

function getChatHistoryKey(chatId = DEFAULT_CHAT_ID) {
  return `chat_history_${chatId || DEFAULT_CHAT_ID}`;
}

export function getChatHistory(chatId = DEFAULT_CHAT_ID) {
  return JSON.parse(localStorage.getItem(getChatHistoryKey(chatId))) || [];
}

export function addMessage(role, content, chatId = DEFAULT_CHAT_ID) {
  let history = getChatHistory(chatId);
  history.push({
    role,
    content,
    time: Date.now()
  });

  if (history.length > MAX_CHAT_HISTORY) {
    history = history.slice(-MAX_CHAT_HISTORY);
  }

  localStorage.setItem(getChatHistoryKey(chatId), JSON.stringify(history));
}

export function buildOllamaMessages(chatId = DEFAULT_CHAT_ID, nextUserMessage = null) {
  const messages = getChatHistory(chatId)
    .filter((message) => message?.content)
    .map((message) => ({
      role: message.role === "ollama" ? "assistant" : message.role,
      content: message.content
    }))
    .filter((message) => message.role === "user" || message.role === "assistant");

  if (nextUserMessage) {
    messages.push({
      role: "user",
      content: nextUserMessage
    });
  }
  return messages;
}
