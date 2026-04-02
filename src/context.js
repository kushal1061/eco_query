export function addMessage(role, content) {
  let history = JSON.parse(localStorage.getItem("chat_history")) || [];

  history.push({
    role, // "user" or "assistant"
    content,
    time: Date.now()
  });

  if (history.length > 20) {
    history = history.slice(-20);
  }

  localStorage.setItem("chat_history", JSON.stringify(history));
}

export function getRecentContext() {
  let history = JSON.parse(localStorage.getItem("chat_history")) || [];

  let users = [];
  let assistants = [];

  for (let i = history.length - 1; i >= 0; i--) {
    let msg = history[i];

    if (msg.role === "user" && users.length < 3) {
      users.push(msg.content);
    }

    if (msg.role === "ollama" && assistants.length < 3) {
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

export async function generateSummary() {
  const { users, assistants } = getRecentContext();
  const prompt = buildContextPrompt(users, assistants);

  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "ministral-3:8b",
      prompt: prompt,
      stream: false
    })
  });

  const data = await res.json() || "";
  console.log("Summary:", data.response);
  return data.response || "";
}
