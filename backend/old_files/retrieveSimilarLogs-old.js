// retrieve-similar-logs.js

import dotenv from "dotenv";
dotenv.config();

import { OpenAIEmbeddings } from "@langchain/openai";
import { HfInference } from "@huggingface/inference";
import { Pinecone } from "@pinecone-database/pinecone";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envPath = path.join(__dirname, "..","..", ".env");
config({ path: envPath });

console.log(envPath);

if (!process.env.PINECONE_API_KEY) {
  console.error("❌ Missing Pinecone API Key");
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Embedding Providers
const openaiEmbeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});

const hf = new HfInference(
  process.env.HUGGINGFACE_API_KEY,
  "https://router.huggingface.co/hf-inference"
);

class EmbeddingService {
  async generateEmbedding(text) {
    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("🤖 Using OpenAI embeddings...");
        }
        return await openaiEmbeddings.embedQuery(text);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.log("⚠️ OpenAI failed, falling back:", err.message);
        }
      }
    }

    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("🦙 Using HuggingFace embeddings...");
        }
        return await hf.featureExtraction({
          model: "sentence-transformers/all-MiniLM-L6-v2",
          inputs: text,
        });
      } catch (err) {
        console.error("❌ HuggingFace failed:", err.message);
      }
    }

    throw new Error("No embedding provider available");
  }
}

const embeddingService = new EmbeddingService();

// Retrieve Similar Logs
export async function retrieveSimilarLogs(query, topK = 5) {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n🔍 Searching for logs similar to: "${query}"`);
    }

    const vector = await embeddingService.generateEmbedding(query);

    const response = await index.query({
      vector,
      topK,
      includeMetadata: true,
    });

    return response.matches.map((m) => ({
      id: m.id,
      score: m.score,
      type: m.metadata?.type || "unknown",
      source: m.metadata?.source || "unknown",
      category: m.metadata?.category || "unknown",
      timestamp: m.metadata?.timestamp || "unknown",
      text: m.metadata?.text || "No content", 
    }));
  } catch (err) {
    console.error("❌ Retrieval error:", err.message);
    return [];
  }
}

// Minimal Safe Logging (production-friendly)
function displayResults(results, query) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n🎯 Top ${results.length} logs for "${query}"`);
    console.log("─".repeat(80));
  }

  results.forEach((log, i) => {
    if (process.env.NODE_ENV !== "production") {
      // Verbose only in dev
      console.log(`\n${i + 1}. ${log.type.toUpperCase()} (${log.source})`);
      console.log(`   Score: ${(log.score * 100).toFixed(2)}%`);
      console.log(`   Category: ${log.category}`);
      console.log(`   Timestamp: ${log.timestamp}`);
      console.log(`   Content: ${log.text.slice(0, 120)}...`);
      console.log("   ───────────────────────────────────────────────");
    }
  });

  // Production-safe output
  if (process.env.NODE_ENV === "production") {
    console.log(
      JSON.stringify(
        {
          query,
          count: results.length,
          results: results.map((r) => ({
            id: r.id,
            type: r.type,
            source: r.source,
            category: r.category,
            score: Number(r.score.toFixed(4)),
          })),
        },
        null,
        2
      )
    );
  }
}

async function main() {
  const query = process.argv[2] || "error in application";
  const topK = parseInt(process.argv[3]) || 5;

  const results = await retrieveSimilarLogs(query, topK);
  displayResults(results, query);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {EmbeddingService };
/**To run in terminal
 * "database connection error" represents the error to enter at terminal retrieve from 
 * it's similar logs, you can enter any error you can think of eg error 404 etc. 
 * node retrieveSimilarLogs.js "database connection error"
 switch to production from the terminal by typing
 export NODE_ENV=production
 */