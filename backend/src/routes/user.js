import express from 'express';
import { logger } from '../utils/logger.js';
import { pool } from '../db/postgres_connect.js';
import {
    getAllMemories,
    addExplicitMemory,
    archiveMemory,
    reinforceMemory,
    getEffectiveGlobalContext
} from '../services/memoryService.js';

const router = express.Router();

/**
 * GET /api/user/profile
 * Returns user profile including global instructions
 */
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { rows: [user] } = await pool.query(
            `SELECT global_instructions FROM users WHERE id = $1`,
            [userId]
        );
        res.json({ global_instructions: user?.global_instructions || "" });
    } catch (err) {
        logger.error("Failed to fetch user profile", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * PATCH /api/user/profile
 * Updates global instructions
 */
router.patch('/profile', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { global_instructions } = req.body;

        await pool.query(
            `UPDATE users SET global_instructions = $1 WHERE id = $2`,
            [global_instructions, userId]
        );
        res.json({ success: true, global_instructions });
    } catch (err) {
        logger.error("Failed to update user profile", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /api/user/memories
 * Get all memories (Active & Candidates)
 */
router.get('/memories', async (req, res) => {
    try {
        const userId = req.user.uid;
        const memories = await getAllMemories(userId);
        res.json(memories);
    } catch (err) {
        logger.error("Failed to fetch memories", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * POST /api/user/memories
 * Add explicit memory manually
 */
router.post('/memories', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: "Content required" });

        const memory = await addExplicitMemory(userId, content);
        res.json(memory);
    } catch (err) {
        logger.error("Failed to add memory", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * PATCH /api/user/memories/:id/archive
 * Archive (delete/forget) a memory
 */
router.patch('/memories/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await archiveMemory(id);
        if (success) res.json({ success: true });
        else res.status(404).json({ error: "Memory not found" });
    } catch (err) {
        logger.error("Failed to archive memory", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * PATCH /api/user/memories/:id/promote
 * Promote candidate to active (reinforce by 100)
 */
router.patch('/memories/:id/promote', async (req, res) => {
    try {
        const { id } = req.params;
        // Reinforcing by 100 guarantees promotion to Active (threshold is 100)
        const memory = await reinforceMemory(id, 100);
        if (memory) res.json(memory);
        else res.status(404).json({ error: "Memory not found" });
    } catch (err) {
        logger.error("Failed to promote memory", { error: err.message });
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
