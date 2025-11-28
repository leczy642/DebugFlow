// retrieveSimilarLogs.js
// PURPOSE: Convert log text → embeddings → vector search in Pinecone
// WHY: Used by analyzeError to retrieve similar incidents for debugging context

// import dotenv from "dotenv";
// dotenv.config();
import "dotenv/config";  // loads .env automatically from project root


import { InferenceClient } from "@huggingface/inference";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { logger } from "../utils/logger.js";

const TEST_MODE = process.env.TEST_MODE === "true";

// -------------------------------
// Winston Structured Logging
// Why: Enables production-safe logs + JSON formatting for observability
// -------------------------------


// -------------------------------
// Pinecone Init (same config style as analyzeError.js)
// Why: Keep system consistent across services
// -------------------------------
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME;

if (!PINECONE_API_KEY || !PINECONE_INDEX) {
  logger.error("Missing Pinecone credentials");
  throw new Error("Missing Pinecone configuration");
}

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.Index(PINECONE_INDEX);

// -------------------------------
// Embedding Provider Init
// Input: Plain text string
// Output: Numeric embedding vector array
// Why: Used for similarity search
// -------------------------------
const openaiEmbeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

// -------------------------------
// generateEmbedding()
// Input: user text
// Output: embedding vector
// WHY: Uses HF fallback if OpenAI fails
// -------------------------------
async function generateEmbedding(text) {
  try {
    return await openaiEmbeddings.embedQuery(text);
  } catch {
    logger.warn("OpenAI embedding failed → using HuggingFace fallback");
    return await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });
  }
}

// -------------------------------
// retrieveSimilarLogs()
// WHAT: Vector search against Pinecone
// INPUT: query string, topK results
// OUTPUT: array of normalized log objects
// WHY: Primary retrieval engine for analyzeError()
// -------------------------------
export async function retrieveSimilarLogs(query, topK = 5) {
  logger.info({ event: "embedding_start", query });

  const vector = await generateEmbedding(query);

  logger.info({ event: "pinecone_query", topK });

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
}

// -------------------------------
// displayResultsTest()
// WHAT: Dev-friendly colorful console print
// INPUT: results[] array
// OUTPUT: pretty display for humans
// -------------------------------
export function displayResultsTest(results, query) {
  console.log(`\n🔍 Test Results for "${query}"`);
  results.forEach((r, i) => {
    console.log(`\n#${i + 1} (${(r.score * 100).toFixed(2)}%)`);
    console.log(`Type:      ${r.type}`);
    console.log(`Source:    ${r.source}`);
    console.log(`Category:  ${r.category}`);
    console.log(`Timestamp: ${r.timestamp}`);
    console.log(`Content:   ${r.text.slice(0, 140)}...`);
  });
  console.log("\n----------------------------------------\n");
}

// -------------------------------
// displayResultsProduction()
// WHAT: Machine-consumable JSON output
// WHY: CI/CD, monitoring, backend integration
// -------------------------------
export function displayResultsProduction(results, query) {
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

// -------------------------------
// CLI Mode for quick manual testing
// INPUT: node retrieve.js "login error"
// -------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const query = process.argv[2] || "database connection error";
  const topK = Number(process.argv[3] || 5);

  retrieveSimilarLogs(query, topK).then((results) =>
    TEST_MODE
      ? displayResultsTest(results, query)
      : displayResultsProduction(results, query)
  );
}
