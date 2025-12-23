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

router.get("/", async (_, res) => {
  const sessions = await getAllSessions();
  res.json(sessions);
});

router.post("/", async (_, res) => {
  const session = await createSession();
  res.json(session);
});

router.get("/:id", async (req, res) => {
  const session = await getSessionWithMessages(req.params.id);
  res.json(session);
});

// Return messages only for a session (frontend expects this endpoint)
router.get("/:id/messages", async (req, res) => {
  const session = await getSessionWithMessages(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session.messages);
});

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
