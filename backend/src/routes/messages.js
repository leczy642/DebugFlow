/**
 * Message Routes
 *
 * Provides REST API endpoints for managing individual messages.
 * 
 * Features:
 *   - Delete a message
 */
import express from "express";
import { deleteMessageById } from "../db/models/postgres_session_queries.js";

const router = express.Router();

/**
 * DELETE /messages/:id
 *
 * Deletes a specific message.
 *
 * Input (req.params):
 *   - id: string - Message ID
 *
 * Output (res.json):
 *   Success (200): { success: true }
 *   Error (404): { error: "Message not found" }
 *   Error (500): { error: "Failed to delete message" }
 */
router.delete("/:id", async (req, res) => {
    try {
        const deleted = await deleteMessageById(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Message not found" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete message" });
    }
});

export default router;
