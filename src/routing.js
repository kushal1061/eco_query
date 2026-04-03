function buildClassifierPrompt(userPrompt, conversationHistory = []) {

const historyText = conversationHistory.length > 0
    ? conversationHistory
        .slice(-6)
        .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 200)}`)
        .join('\n')
    : 'None';

  return `You are a prompt router. Your job is to classify whether a user prompt should be handled by a LOCAL LLM or sent to a CLOUD LLM (ChatGPT).

Analyze the prompt carefully across all factors below. Be conservative — only route locally if you are confident the local model can handle it well.

---
IMP: If you encounter any word like production grade , always route to CLOUD, as local models are not yet reliable for critical use cases.

## CONVERSATION HISTORY (up to last 3 turns / 6 messages)
${historyText}

---

## USER PROMPT TO CLASSIFY
"""
${userPrompt}
"""

---

## CLASSIFICATION FACTORS

Evaluate each factor and assign a score. Be honest and precise.

### FACTOR 1 — Task complexity [0–3]
0 = Trivial. Single-step lookup, definition, translation, simple math.
1 = Moderate. Short explanation, basic creative writing, summarization of provided text.
2 = High. Multi-step reasoning, code generation, structured analysis, comparisons.
3 = Very high. Architecture design, long-form writing, debugging complex code, deep research synthesis.
Score: ?

### FACTOR 2 — Context dependency [0–3]
0 = Fully self-contained. No reference to prior messages, uploaded files, or external documents.
1 = Light context. References something vague ("that idea", "the plan") but interpretable standalone.
2 = Heavy context. Explicitly references prior conversation, "the code above", "my document", "earlier".
3 = Cannot be answered without history. The prompt is meaningless without prior context.
Score: ?

### FACTOR 3 — Knowledge recency requirement [0–3]
0 = Timeless knowledge. Math, science fundamentals, history, definitions, coding concepts.
1 = Slow-changing. Best practices, established frameworks, general world knowledge.
2 = Recent knowledge required. Events, releases, or changes from the last 1–2 years.
3 = Real-time required. Today's news, live prices, current weather, breaking events.
Score: ?

### FACTOR 4 — Output precision requirement [0–3]
0 = Casual. A poem, a joke, a conversational reply. Minor errors are fine.
1 = General. An explanation or summary. Small inaccuracies tolerable.
2 = Professional. Code that should run, factual writing, structured documents.
3 = Critical. Medical, legal, financial, security-sensitive content. Errors have real consequences.
Score: ?

### FACTOR 5 — Prompt length and information density [0–2]
0 = Short and simple (under 30 words, single question or task).
1 = Medium (30–100 words, some constraints or context provided).
2 = Long or dense (100+ words, multiple requirements, detailed instructions).
Score: ?

### FACTOR 6 — Capability gap risk [0–3]
Does this task specifically require frontier model capabilities?
0 = No. A 7B–13B local model handles this comfortably.
1 = Unlikely to matter. Local model should manage but may be slightly weaker.
2 = Likely matters. Task benefits significantly from a larger, more capable model.
3 = Definite gap. Requires strong reasoning, nuanced judgment, or broad world knowledge that small models lack.
Score: ?

### FACTOR 7 — Privacy sensitivity [0 or -2]
Does the prompt contain sensitive personal, financial, health, or business-confidential information that the user likely does NOT want sent to a cloud API?
0 = Not sensitive. Safe to send to cloud.
-2 = Sensitive. Strong reason to keep this local regardless of other factors.
Score: ?

---

## SCORING RULES

Add up Factors 1–6, then add Factor 7 (which may subtract).

Total score range: -2 to 17

Routing thresholds:
- Score 0–4   → LOCAL
- Score 5–8   → LOCAL (but flag low confidence)
- Score 9–12  → CLOUD
- Score 13–17 → CLOUD (high confidence)

OVERRIDE RULES (apply before threshold):
- If Factor 3 score is 3 → ALWAYS route CLOUD (real-time data impossible locally)
- If Factor 7 score is -2 → ALWAYS route LOCAL (privacy override)
- If Factor 2 score is 3 AND no history was provided → route CLOUD with warning

---

## YOUR RESPONSE

Respond ONLY with valid JSON. No explanation outside the JSON block.

