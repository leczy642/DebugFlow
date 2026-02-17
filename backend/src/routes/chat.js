/**
 * POST /chat
 * 
 * Handles user chat messages and returns AI-generated responses.
 */

import express from "express";
import { logger } from "../utils/logger.js";
import { streamChatWithAI, generateSessionTitle } from "../services/chatService.js";
import { requireNotBlocked } from "../middleware/roleMiddleware.js";
import {
  addMessage,
  appendMessageContent,
  sessionExists,
  getSessionWithMessages,
} from "../db/models/postgres_session_queries.js";
import {
  buildContextMessages,
  getSessionInfo,
  sessionNeedsSummary,
  generateSessionSummary,
} from "../services/contextService.js";
import { pool } from "../db/postgres_connect.js";

const router = express.Router();

router.post("/", requireNotBlocked, async (req, res) => {
  try {
    const { sessionId, message, parentId, skipUserMessage } = req.body;

    if (!req.user?.uid) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const { uid: firebaseUid } = req.user;

    /* -----------------------------
       1. IMMEDIATE HEADER & PULSE FLUSH
    ----------------------------- */
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(": keep-alive\n\n");
    res.write(`data: ${JSON.stringify({ status: "connecting" })}\n\n`);

    const sessionRes = await pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rowCount === 0) {
      res.write(`data: ${JSON.stringify({ error: "Session not found" })}\n\n`);
      return res.end();
    }

    const currentTitle = sessionRes.rows[0].title;
    const sessionState = await getSessionWithMessages(sessionId);
    const isFirstMessage = (sessionState?.messages || []).length === 0;

    /* -----------------------------
       2. FAST MESSAGE PERSISTENCE (Dual-ID Sync)
    ----------------------------- */
    let userMessageId;
    let assistantMessageId;
    let validatedParentId = parentId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (parentId && !uuidRegex.test(parentId)) {
      validatedParentId = null;
    }

    if (req.body.isContinuation) {
      const lastAssistantMsg = (sessionState?.messages || [])
        .filter(m => m.role === 'assistant' && !m.isDeleted)
        .pop();
      if (!lastAssistantMsg) {
        res.write(`data: ${JSON.stringify({ error: "No assistant message found to continue." })}\n\n`);
        return res.end();
      }
      assistantMessageId = lastAssistantMsg.id;
      userMessageId = assistantMessageId;
    } else {
      // Create USER message
      if (!skipUserMessage) {
        userMessageId = await addMessage(sessionId, "user", message, pool, validatedParentId);
        // Sync User ID immediately
        res.write(`data: ${JSON.stringify({ userMessageId })}\n\n`);
      } else {
        userMessageId = validatedParentId;
      }

      // Create ASSISTANT message (Correct Branching: linked to User)
      assistantMessageId = await addMessage(sessionId, "assistant", "", pool, userMessageId);
    }

    // Sync Assistant ID immediately
    res.write(`data: ${JSON.stringify({ messageId: assistantMessageId })}\n\n`);

    /* -----------------------------
       3. SESSION TITLE GENERATION (Non-blocking)
    ----------------------------- */
    let generatedTitle = null;
    if (isFirstMessage || currentTitle === "New Debug Session") {
      try {
        generatedTitle = await generateSessionTitle(message);
        await pool.query(
          `UPDATE sessions SET title = $2, updated_at = NOW() WHERE id = $1`,
          [sessionId, generatedTitle]
        );
        res.write(`data: ${JSON.stringify({ title: generatedTitle })}\n\n`);
      } catch (err) {
        logger.warn("Title generation failed", { error: err.message });
      }
    }

    /* -----------------------------
       4. HISTORY RECONSTRUCTION
    ----------------------------- */
    const history = [];
    const msgMap = new Map((sessionState?.messages || []).map((m) => [m.id, m]));

    let currentId = req.body.isContinuation ? assistantMessageId : (skipUserMessage ? userMessageId : validatedParentId);
    if (req.body.isContinuation) {
      currentId = msgMap.get(assistantMessageId)?.parentId;
    }

    while (currentId) {
      const msg = msgMap.get(currentId);
      if (!msg) break;
      if (!msg.isDeleted) {
        history.unshift({ role: msg.role, content: msg.content });
      }
      currentId = msg.parentId;
    }

    if (req.body.isContinuation) {
      history.push({ role: "user", content: "Continue your previous response seamlessly." });
    } else if (!skipUserMessage) {
      history.push({ role: "user", content: message });
    }

    /* -----------------------------
       5. CONTEXT & STREAMING
    ----------------------------- */
    res.write(`data: ${JSON.stringify({ status: "building_context" })}\n\n`);
    const sessionInfo = await getSessionInfo(sessionId);
    if (sessionInfo?.project_id || firebaseUid) {
      try {
        const contextMessages = await buildContextMessages(sessionInfo.project_id, sessionId, message, firebaseUid);
        history.unshift(...contextMessages);
      } catch (err) {
        logger.warn("Context building failed", { error: err.message });
      }
    }

    let fullAiReply = "";
    let isAborted = false;
    const cleanup = () => { isAborted = true; };
    req.on("close", cleanup);
    res.on("close", cleanup);

    try {
      const stream = await streamChatWithAI(history);
      for await (const chunk of stream) {
        if (isAborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullAiReply += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!isAborted) {
        res.write(`data: [DONE]\n\n`);
        if (fullAiReply) {
          await appendMessageContent(assistantMessageId, fullAiReply, pool);
          if (sessionInfo?.user_id) {
            setImmediate(async () => {
              try {
                const needsSummary = await sessionNeedsSummary(sessionId);
                if (needsSummary) await generateSessionSummary(sessionId);
              } catch (e) { }
            });
          }
        }
      }
      res.end();
    } catch (streamError) {
      logger.error("Streaming error", { error: streamError.message });
      if (!isAborted) {
        res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    logger.error("Global Chat error", { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Server error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
