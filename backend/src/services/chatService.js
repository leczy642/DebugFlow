// chatService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Handles conversational AI logic (HuggingFace, OpenAI, or DeepSeek)
// - Conditionally enables web search via prompt-based detection
//   (avoids the `tools` API parameter which crashes DeepSeek providers)

import "../utils/loadEnv.js";
import { InferenceClient } from "@huggingface/inference";
import { searchWeb } from "./searchService.js";
import { isWebSearchEnabled } from "./systemSettingsService.js";

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

// --- Conditional Search ------------------------------------------------------
// Search is ONLY enabled when TAVILY_API_KEY is configured.
const SEARCH_ENABLED = !!process.env.TAVILY_API_KEY;

if (SEARCH_ENABLED) {
  console.log("🔍 Web Search is ENABLED (TAVILY_API_KEY found).");
} else {
  console.log("ℹ️  Web Search is DISABLED (no TAVILY_API_KEY).");
}

// --- System Prompts -----------------------------------------------------------

// Lightweight prompt for the FAST MODEL — only decides if a search is needed.
// It must ONLY output the tag or a short refusal. No full answers.
const SEARCH_DECISION_PROMPT = `You are a search-decision assistant. Your ONLY job is to decide whether a web search is needed.

Rules:
1. If the user's question requires CURRENT technical information (latest library versions, recent bug fixes, new API changes, security patches), output EXACTLY:
   [SEARCH: concise technical search query]
   Then STOP. Do not write anything else.

2. If the question does NOT need a search (general knowledge, coding help, math, non-technical topics), output EXACTLY:
   [NO_SEARCH]
   Then STOP. Do not write anything else.

You may ONLY search for: technical debugging, error messages, library docs, software vulnerabilities.
You may NOT search for: news, sports, weather, politics, celebrities, non-technical URLs.`;

// System prompt injected into the SMART MODEL when search results are available.
const SEARCH_CONTEXT_PROMPT = `You are a specialized Debugging Assistant. You have been provided with fresh, numbered web search results below.

CITATION RULES (you MUST follow these):
- When you use information from a source, cite it with a bracketed number, e.g. [1], [2].
- Place the citation immediately after the sentence or claim it supports.
- You may cite multiple sources for one claim, e.g. [1][3].
- Do NOT invent citation numbers beyond those provided.
- Do NOT include a "References" or "Sources" section at the end — the UI handles that automatically.
- Use the search results to give an accurate, detailed answer to the user's question.`;

/**
 * Helper to get the standard and fast models from environment variables.
 */
function getModels() {
  const smartModel = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.2:fireworks-ai";
  // Fallback to smart model if fast model is not defined
  const fastModel = process.env.HUGGINGFACE_FAST_MODEL || smartModel;
  return { smartModel, fastModel };
}

/**
 * Detect if text contains a search request tag.
 */
function detectSearchTag(text) {
  const match = text.match(/\[SEARCH:\s*(.+?)\]/);
  if (match) {
    return { found: true, query: match[1].trim() };
  }
  return { found: false, query: "" };
}

/**
 * Fast pre-check: Ask the lightweight model if a search is needed.
 * Returns the search query if yes, or null if no.
 */
async function fastSearchDecision(messages) {
  const { fastModel } = getModels();
  console.log(`⚡ Fast search decision (${fastModel})...`);

  try {
    const response = await hf.chatCompletion({
      model: fastModel,
      messages: [
        { role: "system", content: SEARCH_DECISION_PROMPT },
        // Only send the last user message for the decision — keeps it fast
        ...messages.slice(-2)
      ],
      max_tokens: 100, // Very short — only needs to output the tag
    });

    const content = response.choices?.[0]?.message?.content || "";
    console.log(`⚡ Fast model decision: ${content.trim().substring(0, 80)}`);

    const result = detectSearchTag(content);
    return result.found ? result.query : null;
  } catch (err) {
    console.warn("⚠️ Fast search decision failed, skipping search:", err.message);
    return null; // Degrade gracefully — just skip the search
  }
}

/**
 * Helper to race an async operation against a timeout.
 */
async function withTimeout(promise, timeoutMs) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("ORCH_SEARCH_TIMEOUT")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