{
  "scores": {
    "complexity": <0–3>,
    "context_dependency": <0–3>,
    "recency": <0–3>,
    "precision": <0–3>,
    "density": <0–2>,
    "capability_gap": <0–3>,
    "privacy": <0 or -2>
  },
  "total": <number>,
  "route": "local" | "cloud",
  "confidence": "high" | "medium" | "low",
  "override": null | "real_time_data" | "privacy" | "missing_context",
  "reason": "<one sentence explaining the key reason for this routing decision>"
}`;
}
function stripMarkdownCodeFence(text) {
    const trimmed = (text || "").trim();
    if (!trimmed.startsWith("```")) {
        return trimmed;
    }

    const firstNewline = trimmed.indexOf("\n");
    if (firstNewline === -1) {
        return trimmed;
    }

    const withoutOpeningFence = trimmed.slice(firstNewline + 1);
    const closingFenceIndex = withoutOpeningFence.lastIndexOf("```");
    if (closingFenceIndex === -1) {
        return withoutOpeningFence.trim();
    }

    return withoutOpeningFence.slice(0, closingFenceIndex).trim();
}
function normalizeClassifierResult(parsed) {
    const route = String(parsed?.route || "").toLowerCase();
    const confidence = String(parsed?.confidence || "").toLowerCase();
    const override = parsed?.override ?? null;
    const total = Number.isFinite(parsed?.total) ? parsed.total : null;
    const decision = route === "local" ? "local" : "chatgpt";

    return {
        decision,
        route,
        confidence,
        override,
        total,
        reason: parsed?.reason || "",
        scores: parsed?.scores || null,
        layer: 2,
    };
}
 function isRealtimeOrNewsQuery(query) {
    const normalizedQuery = String(query || "").toLowerCase();
    const recencyTerms = ["latest", "current", "today", "recent", "breaking", "live", "right now"];
    const newsTerms = ["news", "headline", "headlines", "update", "updates"];
    const realtimeTopics = ["weather", "stock", "stocks", "price", "prices", "score", "scores"];

    const hasRecencyTerm = recencyTerms.some(term => normalizedQuery.includes(term));
    const hasNewsTerm = newsTerms.some(term => normalizedQuery.includes(term));
    const hasRealtimeTopic = realtimeTopics.some(term => normalizedQuery.includes(term));

    return (hasRecencyTerm && hasNewsTerm) || hasRealtimeTopic;
}
async function llmCategoryRoute(query, model) {
    if (!model) {
        return {
            decision: "chatgpt",
            route: "cloud",
            confidence: "low",
            override: "local_model_unavailable",
            total: null,
            reason: "No local model is available for routing, defaulting to cloud.",
            scores: null,
            layer: 2,
        };
    }

    const classifierPrompt = buildClassifierPrompt(query); 
    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                prompt: classifierPrompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const raw = (data.response || "").trim();
        const clean = stripMarkdownCodeFence(raw);
        const parsed = JSON.parse(clean);
        const result = normalizeClassifierResult(parsed);

        console.log(
            `LLM classifier -> ${result.decision.toUpperCase()} [route=${result.route}] confidence=${result.confidence} total=${result.total}`
        );
        return result;
    } catch (err) {
        console.error("LLM classifier failed:", err.message);
        return {
            decision: "chatgpt",
            route: "cloud",
            confidence: "low",
            override: null,
            total: null,
            reason: "Classifier failed, defaulting to cloud.",
            scores: null,
            layer: 2,
        };
    }
}
export async function semanticRoute(query, model) {
    const llmRoute = await llmCategoryRoute(query, model);

    if (
        llmRoute.override === "real_time_data" ||
        llmRoute.scores?.recency === 3 ||
        isRealtimeOrNewsQuery(query)
    ) {
        console.log("Real-time/news query detected -> CHATGPT");
        return { ...llmRoute, decision: "chatgpt", override: llmRoute.override || "real_time_data" };
    }

    if (llmRoute.confidence === "low" && llmRoute.decision === "local") {
        console.log(`Low confidence (${llmRoute.confidence}) -> CHATGPT fallback`);
        return { ...llmRoute, decision: "chatgpt" };
    }

    return llmRoute;
}