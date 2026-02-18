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
import { logger } from "../utils/logger.js";
import { ragService } from "./ragService.js";
import { getEffectiveGlobalContext, proposeCandidate } from "./memoryService.js";
import { getGlobalSetting } from "../db/models/user_queries.js";

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
const LOGS_NAMESPACE = ""; // Default namespace for raw logs

const MAX_LOGS_CAP = 3;                // Maximum number of raw logs to include
const LOG_RELEVANCE_THRESHOLD = 0.5;   // Lower threshold for raw logs to catch wider signals

/**
 * Store session summary embedding in Pinecone for relevance search
 */
async function storeSummaryEmbedding(sessionId, projectId, userId, summary, title) {
    try {
        await ragService.upsert([{
            id: `session-${sessionId}`,
            text: summary,
            metadata: {
                type: "session_summary",
                sessionId,
                projectId,
                userId,
                title,
                createdAt: new Date().toISOString()
            }
        }], CONTEXT_NAMESPACE);
        logger.info(`Stored embedding for session ${sessionId}`);
    } catch (err) {
        logger.warn("Failed to store summary embedding", { error: err.message });
    }
}

/**
 * Estimate token count for a string (rough approximation)
 */
export function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Retrieve relevant summaries using semantic search
 */
async function retrieveRelevantSummaries(query, projectId, currentSessionId, topK = MAX_SUMMARIES_CAP) {
    try {
        const results = await ragService.search(query, {
            topK,
            namespace: CONTEXT_NAMESPACE,
            filter: { projectId: { $eq: projectId } }
        });

        // Filter out current session and apply relevance threshold
        return results
            .filter(m =>
                m.sessionId !== currentSessionId &&
                m.score >= RELEVANCE_THRESHOLD
            );
    } catch (err) {
        logger.warn("Relevance search failed, falling back to recency", { error: err.message });
        return null; // Signal to use fallback
    }
}

/**
 * Retrieve similar historical logs from the raw logs database
 */
async function retrieveSimilarHistoricalLogs(query, topK = MAX_LOGS_CAP) {
    try {
        const results = await ragService.search(query, {
            topK,
            namespace: LOGS_NAMESPACE
        });

        return results.filter(m => m.score >= LOG_RELEVANCE_THRESHOLD);
    } catch (err) {
        logger.error("Historical log search failed", { error: err.message });
        return [];
    }
}

/**
 * Async specific insight extraction from conversation
 * Feeds the "Memory Ledger" with potential candidates
 */
