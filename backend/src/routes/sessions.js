import express from "express";
import {
  getAllSessions,
  createSession,
  getSessionWithMessages,
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

export default router;
