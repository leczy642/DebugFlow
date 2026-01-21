/**
 * Context Service
 * 
 * Handles project-level context management:
 * - Generates session summaries using LLM
 * - Builds project context for chat requests
 * - Manages token budgets
 */

import { pool } from "../db/postgres_connect.js";
import { chatWithAI } from "./chatService.js";

// Token budget for project context (8K tokens, ~32K chars)
const PROJECT_CONTEXT_TOKEN_LIMIT = 8000;
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for a string (rough approximation)
 */
export function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Generate a summary for a session's conversation
 * Called after sessions reach 5+ messages
 */
export async function generateSessionSummary(sessionId) {
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

    // Generate summary using LLM
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

        // Store the summary
        await pool.query(
            `UPDATE sessions 
             SET context_summary = $1, summary_updated_at = NOW() 
             WHERE id = $2`,
            [summary, sessionId]
        );

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
 * Get summaries from all sessions in a project (excluding current session)
 */
export async function getProjectSessionSummaries(projectId, excludeSessionId = null) {
    const { rows } = await pool.query(
        `SELECT id, title, context_summary, summary_updated_at 
         FROM sessions 
         WHERE project_id = $1 
           AND context_summary IS NOT NULL 
           ${excludeSessionId ? 'AND id != $2' : ''}
         ORDER BY summary_updated_at DESC`,
        excludeSessionId ? [projectId, excludeSessionId] : [projectId]
    );

    return rows;
}

/**
 * Build context messages for the chat, respecting token budget
 * Returns array of system messages to prepend to conversation
 */
export async function buildContextMessages(projectId, currentSessionId, tokenLimit = PROJECT_CONTEXT_TOKEN_LIMIT) {
    const project = await getProjectContext(projectId);

    if (!project) {
        return [];
    }

    const contextMessages = [];
    let tokensUsed = 0;

    // 1. Add project instructions if present
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

    // 2. Add sibling session summaries
    const summaries = await getProjectSessionSummaries(projectId, currentSessionId);

    if (summaries.length > 0) {
        let summaryContent = "CONTEXT FROM OTHER SESSIONS IN THIS PROJECT:\n";

        for (const session of summaries) {
            const sessionLine = `• ${session.title}: ${session.context_summary}\n`;
            const lineTokens = estimateTokens(sessionLine);

            if (tokensUsed + lineTokens > tokenLimit) {
                // Stop adding summaries if we've hit the limit
                break;
            }

            summaryContent += sessionLine;
            tokensUsed += lineTokens;
        }

        if (summaryContent !== "CONTEXT FROM OTHER SESSIONS IN THIS PROJECT:\n") {
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
    // - OR 5+ messages AND summary is older than 10 messages ago (refresh periodically)
    if (messageCount >= 5 && !hasSummary) {
        return true;
    }

    // Could add logic here to refresh stale summaries
    return false;
}

/**
 * Get session info including project_id
 */
export async function getSessionInfo(sessionId) {
    const { rows: [session] } = await pool.query(
        `SELECT id, title, project_id FROM sessions WHERE id = $1`,
        [sessionId]
    );
    return session;
}
