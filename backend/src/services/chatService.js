// chatService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Handles conversational AI logic (HuggingFace, OpenAI, or DeepSeek)

import "../utils/loadEnv.js";
import { InferenceClient } from "@huggingface/inference";

const LLM_CHAT_MODEL = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.1:novita";

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

export async function chatWithAI(messages) {
  // --- Send to HF Chat completion model -------------------------------------
  const response = await hf.chatCompletion({
    model: LLM_CHAT_MODEL,
    messages: messages
  });

  // Extract the actual AI reply
  //safely return response using optional chaining
  //knowing the shape of messages would help you understand below
  return response.choices?.[0]?.message?.content
  //return response.choices[0].message.content
}

export async function streamChatWithAI(messages) {
  // --- Stream from HF Chat completion model ---------------------------------
  const stream = hf.chatCompletionStream({
    model: LLM_CHAT_MODEL,
    messages: messages,
    max_tokens: 5333,
  });

  return stream;
}

export async function generateSessionTitle(message) {
  // Ask the LLM to produce a short, meaningful title describing the user's message.
  // The model is instructed to return ONLY the title (no punctuation like quotes),
  // preferably 3-8 words and concise.
  const promptSystem = {
    role: "system",
    content:
      "You are a concise title generator. Given a user's message, return a short, meaningful title (3-8 words) that summarizes the main intent or subject. Return only the title text with no surrounding punctuation. Keep it human-readable and specific."
  };

  const response = await hf.chatCompletion({
    model: LLM_CHAT_MODEL,
    messages: [promptSystem, { role: "user", content: message }],
  });

  const title = response.choices?.[0]?.message?.content || "New Debug Session";
  // Trim and collapse whitespace, limit length
  return title.trim().replace(/\s+/g, " ").slice(0, 120);
}

//console.log(await chatWithAI("what is the capital of france?"));