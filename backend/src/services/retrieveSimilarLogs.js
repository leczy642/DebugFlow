// retrieveSimilarLogs.js
// PURPOSE: Convert log text → embeddings → vector search in Pinecone
// WHY: Used by analyzeError to retrieve similar incidents for debugging context

// import dotenv from "dotenv";
// dotenv.config();

//import "dotenv/config";  // loads .env automatically from project root
//import { loadEnv } from "../utils/loadEnv.js";
import "../utils/loadEnv.js";
import { ragService } from "./ragService.js";
import { logger } from "../utils/logger.js";

/**
 * retrieveSimilarLogs()
 * WHAT: Vector search against Pinecone using standardized ragService
 * INPUT: query string, topK results
 * OUTPUT: array of normalized log objects
 * WHY: Primary retrieval engine for analyzeError()
 */
export async function retrieveSimilarLogs(query, topK = 5) {
  logger.info({ event: "rag_logs_search_start", query, topK });

  try {
    const results = await ragService.search(query, { topK });
    return results;
  } catch (error) {
    logger.error("Failed to retrieve similar logs", { error: error.message });
    return [];
  }
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


// ---------------------------
// Running this module in commandline 
// ---------------------------
//1. TEST MODE
//----------------------------
// DEBUGFLOW_TEST_MODE=true node retrieveSimilarLogs.js "database connection timeout"

//TEST MODE - BATCH TESTING
// DEBUGFLOW_TEST_MODE=true node retrieveSimilarLogs.js --batch

//TEST MODE - SUMMARY
//DEBUGFLOW_TEST_MODE=true node retrieveSimilarLogs.js --batch --summary
//--summary generates executive summaries for each query:


//2. PRODUCTION MODE
//------------------
// node retrieveSimilarLogs.js "database connection timeout"


//PRODUCTION MODE - BATCH example
// node retrieveSimilarLogs.js --batch


//PRODUCTION MODE - SUMMARY
//node retrieveSimilarLogs.js --batch --summary
//--summary generates executive summaries for each query:
