/**
 * Context Service
 * 
 * Handles project-level context management:
 * - Generates session summaries using HuggingFace LLM
 * - Builds project context for chat requests
 * - Manages token budgets
 * - Relevance filtering using HuggingFace embeddings
 * - Recency limits for stale context
 * - Integrates Global User Context (The Memory Ledger)
 */

import "../utils/loadEnv.js";
import { pool } from "../db/postgres_connect.js";
import { chatWithAI } from "./chatService.js";
import { InferenceClient } from "@huggingface/inference";
import { Pinecone } from "@pinecone-database/pinecone";
import { logger } from "../utils/logger.js";
import { getEffectiveGlobalContext, proposeCandidate } from "./memoryService.js";

// ====== CONFIGURATION ======
const PROJECT_CONTEXT_TOKEN_LIMIT = 8000;
const CHARS_PER_TOKEN = 4;
const MAX_SUMMARIES_CAP = 5;           // Maximum number of summaries to include
const RECENCY_DAYS_LIMIT = 30;         // Only include summaries from last 30 days
const RELEVANCE_THRESHOLD = 0.6;       // Minimum similarity score (0-1)

// HuggingFace embedding model (same as embedLogs.js)
const HUGGINGFACE_EMBEDDING_MODEL = process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

// Pinecone namespace for session summaries (separate from logs)
const CONTEXT_NAMESPACE = "session-context";

// Initialize clients
const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

/**
 * Estimate token count for a string (rough approximation)
 */
export function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Generate embedding for text using HuggingFace
 */
async function generateEmbedding(text) {
    try {
        const resp = await hf.featureExtraction({
            model: HUGGINGFACE_EMBEDDING_MODEL,
            inputs: text,
        });

        // Handle nested array response (some models return [[...]])
        const vector = Array.isArray(resp[0]) ? resp[0] : resp;

        if (!Array.isArray(vector) || typeof vector[0] !== 'number') {
            throw new Error('Unexpected embedding vector format');
        }

        return vector;
    } catch (err) {
        logger.warn("Embedding generation failed", { error: err.message });
        return null;
    }
}

/**
 * Get Pinecone index
 */
function getPineconeIndex() {
    const indexName = process.env.PINECONE_INDEX_NAME || "debugflow-logs";
    return pinecone.index(indexName);
}

/**
 * Store session summary embedding in Pinecone for relevance search
 */
async function storeSummaryEmbedding(sessionId, projectId, userId, summary, title) {
    try {
        const embedding = await generateEmbedding(summary);
        if (!embedding) return;

        const index = getPineconeIndex();
        await index.namespace(CONTEXT_NAMESPACE).upsert([{
            id: `session-${sessionId}`,
            values: embedding,
            metadata: {
                type: "session_summary",
                sessionId,
                projectId,
                userId,
                title,
                summary,
                createdAt: new Date().toISOString()
            }
        }]);
        logger.info(`Stored embedding for session ${sessionId}`);
    } catch (err) {
        logger.warn("Failed to store summary embedding", { error: err.message });
    }
}

/**
 * Retrieve relevant summaries using semantic search
 */
async function retrieveRelevantSummaries(query, projectId, currentSessionId, topK = MAX_SUMMARIES_CAP) {
    try {
        const embedding = await generateEmbedding(query);
        if (!embedding) return null;

        const index = getPineconeIndex();
        const results = await index.namespace(CONTEXT_NAMESPACE).query({
            vector: embedding,
            topK,
            filter: {
                projectId: { $eq: projectId }
            },
            includeMetadata: true
        });

        // Filter out current session and apply relevance threshold
        return results.matches
            .filter(m =>
                m.metadata?.sessionId !== currentSessionId &&
                m.score >= RELEVANCE_THRESHOLD
            )
            .map(m => ({
                sessionId: m.metadata.sessionId,
                title: m.metadata.title,
                summary: m.metadata.summary,
                score: m.score
            }));
    } catch (err) {
        logger.warn("Relevance search failed, falling back to recency", { error: err.message });
        return null; // Signal to use fallback
    }
}

/**
 * Async specific insight extraction from summary
 * Feeds the "Memory Ledger" with potential candidates
 */
async function extractUserInsights(summary, userId, sessionId) {
    if (!summary || !userId) return;

    // Prompt LLM to identify user preferences
    const messages = [
        {
            role: "system",
            content: `Analyze this session summary and extract 1-2 core user preferences or habits if present.
Examples: "User prefers Tailwind CSS", "User uses pnpm", "User hates 'any' type".
Ignore specific bug fixes. Focus on long-term patterns.
Return ONLY the insights as a bulleted list (starting with - ). If none, return "NONE".`
        },
        {
            role: "user",
            content: summary
        }
    ];

    try {
        const text = await chatWithAI(messages);
        if (!text || text.includes("NONE")) return;

        const insights = text.split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim());

        for (const insight of insights) {
            if (insight.length > 5 && insight.length < 200) {
                await proposeCandidate(userId, insight, { sourceSessionId: sessionId });
                logger.info(`Proposed candidate memory for user ${userId}: ${insight}`);
            }
        }
    } catch (err) {
        logger.warn("Failed to extract insights", { error: err.message });
    }
}

/**
 * Generate a summary for a session's conversation
 * Called after sessions reach 5+ messages
 */
export async function generateSessionSummary(sessionId) {
    // Fetch session info for metadata
    const { rows: [sessionInfo] } = await pool.query(
        `SELECT id, title, project_id, user_id FROM sessions WHERE id = $1`,
        [sessionId]
    );

    if (!sessionInfo) return null;

    // Fetch session messages
    const { rows: messages } = await pool.query(
        `SELECT role, content FROM messages 
         WHERE session_id = $1 AND is_deleted = false 
         ORDER BY created_at ASC`,
        [sessionId]
    );

    if (messages.length < 3) {
        return null;
    }

    // Build conversation text
    const conversationText = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

    // Truncate if too long (keep last ~4000 chars for summary)
    const truncatedText = conversationText.length > 4000
        ? '...' + conversationText.slice(-4000)
        : conversationText;

    // Generate summary using LLM (chatWithAI uses HuggingFace InferenceClient)
    const summaryMessages = [
        {
            role: "system",
            content: `Summarize this debugging conversation in 2-3 sentences. 
Focus on: the problem discussed, approaches tried, and solution (if found).
Return ONLY the summary, no preamble or formatting.`
        },
        {
            role: "user",
            content: truncatedText
        }
    ];

    try {
        const summary = await chatWithAI(summaryMessages);

        // Store the summary in Postgres
        await pool.query(
            `UPDATE sessions 
             SET context_summary = $1, summary_updated_at = NOW() 
             WHERE id = $2`,
            [summary, sessionId]
        );

        // Also store embedding in Pinecone for relevance search
        if (sessionInfo.project_id) {
            await storeSummaryEmbedding(
                sessionId,
                sessionInfo.project_id,
                sessionInfo.user_id,
                summary,
                sessionInfo.title
            );
        }

        // Trigger Async Insight Extraction (Global Memory Ledger)
        if (sessionInfo.user_id) {
            extractUserInsights(summary, sessionInfo.user_id, sessionId)
                .catch(e => logger.error("Background insight extraction failed", { error: e.message }));
        }

        return summary;
    } catch (err) {
        console.error("Failed to generate session summary:", err);
        return null;
    }
}

/**
 * Get project context (instructions + sibling session summaries)
 */
export async function getProjectContext(projectId) {
    // Get project details
    const { rows: [project] } = await pool.query(
        `SELECT id, name, context_instructions, context_enabled 
         FROM projects WHERE id = $1`,
        [projectId]
    );

    if (!project || !project.context_enabled) {
        return null;
    }

    return project;
}

/**
 * Get summaries from sessions in a project with recency and cap limits
 * FALLBACK when relevance search is unavailable
 */
export async function getProjectSessionSummaries(projectId, excludeSessionId = null) {
    const recencyDate = new Date();
    recencyDate.setDate(recencyDate.getDate() - RECENCY_DAYS_LIMIT);

    const { rows } = await pool.query(
        `SELECT id, title, context_summary, summary_updated_at 
         FROM sessions 
         WHERE project_id = $1 
           AND context_summary IS NOT NULL 
           AND summary_updated_at > $2
           ${excludeSessionId ? 'AND id != $3' : ''}
         ORDER BY summary_updated_at DESC
         LIMIT $${excludeSessionId ? '4' : '3'}`,
        excludeSessionId
            ? [projectId, recencyDate, excludeSessionId, MAX_SUMMARIES_CAP]
            : [projectId, recencyDate, MAX_SUMMARIES_CAP]
    );

    return rows;
}

/**
 * Build context messages for the chat
 * Uses relevance filtering when available, falls back to recency
 * Returns array of system messages to prepend to conversation
 */
export async function buildContextMessages(projectId, currentSessionId, currentQuery = null, userId = null, tokenLimit = PROJECT_CONTEXT_TOKEN_LIMIT) {
    const contextMessages = [];
    let tokensUsed = 0;

    // 0. GLOBAL USER CONTEXT (Tier 1 & 2) - Highest Priority
    if (userId) {
        const globalContext = await getEffectiveGlobalContext(userId);
        if (globalContext) {
            const globalTokens = estimateTokens(globalContext);
            // Cap global context contribution to ~2000 tokens to leave room for project
            const cappedGlobalContext = globalContext.slice(0, 8000);

            contextMessages.push({
                role: "system",
                content: cappedGlobalContext
            });
            tokensUsed += estimateTokens(cappedGlobalContext);
        }
    }

    const project = await getProjectContext(projectId);

    // If project context disabled, stop here (but we kept Global enabled)
    if (!project) {
        return contextMessages;
    }

    // 1. Add project instructions if present (always included)
    if (project.context_instructions) {
        const instructionsContent = `PROJECT INSTRUCTIONS:\n${project.context_instructions}`;
        const instructionTokens = estimateTokens(instructionsContent);

        if (tokensUsed + instructionTokens <= tokenLimit) {
            contextMessages.push({
                role: "system",
                content: instructionsContent
            });
            tokensUsed += instructionTokens;
        }
    }

    // 2. Get relevant summaries (semantic search or recency fallback)
    let summariesToUse = [];

    if (currentQuery) {
        // Try relevance-based retrieval first
        const relevantSummaries = await retrieveRelevantSummaries(
            currentQuery,
            projectId,
            currentSessionId
        );

        if (relevantSummaries && relevantSummaries.length > 0) {
            summariesToUse = relevantSummaries;
            logger.info(`Using ${relevantSummaries.length} relevant summaries (semantic search)`);
        }
    }

    // Fallback to recency-based if no relevance results
    if (summariesToUse.length === 0) {
        const recentSummaries = await getProjectSessionSummaries(projectId, currentSessionId);
        summariesToUse = recentSummaries.map(s => ({
            sessionId: s.id,
            title: s.title,
            summary: s.context_summary,
            score: null // No relevance score for recency-based
        }));
        if (summariesToUse.length > 0) {
            logger.info(`Using ${summariesToUse.length} recent summaries (recency fallback)`);
        }
    }

    // 3. Add summaries respecting token limit
    if (summariesToUse.length > 0) {
        let summaryContent = "CONTEXT FROM RELATED SESSIONS IN THIS PROJECT:\n";
        let addedCount = 0;

        for (const session of summariesToUse) {
            if (addedCount >= MAX_SUMMARIES_CAP) break;

            const scoreInfo = session.score ? ` (${Math.round(session.score * 100)}% relevant)` : "";
            const sessionLine = `• ${session.title}${scoreInfo}: ${session.summary}\n`;
            const lineTokens = estimateTokens(sessionLine);

            if (tokensUsed + lineTokens > tokenLimit) {
                break;
            }

            summaryContent += sessionLine;
            tokensUsed += lineTokens;
            addedCount++;
        }

        if (addedCount > 0) {
            // Add a note about prioritizing current conversation
            summaryContent += "\nNote: If any context above conflicts with the current conversation, prioritize the user's explicit statements.";

            contextMessages.push({
                role: "system",
                content: summaryContent.trim()
            });
        }
    }

    return contextMessages;
}

/**
 * Check if a session needs summary generation
 * Returns true if session has 5+ messages and no recent summary
 */
export async function sessionNeedsSummary(sessionId) {
    const { rows: [result] } = await pool.query(
        `SELECT 
            (SELECT COUNT(*) FROM messages WHERE session_id = $1 AND is_deleted = false) as message_count,
            s.summary_updated_at,
            s.context_summary
         FROM sessions s 
         WHERE s.id = $1`,
        [sessionId]
    );

    if (!result) return false;

    const messageCount = parseInt(result.message_count, 10);
    const hasSummary = !!result.context_summary;

    // Generate summary if:
    // - 5+ messages AND no summary
    if (messageCount >= 5 && !hasSummary) {
        return true;
    }

    // Refresh summary if it's stale (older than 7 days) and we have more messages
    if (hasSummary && result.summary_updated_at) {
        const summaryAge = Date.now() - new Date(result.summary_updated_at).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (summaryAge > sevenDaysMs && messageCount >= 10) {
            return true;
        }
    }

    return false;
}

/**
 * Get session info including project_id
 */
export async function getSessionInfo(sessionId) {
    const { rows: [session] } = await pool.query(
        `SELECT id, title, project_id, user_id FROM sessions WHERE id = $1`,
        [sessionId]
    );
    return session;
}

/**
 * Delete session summary embedding from Pinecone (cleanup on session delete)
 */
export async function deleteSummaryEmbedding(sessionId) {
    try {
        const index = getPineconeIndex();
        await index.namespace(CONTEXT_NAMESPACE).deleteOne(`session-${sessionId}`);
        logger.info(`Deleted embedding for session ${sessionId}`);
    } catch (err) {
        logger.warn("Failed to delete summary embedding", { error: err.message });
    }
}
