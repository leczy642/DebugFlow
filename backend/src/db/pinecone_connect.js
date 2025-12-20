import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

let pineconeClient;

/**
 * Initializes and returns a cached Pinecone client instance.
 * Ensures we don’t reinitialize multiple times.
 */
export function getPinecone() {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey) {
      throw new Error("❌ Missing PINECONE_API_KEY in environment variables.");
    }

    pineconeClient = new Pinecone({ apiKey });
    console.log("✅ Pinecone client initialized.");
  }

  return pineconeClient;
}

/**
 * Returns an index instance (table) from Pinecone.
 * Defaults to the environment variable or 'debugflow-logs'.
 */
export function getPineconeIndex() {
  const client = getPinecone();
  const indexName = process.env.PINECONE_INDEX_NAME || "debugflow-logs";
  return client.Index(indexName);
}