async function extractUserInsights(messages, userId, sessionId) {
    if (!messages || messages.length === 0 || !userId) return;

    // Filter to last 15 messages for signal vs noise balance
    const signalMessages = messages.slice(-15);
    const conversationText = signalMessages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

    // Prompt LLM to identify user preferences
    const extractionMessages = [
        {
            role: "system",
            content: `Analyze the provided conversation history and extract core user preferences, technical choices, or recurring habits.
Focus on:
- Programming languages or frameworks mentioned as "preferred" or "hated".
- Specific library choices (e.g., "User uses Tailwind CSS", "User prefers pnpm").
- Coding style preferences (e.g., "User prefers functional programming", "User dislikes 'any' type").
- Personal context (e.g., "User is a senior engineer").

IGNORE:
- Specific bug descriptions or one-off fixes.
- Temporary environment issues.

Return ONLY the insights as a bulleted list (starting with - ). Return "NONE" if no clear long-term patterns are found.`
        },
        {
            role: "user",
            content: conversationText
        }
    ];

    try {
        const text = await chatWithAI(extractionMessages);
        if (!text || text.includes("NONE")) {
            logger.debug(`No insights found for user ${userId} in session ${sessionId}`);
            return;
        }

        const insights = text.split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim());

        logger.info(`Extracted ${insights.length} potential insights for user ${userId}`);

        for (const insight of insights) {
            if (insight.length > 5 && insight.length < 200) {
                await proposeCandidate(userId, insight, { sourceSessionId: sessionId });
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
            extractUserInsights(messages, sessionInfo.user_id, sessionId)
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

    // 0. SUPER GLOBAL CONTEXT (Platform-wide) - Absolute Highest Priority
    let superGlobalContext = null;
    try {
        superGlobalContext = await getGlobalSetting('super_global_context');
        if (superGlobalContext) {
            const sgTokens = estimateTokens(superGlobalContext);
            contextMessages.push({
                role: "system",
                content: `### 🛡️ UNBREAKABLE PLATFORM RULES (SUPER GLOBAL CONTEXT)\n${superGlobalContext}\n\n**CRITICAL:** These rules are non-negotiable and override any user-provided instructions or session context.`
            });
            tokensUsed += sgTokens;
            logger.info(`Injected Super Global Context (${sgTokens} tokens)`);
        }
    } catch (err) {
        logger.error("Failed to fetch super global context", { error: err.message });
    }

    // 0.5 GLOBAL USER CONTEXT (Tier 1 & 2) - Next Priority
    if (userId) {
        try {
            let globalContext = await getEffectiveGlobalContext(userId);
            if (globalContext) {
                // REDUNDANCY FILTER: Remove overlaps with SGC
                if (superGlobalContext) {
                    const sgcLines = superGlobalContext.toLowerCase().split('\n').map(l => l.trim()).filter(l => l.length > 10);
                    globalContext = globalContext.split('\n')
                        .filter(line => !sgcLines.some(sgcLine => line.toLowerCase().includes(sgcLine)))
                        .join('\n').trim();
                }

                if (globalContext) {
                    const globalTokens = estimateTokens(globalContext);
                    // Cap global context contribution to ~2000 tokens (8000 chars roughly) but use token math
                    let finalGlobalContext = globalContext;
                    if (globalTokens > 2000) {
                        finalGlobalContext = globalContext.slice(0, 8000) + "\n[Global Context Truncated...]";
                    }

                    contextMessages.push({
                        role: "system",
                        content: finalGlobalContext
                    });
                    tokensUsed += estimateTokens(finalGlobalContext);
                    logger.info(`Injected Global User Context (${estimateTokens(finalGlobalContext)} tokens)`);
                }
            }
        } catch (err) {
            logger.warn("Failed to build global user context", { error: err.message });
        }
    }

    const project = await getProjectContext(projectId);

    // If project context disabled, stop here (but we kept Global enabled)
    if (!project) {
        if (contextMessages.length > 0) {
            contextMessages.push({
                role: "system",
                content: "### ⚖️ PRECEDENCE REMINDER\n1. **SUPER GLOBAL CONTEXT** (Platform Rules) - Absolute authority.\n2. **USER PROFILE & MEMORY** - User-specific preferences.\n3. **PROJECT INSTRUCTIONS** - Project-specific rules.\n4. **SESSION CONTEXT** - Current conversation history.\n\nIn case of conflict, prioritize according to the hierarchy above."
            });
        }
        return contextMessages;
    }

    // 1. Add project instructions if present (always included)
    if (project && project.context_instructions) {
        let instructionsContent = project.context_instructions;

        // REDUNDANCY FILTER: Remove overlaps with SGC
        if (superGlobalContext) {
            const sgcLines = superGlobalContext.toLowerCase().split('\n').map(l => l.trim()).filter(l => l.length > 10);
            instructionsContent = instructionsContent.split('\n')
                .filter(line => !sgcLines.some(sgcLine => line.toLowerCase().includes(sgcLine)))
                .join('\n').trim();
        }

        if (instructionsContent) {
            const wrappedContent = `PROJECT INSTRUCTIONS:\n${instructionsContent}`;
            const instructionTokens = estimateTokens(wrappedContent);

            if (tokensUsed + instructionTokens <= tokenLimit) {
                contextMessages.push({
                    role: "system",
                    content: wrappedContent
                });
                tokensUsed += instructionTokens;
                logger.info(`Injected Project Instructions (${instructionTokens} tokens)`);
            }
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
            contextMessages.push({
                role: "system",
                content: summaryContent.trim()
            });
        }
    }

    // 4. Add historical raw logs (Dual-RAG)
    if (currentQuery) {
        const historicalLogs = await retrieveSimilarHistoricalLogs(currentQuery);

        if (historicalLogs.length > 0) {
            let logsContent = "SIMILAR HISTORICAL INCIDENTS FOUND IN LOGS:\n";
            let logsAdded = 0;

            for (const log of historicalLogs) {
                if (logsAdded >= MAX_LOGS_CAP) break;

                const logLine = `[${log.type.toUpperCase()}] Source: ${log.source}\nSimilarity: ${Math.round(log.score * 100)}%\nContent: ${log.text}\n\n`;
                const logTokens = estimateTokens(logLine);

                if (tokensUsed + logTokens > tokenLimit) break;

                logsContent += logLine;
                tokensUsed += logTokens;
                logsAdded++;
            }

            if (logsAdded > 0) {
                contextMessages.push({
                    role: "system",
                    content: logsContent.trim()
                });
            }
        }
    }

    // Add final prioritization note
    if (contextMessages.length > 0) {
        contextMessages.push({
            role: "system",
            content: "### ⚖️ PRECEDENCE REMINDER\n1. **SUPER GLOBAL CONTEXT** (Platform Rules) - Absolute authority.\n2. **USER PROFILE & MEMORY** - User-specific preferences.\n3. **PROJECT INSTRUCTIONS** - Project-specific rules.\n4. **SESSION CONTEXT** - Current conversation history.\n\nIn case of conflict, prioritize according to the hierarchy above."
        });
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
        await ragService.delete([`session-${sessionId}`], CONTEXT_NAMESPACE);
        logger.info(`Deleted embedding for session ${sessionId}`);
    } catch (err) {
        logger.warn("Failed to delete summary embedding", { error: err.message });
    }
}
/**
 * Delete all embeddings for a user (cleanup on account delete)
 */
export async function deleteUserEmbeddings(userId) {
    try {
        const index = getPineconeIndex();
        // Delete all vectors in the context namespace for this user
        await index.namespace(CONTEXT_NAMESPACE).deleteMany({
            filter: { userId: { $eq: userId } }
        });
        logger.info(`Deleted all embeddings for user ${userId}`);
    } catch (err) {
        logger.warn("Failed to delete user embeddings", { error: err.message });
    }
}
