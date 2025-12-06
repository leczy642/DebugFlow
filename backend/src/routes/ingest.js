
/**
 * Ingest Route - Error Log Embedding & Vector Database Ingestion
 * 
 * PURPOSE:
 * Loads error logs from a JSON file, generates embeddings using HuggingFace models,
 * and upserts the vector embeddings to Pinecone for semantic search capabilities.
 * 
 * INPUT:
 * - POST request to the route endpoint (no body parameters required)
 * - Reads from: data/sample_logs.json
 * 
 * OUTPUT:
 * - Success (200): JSON with embedding stats and upsert confirmation
 * - Client Error (400): JSON with error details if no embeddings generated
 * - Server Error (500): JSON with error message and optional stack trace
 * 
 * DEPENDENCIES:
 * - HuggingFace API for embedding generation
 * - Pinecone vector database for storage
 * - Environment variables: PINECONE_API_KEY, PINECONE_INDEX
 */

// ========== Environment & Core Dependencies ==========
import "../utils/loadEnv.js";
import express from 'express';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== Service Layer Imports ==========
import { embedDocuments, loadDocumentsFromFile, upsertVectors } from '../services/embedLogs.js';
import { Pinecone } from '@pinecone-database/pinecone';

// ========== Configuration ==========
// Pinecone index name from environment or default
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'debug-logs-hf';

// ES module path resolution for __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Pinecone client with API key
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });


//console.log(__dirname);

// ========== Express Router Setup ==========
const router = express.Router();

/**
 * POST /
 * Main ingestion endpoint - processes error logs and stores embeddings
 */
router.post('/', async(req, res) => {
  try{
    // Destructure request body (currently empty, reserved for future params)
      const {} = req.body

      // ========== Step 1: Load Documents ==========
      // Construct path to sample logs file
      //load documents from file ✅
      const INPUT_FILE = path.join(__dirname, '..','..', 'data', 'sample_logs.json');
      const loadedFileDocument = loadDocumentsFromFile(INPUT_FILE)

      // ========== Step 2: Generate Embeddings ==========
      // Convert error logs to vector embeddings using HuggingFace
      //embed documents ✅
      const {vectors, failed} = await embedDocuments(loadedFileDocument);

      // ========== Step 3: Validate Embeddings ==========
      // Return error if no valid embeddings were generated
      //generate an error if no embeddings are found
      if(vectors.length === 0){
        res.status(400).json({
          success: false,
          error: 'No embeddings generated',
          failedCount: failed.length,
          failure: failed
        })
      }
      
      // ========== Step 4: Get Pinecone Index Handle ==========
      // Connect to the specified Pinecone index
      //get the pinecone index 
      const index = pinecone.index(PINECONE_INDEX);

      
      // ========== Step 5: Upsert Vectors to Pinecone ==========
     // Batch upload embeddings to vector database
    //upsert to pinecone
      await upsertVectors(index, vectors)

      // ========== Step 6: Return Success Response ==========
      res.json({
        success: true,
          totalDocuments: loadedFileDocument.length,
          successfulEmbeddings: vectors.length,
          failedEmbeddings: failed.length,
          upsertedVectors: vectors.length,
          message: 'Embeddings generated and upserted successfully',
          failures: failed.length > 0 ? failed : undefined
      });
      // ========== Error Handling ==========
    // Log the error for debugging
    }catch(error){
      logger.error(`Error in ingest route: ${error.message}`);
      // Return error response with stack trace in development mode
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }

});
// ========== Export Router ==========
export default router;