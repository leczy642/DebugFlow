// chatService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Handles conversational AI logic (HuggingFace, OpenAI, or DeepSeek)

import "../utils/loadEnv.js";  
import { InferenceClient } from "@huggingface/inference";

const LLM_CHAT_MODEL = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.1:novita";

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

export async function chatWithAI(message) {
  // --- Send to HF Chat completion model -------------------------------------
  const response = await hf.chatCompletion({
    model: LLM_CHAT_MODEL,
    messages: [
      { role: "user", content: message }
    ]
  });

  // Extract the actual AI reply
  //safely return response using optional chaining
  return response.choices?.[0]?.message?.content
  //return response.choices[0].message.content
}

//console.log(await chatWithAI("what is the capital of france?"));