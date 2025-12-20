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

export default router;
