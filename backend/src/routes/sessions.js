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
import express from "express";
import {
  getAllSessions,
  createSession,
  getSessionWithMessages,
  renameSession,
  setSessionPinned,
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
router.get("/", async (_, res) => {
  const sessions = await getAllSessions();
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
router.post("/", async (_, res) => {
  const session = await createSession();
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
// Update session properties (title, pinned)
router.patch("/:id", async (req, res) => {
  const { title, pinned } = req.body || {};

  try {
    if (typeof title !== "undefined") {
      const updated = await renameSession(req.params.id, title);
      return res.json(updated);
    }

    if (typeof pinned !== "undefined") {
      const updated = await setSessionPinned(req.params.id, pinned);
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

export default router;
