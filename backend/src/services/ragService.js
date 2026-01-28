/**
 * ragService.js
 * -------------
 * Unified service for Retrieval-Augmented Generation (RAG).
 * Handles:
 * - Embedding generation via HuggingFace Inference API.
 * - Pinecone vector search and ingestion.
 * - Centralized configuration for namespacing and models.
 */

import "../utils/loadEnv.js";
import { InferenceClient } from "@huggingface/inference";
import { Pinecone } from "@pinecone-database/pinecone";
import { logger } from "../utils/logger.js";

// ====== CONFIGURATION ======
const HUGGINGFACE_EMBEDDING_MODEL = process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "debugflow-logs";

if (!PINECONE_API_KEY) {
    logger.error("Missing PINECONE_API_KEY");
}

// ====== CLIENTS ======
const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

/**
 * Standardize Metadata Schema
 * @param {Object} m - Raw Pinecone metadata
 * @returns {Object} - Normalized metadata
 */
function normalizeMetadata(m) {
    return {
        id: m.id || "unknown",
        text: m.text || m.summary || m.stacktrace || "No content",
        type: m.type || "unknown",
        source: m.source || "unknown",
        category: m.category || "unknown",
        timestamp: m.timestamp || m.createdAt || m.ingested_at || "unknown",
        sessionId: m.sessionId || null,
        projectId: m.projectId || null,
        userId: m.userId || null,
        title: m.title || null
    };
}

class RAGService {
    constructor() {
        this.index = pinecone.index(PINECONE_INDEX_NAME);
    }

    /**
     * Generate embedding using HuggingFace
     * @param {string} text - Input text
     * @returns {Promise<Array<number>>} - Embedding vector
     */
    async generateEmbedding(text) {
        try {
            const resp = await hf.featureExtraction({
                model: HUGGINGFACE_EMBEDDING_MODEL,
                inputs: text,
            });

            // Handle nested array response (some models return [[...]])
            const vector = Array.isArray(resp[0]) ? resp[0] : resp;

            if (!Array.isArray(vector) || typeof vector[0] !== 'number') {
                throw new Error(`Unexpected embedding vector format from model ${HUGGINGFACE_EMBEDDING_MODEL}`);
            }

            return vector;
        } catch (err) {
            logger.error("Embedding generation failed", { error: err.message, model: HUGGINGFACE_EMBEDDING_MODEL });
            throw err;
        }
    }

    /**
     * Search for similar vectors in Pinecone
     * @param {string} query - Query text
     * @param {Object} options - Search options (topK, namespace, filter)
     * @returns {Promise<Array<Object>>} - Matched results with normalized metadata
     */
    async search(query, { topK = 5, namespace = "", filter = {} } = {}) {
        try {
            const vector = await this.generateEmbedding(query);

            const queryOptions = {
                vector,
                topK,
                includeMetadata: true
            };

            if (filter && Object.keys(filter).length > 0) {
                queryOptions.filter = filter;
            }

            const response = namespace
                ? await this.index.namespace(namespace).query(queryOptions)
                : await this.index.query(queryOptions);

            return response.matches.map(m => ({
                id: m.id,
                score: m.score,
                ...normalizeMetadata(m.metadata || {})
            }));
        } catch (err) {
            logger.error(`RAG search failed for query "${query}": ${err.message}`, { stack: err.stack });
            throw err;
        }
    }

    /**
     * Upsert vectors into Pinecone
     * @param {Array<Object>} items - Array of { id, text, metadata }
     * @param {string} namespace - Optional namespace
     */
    async upsert(items, namespace = "") {
        try {
            const vectors = await Promise.all(items.map(async (item) => {
                const vector = await this.generateEmbedding(item.text);
                return {
                    id: item.id,
                    values: vector,
                    metadata: {
                        ...item.metadata,
                        text: item.text.slice(0, 5000), // Pinecone meta limit check
                        ingested_at: new Date().toISOString()
                    }
                };
            }));

            if (namespace) {
                await this.index.namespace(namespace).upsert(vectors);
            } else {
                await this.index.upsert(vectors);
            }

            logger.info(`Upserted ${vectors.length} vectors to namespace: ${namespace || 'default'}`);
        } catch (err) {
            logger.error("RAG upsert failed", { error: err.message });
            throw err;
        }
    }

    /**
     * Delete vectors by ID
     */
    async delete(ids, namespace = "") {
        try {
            if (namespace) {
                await this.index.namespace(namespace).deleteMany(ids);
            } else {
                await this.index.deleteMany(ids);
            }
        } catch (err) {
            logger.error("RAG delete failed", { error: err.message });
        }
    }
}

export const ragService = new RAGService();
export default ragService;
