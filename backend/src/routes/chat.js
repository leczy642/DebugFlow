/**
 * POST /chat
 * 
 * Handles user chat messages and returns AI-generated responses.
 * 
 * Input (req.body):
 *   - message: string - User's chat message
 * 
 * Output (res.json):
 *   Success (200): { success: true, reply: string }
 *   Error (400): { success: false, error: string } - Invalid input
 *   Error (500): { success: false, error: string } - Server/AI error
 */

import express from "express";
import { logger } from "../utils/logger.js";
import { chatWithAI, generateSessionTitle } from "../services/chatService.js";
import { retryWithBackoff } from "../utils/retry.js";
import { withTimeout } from "../utils/withTimeout.js";
import {
  addMessage,
  sessionExists,
  getSessionWithMessages,
  withTransaction,
} from "../db/models/postgres_session_queries.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const LLM_CHAT_TIMEOUT_MS = Number(
    process.env.HUGGINGFACE_CHAT_TIMEOUT_MS || 8000
  );

  try {
    const { sessionId, message, parentId, skipUserMessage } = req.body;

    /* -----------------------------
       VALIDATION
    ----------------------------- */
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        success: false,
        error: "sessionId is required",
      });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "message must be a non-empty string",
      });
    }

    /* -----------------------------
       ENSURE SESSION EXISTS
    ----------------------------- */
    const exists = await sessionExists(sessionId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    /* -----------------------------
       TRANSACTION (USER + AI)
       Also: if this is the session's first user message, generate a short
       title from that message and persist it in the same transaction.
    ----------------------------- */
    // check whether this session already has messages
    const sessionState = await getSessionWithMessages(sessionId);
    const isFirstMessage = sessionState?.messages?.length === 0;

    const result = await withTransaction(async (client) => {
      // Save user message
      // If parentId is not provided, we try to find the last message to link to (linear chain)
      // But for now, if it's null, it's a root message or we let the DB handle it if we want strict trees.
      // In this app, we'll just pass what we have.
      // Save user message
      let userMessageId;
      if (skipUserMessage && parentId) {
        // If regenerating, we reuse the existing user message (parentId)
        userMessageId = parentId;
      } else {
        userMessageId = await addMessage(sessionId, "user", message, client, parentId);
      }

      let generatedTitle = null;
      // If this is the first user message, generate a short session title
      if (isFirstMessage && !skipUserMessage) {
        try {
          generatedTitle = await generateSessionTitle(message);
          // Update session title within transaction
          await client.query(
            `UPDATE sessions SET title = $2, updated_at = NOW() WHERE id = $1`,
            [sessionId, generatedTitle]
          );
        } catch (err) {
          // Non-fatal: if title generation fails, continue without blocking chat
          logger.warn("Title generation failed", { error: err instanceof Error ? err.message : err });
          generatedTitle = null;
        }
      }

      // 🔮 TODO: extract logs + retrieve context (RAG step)
      // const relevantLogs = await retrieveRelevantLogs(message, sessionId);

      // Call AI model
      const aiReply = await withTimeout(
        () => retryWithBackoff(() => chatWithAI(message)),
        LLM_CHAT_TIMEOUT_MS
      );

      // Save assistant message, linked to user message
      await addMessage(sessionId, "assistant", aiReply, client, userMessageId);


      return { aiReply, generatedTitle };
    });
    const reply = result.aiReply;
    const generatedTitle = result.generatedTitle;

    const responsePayload = { success: true, reply };
    if (generatedTitle) responsePayload.title = generatedTitle;

    return res.status(200).json(responsePayload);
  } catch (error) {
    logger.error("Chat error", {
      error: error instanceof Error ? error.message : error,
    });

    return res.status(500).json({
      success: false,
      error: "No response from reasoning model",
    });
  }
});

export default router;
