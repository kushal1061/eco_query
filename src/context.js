import { getChatHistory } from "./chatdb.js";

export function getRecentContext(chatId) {
  let history = getChatHistory(chatId);

  let users = [];
  let assistants = [];

  for (let i = history.length - 1; i >= 0; i--) {
    let msg = history[i];

    if (msg.role === "user" && users.length < 3) {
      users.push(msg.content);
    }

    if ((msg.role === "ollama" || msg.role === "assistant") && assistants.length < 3) {
      assistants.push(msg.content);
    }

    if (users.length === 3 && assistants.length === 3) break;
  }

  return {
    users: users.reverse(),
    assistants: assistants.reverse()
  };
}

export function buildContextPrompt(users, assistants) {
  return `
You are a context extraction engine for an AI system.

Your task:
Compress the conversation into a sharp, high-signal context summary.

Output requirements:
- Maximum 3 sentences
- Focus ONLY on:
  1. What the user is trying to achieve
  2. Any relevant technical/domain context
- Ignore:
  - greetings, filler, repetition
  - assistant explanations unless they affect user intent
- Do NOT explain, just output the summary
- Be specific, not generic

Conversation:

User Messages:
${users.map((u, i) => `${i + 1}. ${u}`).join("\n")}

Assistant Messages:
${assistants.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Final Context Summary:
`;
}

export async function generateSummary(model, chatId = "default") {
  if (!model) {
    console.warn("Skipping summary generation because no local model is selected.");
    return "";
  }

  const { users, assistants } = getRecentContext(chatId);
  const prompt = buildContextPrompt(users, assistants);

  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: prompt,
      stream: false
    })
  });

  const data = await res.json() || "";
  console.log("Summary:", data.response);
  return data.response || "";
}
export async function getQueryEmbedding(query) {
  if (!query?.trim()) {
    return [];
  }

  try {
    const response = await fetch("http://localhost:11434/api/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "embeddinggemma",
        input: query
      })
    });

    if (!response.ok) {
      throw new Error("Network response was not ok " + response.statusText);
    }

    const data = await response.json();
    const embeddings = data.embeddings ?? data.embedding ?? [];

    if (Array.isArray(embeddings[0])) {
      return embeddings[0];
    }

    return Array.isArray(embeddings) ? embeddings : [];
  } catch (error) {
    console.error("There has been a problem with your fetch operation:", error);
    return [];
  }
}
