// ingest_embeddings.js
// Node 18+ (ESM). Production-focused ingestion script:
// - concurrency limiting
// - retries with exponential backoff
// - batching/upsert to Pinecone
// - safe env loading (dotenv only in non-production)
// - validation of input documents
//
// Usage: NODE_ENV=production node ingest_embeddings.js
// For local dev: node ingest_embeddings.js
//load env
import "../utils/loadEnv.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { InferenceClient } from '@huggingface/inference';
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from "../utils/logger.js";

// ---------- Basic runtime & project paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Configuration (tweakable) ----------
  const HUGGINGFACE_MODEL = process.env.HHUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
  const PINECONE_INDEX = process.env.PINECONE_INDEX || 'debug-logs-hf';
  const INPUT_FILE = process.env.INPUT_FILE || path.join(__dirname, '..','..', 'data', 'sample_logs.json');
  const CONCURRENCY = Number(process.env.CONCURRENCY) || 4;       // how many HF requests in parallel
  const BATCH_SIZE =  Number(process.env.BATCH_SIZE) || 100;       // how many vectors per Pinecone upsert
  const RETRIES = Number(process.env.RETRIES) || 3;               // retries for transient errors
  const RETRY_FACTOR = Number(process.env.RETRY_FACTOR) || 2;     // backoff multiplier
  const RETRY_MIN_TIMEOUT = Number(process.env.RETRY_MIN_TIMEOUT) || 500; // ms


//---------- Basic logger (no secrets) ----------
// const logger = winston.createLogger({
//   level: process.env.LOG_LEVEL || 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
//   ),
//   transports: [new winston.transports.Console()],
// });

// ---------- Instantiate clients ----------
const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY, 'https://router.huggingface.co/hf-inference');
// Pinecone client (uses API key)
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// ---------- Helpers ----------

// Simple schema validation - adjust if you need stronger validation libs (zod/joi)
function validateDocument(doc) {
  if (!doc) return false;
  if (typeof doc.id !== 'string' && typeof doc.id !== 'number') return false;
  if (typeof doc.stacktrace !== 'string' || doc.stacktrace.length === 0) return false;
  // optional: category, source
  return true;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// retry wrapper for API calls
async function retryable(fn, opts = {}) {
  const { retries = RETRIES } = opts;
  return pRetry(fn, {
    onFailedAttempt: (err) => {
      logger.warn(`Attempt ${err.attemptNumber} failed. ${err.retriesLeft} retries left. ${err.message}`);
    },
    retries,
    factor: RETRY_FACTOR,
    minTimeout: RETRY_MIN_TIMEOUT,
  });
}

// ---------- Core: load documents ----------

function loadDocumentsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Input file must contain a JSON array of documents');
  }

  const docs = parsed.filter(validateDocument).map((d) => ({
    id: String(d.id),
    stacktrace: d.stacktrace,
    category: d.category || 'unknown',
    source: d.source || 'unknown',
  }));

  if (docs.length === 0) {
    throw new Error('No valid documents found in input file after validation');
  }
  return docs;
}

// ---------- Core: generate embeddings with concurrency + retry ----------
async function embedDocuments(documents) {
  logger.info(`Generating embeddings for ${documents.length} documents (concurrency=${CONCURRENCY})`);

  const limit = pLimit(CONCURRENCY);

  const jobs = documents.map((doc) =>
    limit(() =>
      retryable(async () => {
        // Hugging Face 'featureExtraction' returns array of floats for single input
        const resp = await hf.featureExtraction({
          model: HUGGINGFACE_MODEL,
          inputs: doc.stacktrace,
        });

        // Validate response
        if (!Array.isArray(resp) || resp.length === 0) {
          throw new Error('Empty embedding returned by HF');
        }

        // Ensure vector is 1D array of numbers
        // Some HF endpoints may return nested arrays for some models; flatten if needed.
        const vector = Array.isArray(resp[0]) ? resp[0] : resp;
        if (!Array.isArray(vector) || typeof vector[0] !== 'number') {
          throw new Error('Unexpected embedding vector format');
        }

        return {
          id: doc.id,
          values: vector,
          metadata: {
            text: doc.stacktrace.slice(0, 200), // keep metadata small
            category: doc.category,
            source: doc.source,
            ingested_at: new Date().toISOString(),
          },
        };
      })
    )
  );

  const results = await Promise.allSettled(jobs);
  const succeeded = [];
  const failed = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') succeeded.push(r.value);
    else {
      failed.push({ doc: documents[i].id, reason: r.reason?.message || String(r.reason) });
      logger.error(`Embedding failed for doc ${documents[i].id}: ${r.reason?.message || r.reason}`);
    }
  });

  logger.info(`Embeddings: ${succeeded.length} succeeded, ${failed.length} failed`);
  return { vectors: succeeded, failed };
}

// ---------- Core: upsert to Pinecone in batches with retries ----------

async function upsertVectors(index, vectors) {
  const batchSize = BATCH_SIZE;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    logger.info(
      `Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        vectors.length / batchSize
      )} (${batch.length} vectors)`
    );

    try {
      // ✅ Correct Pinecone v3 format
      await index.upsert(batch);

      logger.info("Batch upserted successfully");
    } catch (err) {
      logger.error("Upsert failed:", err);
    }
  }
}


// ---------- Main orchestrator ----------
async function main() {
  logger.info('Starting ingestion run');

  let docs;
  try {
    docs = loadDocumentsFromFile(INPUT_FILE);
  } catch (err) {
    logger.error(`Failed to load input: ${err.message}`);
    process.exit(2);
  }

  // get Pinecone index handle
  let index;
  try {
    index = pinecone.index(PINECONE_INDEX);
  } catch (err) {
    logger.error(`Failed to get Pinecone index handle for "${PINECONE_INDEX}": ${err.message}`);
    process.exit(3);
  }

  // generate embeddings
  const { vectors, failed } = await embedDocuments(docs);

  if (vectors.length === 0) {
    logger.error('No embeddings to upsert. Exiting.');
    process.exit(4);
  }

  // upsert into Pinecone
  try {
    await upsertVectors(index, vectors);
  } catch (err) {
    logger.error(`Upsert failed: ${err.message}`);
    process.exit(5);
  }

  // Optionally: run a test query (safe, no secrets logged)
  try {
    const testQuery = 'resource not found';
    logger.info('Running test query to verify data (no sensitive info will be logged)');
    const queryEmbedding = await hf.featureExtraction({ model: HUGGINGFACE_MODEL, inputs: testQuery });
    const vector = Array.isArray(queryEmbedding[0]) ? queryEmbedding[0] : queryEmbedding;

    // Query API shape may vary. Example:
    const qres = await index.query({ vector, topK: 3, includeMetadata: true });
    logger.info(`Test query returned ${qres.matches?.length ?? 0} matches`);
  } catch (err) {
    logger.warn(`Test query failed (non-fatal): ${err.message}`);
  }

  logger.info('Ingestion run completed successfully');
  // If running as a short-lived job, exit explicitly
  process.exit(0);
}

// uncomment to run in the CLI, restore comments after testing in CLI
// main().catch((err) => {
//   logger.error(`Unhandled error in ingestion script: ${err?.message || err}`);
//   logger.error(err?.stack || '');
//   process.exit(99);
// });

//export {embedDocuments}

export {
  main as runIngestion,   // CLI can run this
  embedDocuments,
  loadDocumentsFromFile,
};