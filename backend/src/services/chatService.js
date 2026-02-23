// chatService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Handles conversational AI logic (HuggingFace, OpenAI, or DeepSeek)
// - Conditionally enables web search via prompt-based detection
//   (avoids the `tools` API parameter which crashes DeepSeek providers)

import "../utils/loadEnv.js";
import { InferenceClient } from "@huggingface/inference";
import { searchWeb } from "./searchService.js";

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

// --- Conditional Search ------------------------------------------------------
// Search is ONLY enabled when TAVILY_API_KEY is configured.
const SEARCH_ENABLED = !!process.env.TAVILY_API_KEY;

if (SEARCH_ENABLED) {
  console.log("🔍 Web Search is ENABLED (TAVILY_API_KEY found).");
} else {
  console.log("ℹ️  Web Search is DISABLED (no TAVILY_API_KEY).");
}

// System prompt that teaches the model to request searches via a special tag.
// This approach works with ALL models (including DeepSeek via HF router)
// because it does NOT use the `tools` API parameter.
const SEARCH_SYSTEM_PROMPT = `You have web search capability. When you need real-time or current information (latest news, scores, prices, weather, events, recent developments, etc.), output EXACTLY this tag on its own line BEFORE your response:

[SEARCH: your search query here]

Rules:
- Use [SEARCH: ...] ONLY when current/real-time information is genuinely needed
- Do NOT use it for common knowledge, math, coding, or general questions
- Output the tag ONCE, on its own line, then STOP and wait
- The search results will be provided to you, then you can give your final answer`;

/**
 * Detect if the streamed content contains a search request tag.
 * @param {string} text The accumulated text so far.
 * @returns {{ found: boolean, query: string, prefixContent: string }}
 */
function detectSearchTag(text) {
  const match = text.match(/\[SEARCH:\s*(.+?)\]/);
  if (match) {
    const query = match[1].trim();
    // Content before the search tag (to preserve any preamble)
    const prefixContent = text.substring(0, match.index).trim();
    return { found: true, query, prefixContent };
  }
  return { found: false, query: "", prefixContent: "" };
}

export async function chatWithAI(messages) {
  const model = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.2:fireworks-ai";
  console.log(`📡 Sending request to HuggingFace (Model: ${model})...`);

  // Inject search system prompt if search is enabled
  const messagesWithSearch = SEARCH_ENABLED
    ? [{ role: "system", content: SEARCH_SYSTEM_PROMPT }, ...messages]
    : messages;

  let response;
  try {
    response = await hf.chatCompletion({
      model: model,
      messages: messagesWithSearch,
    });
  } catch (hfError) {
    console.error("❌ HuggingFace API Call Failed:", hfError);
    throw hfError;
  }

  let content = response.choices?.[0]?.message?.content || "";

  // Check if the model requested a search
  if (SEARCH_ENABLED) {
    const searchResult = detectSearchTag(content);
    if (searchResult.found) {
      console.log(`🔍 AI requested search for: ${searchResult.query}`);
      const results = await searchWeb(searchResult.query);

      // Re-call the model with search results injected
      const updatedMessages = [
        ...messagesWithSearch,
        { role: "assistant", content: `[SEARCH: ${searchResult.query}]` },
        { role: "user", content: `Here are the search results:\n\n${JSON.stringify(results, null, 2)}\n\nNow please answer the original question using these results.` }
      ];

      const followUp = await hf.chatCompletion({
        model: model,
        messages: updatedMessages,
      });

      content = followUp.choices?.[0]?.message?.content || content;
    }
  }

  return content;
}

export async function* streamChatWithAI(messages) {
  const model = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.2:fireworks-ai";
  console.log(`📡 Starting stream for model: ${model}${SEARCH_ENABLED ? " (search enabled)" : ""}`);

  // Inject search system prompt if search is enabled
  const messagesWithSearch = SEARCH_ENABLED
    ? [{ role: "system", content: SEARCH_SYSTEM_PROMPT }, ...messages]
    : messages;

  let fullContent = "";

  try {
    const stream = hf.chatCompletionStream({
      model: model,
      messages: messagesWithSearch,
      max_tokens: 65536,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";

      if (content) {
        fullContent += content;

        // Check for search tag in accumulated content
        if (SEARCH_ENABLED) {
          const searchResult = detectSearchTag(fullContent);
          if (searchResult.found) {
            console.log(`🔍 AI (stream) requested search for: ${searchResult.query}`);
            const results = await searchWeb(searchResult.query);

            // Build updated messages with search results
            const updatedMessages = [
              ...messagesWithSearch,
              { role: "assistant", content: `[SEARCH: ${searchResult.query}]` },
              { role: "user", content: `Here are the search results:\n\n${JSON.stringify(results, null, 2)}\n\nNow please answer the original question using these results.` }
            ];

            // Restart stream with search results — recursive call
            console.log("🔄 Re-streaming with search results...");
            const nextStream = streamChatWithAI(updatedMessages);
            for await (const nextChunk of nextStream) {
              yield nextChunk;
            }
            return; // Done — the recursive stream handles the rest
          }
        }

        yield chunk; // Yield the original chunk for content
      }
    }
    console.log("✅ Stream finished.");
  } catch (err) {
    console.error(`❌ Stream error for model ${model}:`, err);
    throw err;
  }
}

export async function generateSessionTitle(message) {
  const promptSystem = {
    role: "system",
    content:
      "You are a concise title generator. Given a user's message, return a short, meaningful title (3-8 words) that summarizes the main intent or subject. Return only the title text with no surrounding punctuation. Keep it human-readable and specific."
  };

  const model = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.2:fireworks-ai";
  const response = await hf.chatCompletion({
    model: model,
    messages: [promptSystem, { role: "user", content: message }],
  });

  const title = response.choices?.[0]?.message?.content || "New Debug Session";
  return title.trim().replace(/\s+/g, " ").slice(0, 120);
}