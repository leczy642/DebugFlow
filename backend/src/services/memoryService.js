/**
 * Memory Service (The Memory Ledger)
 * 
 * Manages the tiered memory system:
 * - Active Context (High confidence, always injected)
 * - Candidates (Patterns awaiting validation)
 * - Explicit Global Instructions (From User Profile)
 */

import { pool } from "../db/postgres_connect.js";
import { logger } from "../utils/logger.js";
import { getGlobalSetting } from "../db/models/user_queries.js";

/**
 * Normalizes text for comparison (removes punctuation, lowercase)
 */
function normalize(text) {
    if (!text) return "";
    return text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}

/**
 * Check if the text is present in the Super Global Context
 */
export async function isSGCContained(text) {
    try {
        const sgc = await getGlobalSetting('super_global_context');
        if (!sgc) return false;
        const normalizedSGC = normalize(sgc);
        const normalizedText = normalize(text);

        // Exact match or significant overlap (more than 80% of characters if long enough)
        if (normalizedSGC.includes(normalizedText)) {
            // Check if it's a complete thought/phrase rather than a substring of a word
            const wordBoundaryRegex = new RegExp(`\\b${normalizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return wordBoundaryRegex.test(normalizedSGC);
        }
        return false;
    } catch (err) {
        logger.warn("SGC check failed during memory validation", { error: err.message });
        return false;
    }
}

// Confidence Thresholds
const PROMOTION_THRESHOLD = 100;
const INFERENCE_START_SCORE = 20;
const EXPLICIT_CMD_SCORE = 100;

export const MemoryType = {
    EXPLICIT: 'EXPLICIT',
    INFERRED: 'INFERRED',
    PERSONAL: 'PERSONAL_INFO',
    CANDIDATE: 'CANDIDATE'
};

export const MemoryStatus = {
    ACTIVE: 'ACTIVE',
    CANDIDATE: 'CANDIDATE',
    ARCHIVED: 'ARCHIVED'
};

/**
 * Add an Explicit Memory (User said "Remember this")
 * Instantly Active.
 */
export async function addExplicitMemory(userId, text, type = MemoryType.EXPLICIT) {
    try {
        // Validation: Prevent SGC duplication/override
        if (await isSGCContained(text)) {
            logger.info(`Blocked explicit memory for user ${userId} - content already in Super Global Context`);
            return { id: null, content: text, status: 'BLOCKED_BY_SGC' };
        }

        const { rows } = await pool.query(
            `INSERT INTO user_context 
             (user_id, content, type, status, confidence, last_used_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING id, content, type, status, confidence, created_at`,
            [userId, text, type, MemoryStatus.ACTIVE, EXPLICIT_CMD_SCORE]
        );
        logger.info(`Added explicit memory for user ${userId}`);
        return rows[0];
    } catch (err) {
        logger.error("Failed to add explicit memory", { error: err.message });
        throw err;
    }
}

/**
 * Propose a Candidate (Inferred from patterns)
 * Starts as CANDIDATE with low score.
 */
export async function proposeCandidate(userId, text, metadata = {}) {
    // Validation: Prevent SGC duplication/override
    if (await isSGCContained(text)) {
        logger.debug(`Skipped candidate proposal for user ${userId} - content already in Super Global Context`);
        return null;
    }

    const normalizedText = normalize(text);

    // Check for similar existing memories (Active or Candidate)
    const { rows: existing } = await pool.query(
        `SELECT id, content, confidence, status FROM user_context 
         WHERE user_id = $1 AND status != $2`,
        [userId, MemoryStatus.ARCHIVED]
    );

    const similar = existing.find(m => {
        const existingNormalized = normalize(m.content);
        return existingNormalized === normalizedText ||
            existingNormalized.includes(normalizedText) ||
            normalizedText.includes(existingNormalized);
    });

    if (similar) {
        logger.info(`Reinforcing similar memory for user ${userId}: "${similar.content}" vs new "${text}"`);
        return reinforceMemory(similar.id);
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO user_context 
             (user_id, content, type, status, confidence, metadata, last_used_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id, content, type, status, confidence, created_at`,
            [userId, text, MemoryType.INFERRED, MemoryStatus.CANDIDATE, INFERENCE_START_SCORE, metadata]
        );
        logger.info(`Proposed new candidate memory for user ${userId}: ${text}`);
        return rows[0];
    } catch (err) {
        logger.error("Failed to propose candidate", { error: err.message });
        return null;
    }
}

/**
 * Reinforce a memory (seen again)
 * Increments confidence. Promotes to ACTIVE if threshold met.
 */
export async function reinforceMemory(memoryId, amount = 20) {
    try {
        // 1. Get current state
        const { rows: [memory] } = await pool.query(
            `SELECT id, confidence, status FROM user_context WHERE id = $1`,
            [memoryId]
        );

        if (!memory) return null;

        const newConfidence = Math.min(memory.confidence + amount, 100); // Max 100
        let newStatus = memory.status;

        // Promotion check
        if (memory.status === MemoryStatus.CANDIDATE && newConfidence >= PROMOTION_THRESHOLD) {
            newStatus = MemoryStatus.ACTIVE;
            logger.info(`Promoted memory ${memoryId} to ACTIVE`);

            // Log if it matches SGC for visibility, but don't block
            if (await isSGCContained(memory.content)) {
                logger.debug(`Memory ${memoryId} promoted to ACTIVE despite overlap with Super Global Context.`);
            }
        }

        const { rows: [updated] } = await pool.query(
            `UPDATE user_context 
             SET confidence = $1, status = $2, last_used_at = NOW(), updated_at = NOW()
             WHERE id = $3
             RETURNING id, content, type, status, confidence, created_at`,
            [newConfidence, newStatus, memoryId]
        );

        return updated;
    } catch (err) {
        logger.error("Failed to reinforce memory", { error: err.message });
        return null;
    }
}

/**
 * Archive/Demote a memory (User said "Forget this")
 */
export async function archiveMemory(memoryId) {
    try {
        await pool.query(
            `UPDATE user_context 
             SET status = $1, updated_at = NOW()
             WHERE id = $2`,
            [MemoryStatus.ARCHIVED, memoryId]
        );
        return true;
    } catch (err) {
        logger.error("Failed to archive memory", { error: err.message });
        return false;
    }
}

/**
 * Get Global User Context (Tier 1 & Tier 2)
 * Returns string formatted for System Prompt
 */
export async function getEffectiveGlobalContext(userId) {
    try {
        // 1. Fetch Global Instructions (Tier 1 - User Profile)
        const { rows: [user] } = await pool.query(
            `SELECT global_instructions FROM users WHERE id = $1`,
            [userId]
        );

        // 2. Fetch Active Memories (Tier 2 - Ledger)
        const { rows: memories } = await pool.query(
            `SELECT content, type FROM user_context 
             WHERE user_id = $1 AND status = 'ACTIVE' 
             ORDER BY confidence DESC, created_at DESC`,
            [userId]
        );

        let contextString = "";

        // Format Global Instructions
        if (user && user.global_instructions) {
            contextString += `USER PROFILE & PREFERENCES:\n${user.global_instructions}\n\n`;
        }

        // Format Active Memories
        if (memories.length > 0) {
            const explicit = memories.filter(m => m.type === MemoryType.EXPLICIT || m.type === MemoryType.PERSONAL);
            const inferred = memories.filter(m => m.type === MemoryType.INFERRED);

            if (explicit.length > 0) {
                contextString += `ESTABLISHED FACTS & RULES:\n${explicit.map(m => `- ${m.content}`).join('\n')}\n\n`;
            }

            if (inferred.length > 0) {
                contextString += `LEARNED PATTERNS:\n${inferred.map(m => `- ${m.content}`).join('\n')}\n`;
            }
        }

        return contextString.trim();
    } catch (err) {
        logger.warn("Failed to fetch effective global context", { error: err.message });
        return "";
    }
}

/**
 * Get all memories (for UI Settings)
 */
export async function getAllMemories(userId) {
    const { rows } = await pool.query(
        `SELECT id, content, type, status, confidence, created_at 
         FROM user_context 
         WHERE user_id = $1 AND status != 'ARCHIVED'
         ORDER BY status, confidence DESC`,
        [userId]
    );

    // Filter out any that match SGC
    const sgc = await getGlobalSetting('super_global_context');
    const normalizedSGC = normalize(sgc);

    return rows.filter(m => !normalizedSGC.includes(normalize(m.content)));
}
