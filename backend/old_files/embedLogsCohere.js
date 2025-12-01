import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of Cohere client
let cohere = null;

function getCohereClient() {
  if (!cohere) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "COHERE_API_KEY is not set. Please add it to your .env file or environment variables."
      );
    }
    cohere = new CohereClient({
      token: apiKey,
    });
  }
  return cohere;
}

export async function embedLogsCohere(logs) {
  const vectors = [];
  const errors = [];

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("Logs array is required and must not be empty");
  }

  const client = getCohereClient();

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const text = log.message || log.content || "";
    
    if (!text) {
      console.warn(`⚠️ Skipping log at index ${i}: no message or content field`);
      errors.push(`Log ${i}: missing message/content`);
      continue;
    }

    try {
      const response = await client.embed({
        model: "embed-multilingual-v3.0", // Recommended latest embedding model
        texts: [text],
      });

      if (response.embeddings && response.embeddings[0]) {
        vectors.push(response.embeddings[0]);
        console.log(`✅ Embedded log ${i}: ${text.substring(0, 50)}...`);
      } else {
        console.error(`❌ No embeddings returned for log ${i}`);
        errors.push(`Log ${i}: no embeddings returned`);
      }
    } catch (err) {
      const errorMsg = err.message || String(err);
      console.error(`❌ Cohere embedding failed for log ${i}:`, errorMsg);
      errors.push(`Log ${i}: ${errorMsg}`);
    }
  }

  if (vectors.length === 0 && errors.length > 0) {
    throw new Error(
      `Failed to generate embeddings for all logs. Errors: ${errors.join("; ")}`
    );
  }

  console.log(`✅ Generated ${vectors.length} embeddings from ${logs.length} logs`);
  return vectors;
}