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
import { streamChatWithAI, generateSessionTitle } from "../services/chatService.js";
import { retryWithBackoff } from "../utils/retry.js";
import { withTimeout } from "../utils/withTimeout.js";
import {
  addMessage,
  sessionExists,
  getSessionWithMessages,
  withTransaction,
} from "../db/models/postgres_session_queries.js";
import {
  buildContextMessages,
  getSessionInfo,
  sessionNeedsSummary,
  generateSessionSummary,
} from "../services/contextService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const LLM_CHAT_TIMEOUT_MS = Number(
    process.env.HUGGINGFACE_CHAT_TIMEOUT_MS || 8000
  );

  try {
    const { sessionId, message, parentId, skipUserMessage } = req.body;

    // Defensive check: ensure user is authenticated
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      });
    }

    const { uid: firebaseUid } = req.user;

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
       PREPARE FOR STREAMING
    ----------------------------- */
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    /* -----------------------------
       TRANSACTION (USER MESSAGE PERSISTENCE)
       We persist the user message FIRST, before streaming starts.
    ----------------------------- */
    // check whether this session already has messages
    const sessionState = await getSessionWithMessages(sessionId);
    const isFirstMessage = sessionState?.messages?.length === 0;

    let userMessageId;
    let generatedTitle = null;

    // We use a transaction to save the user message and optionally the title
    await withTransaction(async (client) => {
      // Save user message
      if (skipUserMessage && parentId) {
        userMessageId = parentId;
      } else {
        userMessageId = await addMessage(sessionId, "user", message, client, parentId);
      }

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
          logger.warn("Title generation failed", { error: err instanceof Error ? err.message : err });
          generatedTitle = null;
        }
      }
    });

    // Send the title immediately if generated
    if (generatedTitle) {
      res.write(`data: ${JSON.stringify({ title: generatedTitle })}\n\n`);
    }

    /* -----------------------------
       RECONSTRUCT CONVERSATION HISTORY
    ----------------------------- */
    const allMessages = sessionState?.messages || [];
    const msgMap = new Map(allMessages.map((m) => [m.id, m]));
    const history = [];

    let currentId = skipUserMessage ? parentId : parentId;
    if (skipUserMessage) {
      currentId = parentId;
    } else {
      currentId = parentId;
    }

    while (currentId) {
      const msg = msgMap.get(currentId);
      if (!msg) break;
      if (!msg.isDeleted) {
        history.unshift({ role: msg.role, content: msg.content });
      }
      currentId = msg.parentId;
    }

    if (!skipUserMessage) {
      history.push({ role: "user", content: message });
    }

    /* -----------------------------
       INJECT PROJECT CONTEXT
    ----------------------------- */
    const sessionInfo = await getSessionInfo(sessionId);
    let contextMessages = [];
    if (sessionInfo?.project_id) {
      try {
        // Pass current message for relevance-based context retrieval
        contextMessages = await buildContextMessages(
          sessionInfo.project_id,
          sessionId,
          message  // Current query for semantic search
        );
        // Prepend context to history
        if (contextMessages.length > 0) {
          history.unshift(...contextMessages);
          logger.info(`Injected ${contextMessages.length} context messages for session ${sessionId}`);
        }
      } catch (err) {
        logger.warn("Failed to build project context", { error: err instanceof Error ? err.message : err });
      }
    }

    /* -----------------------------
       STREAMING RESPONSE
    ----------------------------- */
    /* -----------------------------
       STREAMING RESPONSE
    ----------------------------- */
    let fullAiReply = "";
    let isAborted = false;

    // Detect client disconnect
    const onDisconnect = () => {
      if (!isAborted) {
        isAborted = true;
        logger.info(`Client disconnected for session ${sessionId}, aborting stream`);
      }
    };

    req.on("close", onDisconnect);
    req.on("aborted", onDisconnect);
    // Sometimes the response close event fires instead/first
    res.on("close", onDisconnect);

    try {
      const stream = await streamChatWithAI(history);

      for await (const chunk of stream) {
        if (isAborted) {
          logger.info(`Stream aborted for session ${sessionId}`);
          break;
        }

        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullAiReply += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (!isAborted) {
        // Stream finished normally
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        // Stream aborted
        res.end();
      }

      // Persist the AI response (full or partial)
      // Only persist if we have some content
      if (fullAiReply) {
        await withTransaction(async (client) => {
          await addMessage(sessionId, "assistant", fullAiReply, client, userMessageId);
        });

        // Check if we should generate a session summary (async, non-blocking)
        if (sessionInfo?.project_id) {
          setImmediate(async () => {
            try {
              const needsSummary = await sessionNeedsSummary(sessionId);
              if (needsSummary) {
                await generateSessionSummary(sessionId);
                logger.info(`Generated summary for session ${sessionId}`);
              }
            } catch (err) {
              logger.warn("Summary generation failed", { error: err instanceof Error ? err.message : err });
            }
          });
        }
      }

    } catch (streamError) {
      logger.error("Streaming error", { error: streamError });
      if (!isAborted) {
        res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
        res.end();
      }
    }

  } catch (error) {
    logger.error("Chat error", {
      error: error instanceof Error ? error.message : error,
    });

    // If headers haven't been sent, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } else {
      // If headers sent (streaming started), send error event
      res.write(`data: ${JSON.stringify({ error: "Server error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