// ---------------------------------------------------------------------------
// NON-STREAMING CHAT
// ---------------------------------------------------------------------------
export async function chatWithAI(messages) {
  const { smartModel } = getModels();
  const useFastPass = process.env.USE_FAST_MODEL_PASS !== "false";
  const searchGlobalEnabled = await isWebSearchEnabled();

  // Step 1: Fast pre-check for search (if enabled and fast pass not disabled)
  let searchResults = null;
  let searchError = false;

  if (SEARCH_ENABLED && useFastPass && (await isWebSearchEnabled())) {
    const searchQuery = await fastSearchDecision(messages);
    if (searchQuery) {
      console.log(`🔍 Search triggered for: ${searchQuery}`);
      try {
        // Orchestration Phase: Wrap search in a timeout (25 seconds)
        // This ensures Case 1 (Tavily is slow/unavailable) triggers a fallback.
        searchResults = await withTimeout(searchWeb(searchQuery), 25000);

        // Check if the search results themselves indicate an error
        if (searchResults.length === 1 && searchResults[0].title === "Error") {
          console.warn("⚠️ Search service returned an error result.");
          searchResults = null;
          searchError = true;
        }
      } catch (err) {
        if (err.message === "ORCH_SEARCH_TIMEOUT") {
          console.error("⏳ Orchestration: Search timed out after 25s.");
        } else {
          console.error("❌ Search request failed:", err.message);
        }
        searchError = true;
      }
    }
  }

  // Step 2: Smart model generates the actual response
  const finalMessages = [];

  if (searchResults) {
    finalMessages.push({ role: "system", content: SEARCH_CONTEXT_PROMPT });
    finalMessages.push(...messages);

    const numberedResults = searchResults.map((r, i) =>
      `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
    ).join('\n\n');

    finalMessages.push({
      role: "user",
      content: `Here are the web search results:\n\n${numberedResults}\n\nPlease answer the original question using these results. Remember to cite sources using [1], [2], etc.`
    });
  } else if (searchError) {
    // If search failed or timed out, tell the model to use its fallback knowledge
    finalMessages.push(...messages);
    finalMessages.push({
      role: "system",
      content: "NOTE: A web search was attempted but the service is currently unavailable or too slow. Please answer the user's question to the best of your ability using your internal training data, and briefly mention that you couldn't access live results right now."
    });
  } else {
    // If search is disabled or no search was triggered, provide the standard prompt
    finalMessages.push(...messages);
  }

  console.log(`🧠 Generating response with smart model: ${smartModel}`);
  const response = await hf.chatCompletion({
    model: smartModel,
    messages: finalMessages,
    max_tokens: 65536,
  });

  return response.choices[0]?.message?.content || "";
}

// ---------------------------------------------------------------------------
// STREAMING CHAT (SSE) — Two-step: fast pre-check → smart streaming
// ---------------------------------------------------------------------------
export async function* streamChatWithAI(messages) {
  const { smartModel } = getModels();
  const useFastPass = process.env.USE_FAST_MODEL_PASS !== "false";

  // Step 1: Fast pre-check for search (if enabled and fast pass not disabled)
  let searchResults = null;
  let searchError = false;

  if (SEARCH_ENABLED && useFastPass && (await isWebSearchEnabled())) {
    const searchQuery = await fastSearchDecision(messages);
    if (searchQuery) {
      console.log(`🔍 Search triggered for: ${searchQuery}`);

      // Signal the frontend to keep the loader active
      yield { isSearching: true };

      try {
        // Orchestration Phase: Wrap search in a timeout (25 seconds)
        searchResults = await withTimeout(searchWeb(searchQuery), 25000);

        // Check if the search results themselves indicate an error
        if (searchResults.length === 1 && searchResults[0].title === "Error") {
          console.warn("⚠️ Search service returned an error result.");
          searchResults = null;
          searchError = true;
        } else {
          console.log(`✅ Search results received, handed off to smart model...`);
          yield { isReading: true };
        }
      } catch (err) {
        if (err.message === "ORCH_SEARCH_TIMEOUT") {
          console.error("⏳ Orchestration: Search timed out after 25s.");
        } else {
          console.error("❌ Search request failed:", err.message);
        }
        searchError = true;
      }
    }
  }

  // Step 2: Smart model ALWAYS generates the streamed response
  const finalMessages = [];

  if (searchResults) {
    finalMessages.push({ role: "system", content: SEARCH_CONTEXT_PROMPT });
    finalMessages.push(...messages);

    // Build a numbered source list for the model
    const numberedResults = searchResults.map((r, i) =>
      `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
    ).join('\n\n');

    finalMessages.push({
      role: "user",
      content: `Here are the web search results:\n\n${numberedResults}\n\nPlease answer the original question using these results. Remember to cite sources using [1], [2], etc.`
    });

    // Yield source metadata so the frontend can render the reference pill
    yield { searchSources: searchResults.map((r, i) => ({ index: i + 1, title: r.title, url: r.url })) };
  } else if (searchError) {
    // If search failed or timed out, tell the model to use its fallback knowledge
    finalMessages.push(...messages);
    finalMessages.push({
      role: "system",
      content: "NOTE: A web search was attempted but the service is currently unavailable or too slow. Please answer the user's question to the best of your ability using your internal training data, and briefly mention that you couldn't access live results right now."
    });
  } else {
    finalMessages.push(...messages);
  }

  console.log(`🧠 Starting stream with smart model: ${smartModel}`);
  yield { isGenerating: true };

  try {
    const stream = hf.chatCompletionStream({
      model: smartModel,
      messages: finalMessages,
      max_tokens: 65536,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield chunk;
      }
    }
    console.log("✅ Stream finished.");
  } catch (err) {
    console.error(`❌ Stream error for model ${smartModel}:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// SESSION TITLE GENERATION (Fast Model)
// ---------------------------------------------------------------------------
export async function generateSessionTitle(message) {
  const { fastModel } = getModels();
  const promptSystem = {
    role: "system",
    content:
      "You are a concise title generator. Given a user's message, return a short, meaningful title (3-8 words) that summarizes the main intent or subject. Return only the title text with no surrounding punctuation. Keep it human-readable and specific."
  };

  console.log(`📡 Generating title using fast model: ${fastModel}`);
  const response = await hf.chatCompletion({
    model: fastModel,
    messages: [promptSystem, { role: "user", content: message }],
  });

  const title = response.choices?.[0]?.message?.content || "New Debug Session";
  return title.trim().replace(/\s+/g, " ").slice(0, 120);
}