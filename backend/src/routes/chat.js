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

import express from 'express';
import { logger } from '../utils/logger.js';
import { chatWithAI } from '../services/chatService.js';
import { normalizeUserQuery } from '../utils/promptValidator.js';
import { retryWithBackoff } from '../utils/retry.js';
import { withTimeout } from '../utils/withTimeout.js';
import { addMessage } from '../db/models/postgres_session_queries.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Load timeout configuration from environment
    const LLM_CHAT_TIMEOUT_MS = Number(process.env.HUGGINGFACE_CHAT_TIMEOUT_MS || 8000);
    
    // Extract message from request body
    const { sessionId, message } = req.body;
    
    // Validate message is a non-empty string
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Invalid parameter: prompt must be a string"
      });
    }
    // Save user message to session if sessionId is provided
      await addMessage(sessionId, 'user', message);
    
    // Normalize and sanitize user query
    // const normalizedMessage = normalizeUserQuery(message);
    
    // // Check if normalization succeeded
    // if (!normalizedMessage.ok) {
    //   logger.warn('Query failed normalization', { message });
    //   return res.status(400).json({ 
    //     success: false, 
    //     error: normalizedMessage.error 
    //   });
    // }
    
    // Call AI service with timeout and retry logic
    // const reply = await withTimeout(
    //   () => retryWithBackoff(() => chatWithAI(normalizedMessage.query)), 
    //   LLM_CHAT_TIMEOUT_MS
    // );

    //Todo:
    //first we analyze the message to see if we can extract any relevant logs
    //then we pass both the message and the relevant logs to the chat model to get a response 

    
    const reply = await withTimeout(
      () => retryWithBackoff(() => chatWithAI(message)), 
      LLM_CHAT_TIMEOUT_MS
    );
    // Save AI reply
    await addMessage(sessionId, "assistant", reply);

    // Return successful response
    return res.status(200).json({
      success: true,
      reply
    });
    
  } catch (error) {
    // Log error and return generic error response
    logger.error('Chat error', { error });
    return res.status(500).json({
      success: false,
      error: "No response from reasoning model"
    });
  }
});

export default router;