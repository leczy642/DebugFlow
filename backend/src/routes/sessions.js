/**
 * Session Routes
 *
 * Provides REST API endpoints for managing chat sessions and their messages.
 * 
 * Features:
 *   - List all sessions
 *   - Create a new session
 *   - Get a session (with messages)
 *   - Get messages for a session
 *   - Rename or pin/unpin a session
 *   - Delete a session and its messages
 */
//routes/sessions.js
import express from "express";
import { requireNotBlocked } from "../middleware/roleMiddleware.js";
import {
  getAllSessions,
  createSession,
  getSessionWithMessages,
  renameSession,
  setSessionPinned,
  assignSessionToProject,
  deleteSessionById,
} from "../db/models/postgres_session_queries.js";


const router = express.Router();
/**
 * GET /sessions
 *
 * Returns all chat sessions.
 *
 * Input: none
 *
 * Output (res.json):
 *   Success (200): Array<Session>
 *   Error (500): { error: string } - Database failure
 */
router.get("/", async (req, res) => {
  const { uid } = req.user;
  const sessions = await getAllSessions(uid);
  res.json(sessions);
});

/**
 * POST /sessions
 *
 * Creates a new session with default values.
 *
 * Input: none
 *
 * Output (res.json):
 *   Success (200): Session
 *   Error (500): { error: string } - Failed to create session
 */
router.post("/", requireNotBlocked, async (req, res) => {
  const { uid } = req.user;
  const { project_id } = req.body;
  const session = await createSession(uid, project_id);
  res.json(session);
});

/**
 * GET /sessions/:id
 *
 * Returns a specific session including its messages.
 *
 * Input (req.params):
 *   - id: string - Session ID
 *
 * Output (res.json):
 *   Success (200): SessionWithMessages
 *   Error (404): { error: "Session not found" }
 *   Error (500): { error: string }
 */

router.get("/:id", async (req, res) => {
  const session = await getSessionWithMessages(req.params.id);
  res.json(session);
});

/**
 * GET /sessions/:id/messages
 *
 * Returns messages for a specific session only.
 *
 * Input (req.params):
 *   - id: string - Session ID
 *
 * Output (res.json):
 *   Success (200): Array<Message>
 *   Error (404): { error: "Session not found" }
 *   Error (500): { error: string }
 */
// Return messages only for a session (frontend expects this endpoint)
router.get("/:id/messages", async (req, res) => {
  const session = await getSessionWithMessages(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session.messages);
});

/**
 * PATCH /sessions/:id
 *
 * Updates session properties (title or pinned state).
 *
 * Input (req.params):
 *   - id: string - Session ID
 *
 * Input (req.body):
 *   - title?: string   - New session title
 *   - pinned?: boolean - Whether session is pinned
 *
 * Output (res.json):
 *   Success (200): Updated session
 *   Error (400): { error: "No updatable fields provided" }
 *   Error (500): { error: "Failed to update session" }
 */
// Update session properties (title, pinned, project_id)
router.patch("/:id", async (req, res) => {
  const { title, pinned, project_id } = req.body || {};

  try {
    if (typeof title !== "undefined") {
      const updated = await renameSession(req.params.id, title);
      return res.json(updated);
    }

    if (typeof pinned !== "undefined") {
      const updated = await setSessionPinned(req.params.id, pinned);
      return res.json(updated);
    }

    if (typeof project_id !== "undefined") {
      const updated = await assignSessionToProject(req.params.id, project_id);
      return res.json(updated);
    }

    res.status(400).json({ error: "No updatable fields provided" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

/**
 * DELETE /sessions/:id
 *
 * Deletes a session and all associated messages.
 *
 * Input (req.params):
 *   - id: string - Session ID
 *
 * Output (res.json):
 *   Success (200): { success: true }
 *   Error (404): { error: "Session not found" }
 *   Error (500): { error: "Failed to delete session" }
 */
// Delete a session and its messages
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteSessionById(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Session not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

/**
 * DELETE /sessions/:id/summary
 * Clear a session's context summary (removes from project memory)
 */
router.delete("/:id/summary", async (req, res) => {
  try {
    const { deleteSessionSummary } = await import("../db/models/postgres_session_queries.js");
    const { deleteSummaryEmbedding } = await import("../services/contextService.js");

    await deleteSessionSummary(req.params.id);
    await deleteSummaryEmbedding(req.params.id).catch(e => console.error("Pinecone delete failed", e));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete session summary" });
  }
});

/**
 * POST /sessions/:id/promote
 * Promote a session summary to the Global Memory Ledger
 */
router.post("/:id/promote", async (req, res) => {
  try {
    const { pool } = await import("../db/postgres_connect.js");
    const { addExplicitMemory } = await import("../services/memoryService.js");

    // 1. Get the summary
    const { rows: [session] } = await pool.query(
      `SELECT context_summary FROM sessions WHERE id = $1`,
      [req.params.id]
    );

    if (!session || !session.context_summary) {
      return res.status(400).json({ error: "No summary found to promote" });
    }

    // 2. Add to global brain as EXPLICIT active memory
    const memory = await addExplicitMemory(req.user.uid, session.context_summary);

    res.json({ success: true, memory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to promote summary" });
  }
});

export default router;
