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
import { requireNotBlocked } from "../middleware/roleMiddleware.js";
import {
  addMessage,
  appendMessageContent,
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

router.post("/", requireNotBlocked, async (req, res) => {
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

    // Validate parentId format (must be UUID or null)
    let validatedParentId = parentId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (parentId && !uuidRegex.test(parentId)) {
      logger.warn("Invalid parentId format received, ignoring", { parentId, sessionId });
      validatedParentId = null;
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
      if (skipUserMessage && validatedParentId) {
        userMessageId = validatedParentId;
      } else if (req.body.isContinuation) {
        // Find the last assistant message in this session to continue from
        const lastAssistantMsg = (sessionState?.messages || [])
          .filter(m => m.role === 'assistant' && !m.isDeleted && !m.content.startsWith('⚠️'))
          .pop();

        if (lastAssistantMsg) {
          userMessageId = lastAssistantMsg.id;
        } else {
          // Fallback if no assistant message found
          userMessageId = await addMessage(sessionId, "user", message, client, validatedParentId);
        }
      } else {
        userMessageId = await addMessage(sessionId, "user", message, client, validatedParentId);
      }

      // If this is the first user message (and NOT a continuation), generate a short session title
      if (isFirstMessage && !skipUserMessage && !req.body.isContinuation) {
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

    // Reconstruct history starting from the parent of the current turn
    // This turn will be added manually below to ensure it's included even if not in msgMap yet
    let currentId = validatedParentId;

    // BUT if it's a continuation, validatedParentId is the parent of the assistant message.
    // We actually want to reconstruct history INCLUDING the assistant message it self.
    if (req.body.isContinuation) {
      // Find the last assistant message ID we matched earlier
      currentId = userMessageId; // In continuation mode, this is the AI message ID

      while (currentId) {
        const msg = msgMap.get(currentId);
        if (!msg) break;
        if (!msg.isDeleted) {
          history.unshift({ role: msg.role, content: msg.content });
        }
        currentId = msg.parentId;
      }

      // Add continuation prompt
      history.push({
        role: "user",
        content: "Continue your previous response exactly where you left off. Do not repeat what you already said, just continue the content seamlessly."
      });
    } else {
      // Normal or regeneration flow
      while (currentId) {
        const msg = msgMap.get(currentId);
        if (!msg) break;
        if (!msg.isDeleted) {
          history.unshift({ role: msg.role, content: msg.content });
        }
        currentId = msg.parentId;
      }

      // Explicitly push the current message
      if (!skipUserMessage) {
        history.push({ role: "user", content: message });
      }
    }

    /* -----------------------------
       COMMAND PARSING (EXPLICIT MEMORY)
    ----------------------------- */
    // Simple regex to catch "Remember: ..." or "Remember that ..."
    // This allows immediate feedback loop for the user
    if (message.match(/^(?:remember|save)\s+(?:this|that)?(?::\s*)?(.*?)$/i)) {
      try {
        const match = message.match(/^(?:remember|save)\s+(?:this|that)?(?::\s*)?(.*?)$/i);
        if (match && match[1] && match[1].length > 3) {
          const memoryContent = match[1].trim();
          const { addExplicitMemory } = await import("../services/memoryService.js");
          await addExplicitMemory(firebaseUid, memoryContent);

          // Inject acknowledgment into history so AI reacts to it
          // We push it to history array later, but let's signal it here
          history.push({
            role: "system",
            content: `[SYSTEM] User explicitly asked to remember: "${memoryContent}". Confirm to the user that this has been saved to their Global Context.`
          });
          logger.info(`Processed explicit memory command for user ${firebaseUid}`);
        }
      } catch (err) {
        logger.warn("Failed to process explicit memory command", { error: err.message });
      }
    }

    /* -----------------------------
       INJECT PROJECT & GLOBAL CONTEXT
    ----------------------------- */
    const sessionInfo = await getSessionInfo(sessionId);
    let contextMessages = [];
    // Always attempt to build context if we have project OR user info (for Global Context)
    // Even if no project (e.g. global chat), we might want Global Context
    const projectId = sessionInfo?.project_id || null;

    // We modify contextService to handle null projectId if we want Only Global context in future
    // For now, existing logic requires project_id for Project Context, but we passed userId for Global.
    // Let's pass what we have.
    if (projectId || firebaseUid) {
      try {
        // Pass current message for relevance-based context retrieval
        contextMessages = await buildContextMessages(
          projectId, // might be null
          sessionId,
          message,   // Current query
          firebaseUid // Global User ID
        );
        // Prepend context to history
        if (contextMessages.length > 0) {
          logger.info(`[Context Debug] Injecting ${contextMessages.length} context messages`, {
            types: contextMessages.map(m => m.role === 'system' ? 'system (context)' : m.role),
            firstLength: contextMessages[0]?.content?.length
          });
          history.unshift(...contextMessages);
          logger.info(`Injected ${contextMessages.length} context messages for session ${sessionId}`);
        } else {
          logger.info(`[Context Debug] No context messages generated for session ${sessionId}`);
        }
      } catch (err) {
        logger.warn("Failed to build context", { error: err instanceof Error ? err.message : err });
      }
    }

    /* -----------------------------
       PREPARE ASSISTANT MESSAGE RECORD
       We create an empty assistant message early to get its UUID.
       This UUID is streamed immediately to the frontend so it can 
       link local state even if the stream is cut off later.
    ----------------------------- */
    let assistantMessageId;
    if (req.body.isContinuation) {
      // In continuation, we already have the message ID (it's userMessageId from logic above)
      assistantMessageId = userMessageId;
    } else {
      // Create a NEW empty assistant message
      assistantMessageId = await addMessage(sessionId, "assistant", "", pool, userMessageId);
    }

    // STREAM THE ID IMMEDIATELY
    res.write(`data: ${JSON.stringify({ messageId: assistantMessageId })}\n\n`);

    /* -----------------------------
       STREAMING RESPONSE
    ----------------------------- */
    logger.info(`[Chat Debug] Final History sent to LLM: ${history.length} messages`, {
      lastMessage: history[history.length - 1]?.content?.slice(0, 50),
      parentIdUsed: currentId,
      assistantMessageId
    });

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
        res.write(`data: [DONE]\n\n`);
      }

      /* -----------------------------
         POST-STREAM PERSISTENCE
         We await this BEFORE res.end() to guarantee it finishes in Lambda.
      ----------------------------- */
      if (fullAiReply && !isAborted) {
        try {
          // Update the existing assistant message with full content
          await appendMessageContent(assistantMessageId, fullAiReply, pool);

          // Background tasks (truly non-blocking)
          if (sessionInfo?.user_id) {
            setImmediate(async () => {
              try {
                const needsSummary = await sessionNeedsSummary(sessionId);
                if (needsSummary) {
                  await generateSessionSummary(sessionId);
                }
              } catch (err) {
                logger.warn("Summary/Memory extraction failed", { error: err.message });
              }
            });
          }
        } catch (dbErr) {
          logger.error("Failed to persist final AI content", { error: dbErr.message, messageId: assistantMessageId });
        }
      }

      // Finally close the stream
      res.end();

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
