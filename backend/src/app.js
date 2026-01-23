/**
 * app.js
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * This file configures and builds the Express application instance.
 * It does NOT start the server. Instead, it prepares middleware, routes,
 * logging, error handling, and all global settings.
 *
 * ROLE IN PROJECT:
 * - Central place to configure the HTTP API layer
 * - Keeps server.js clean (server.js only imports `app` and calls app.listen)
 *
 * WHAT THIS FILE DOES:
 * 1. Loads environment variables
 * 2. Creates the Express app
 * 3. Applies global middleware (CORS, JSON parsing, logging)
 * 4. Defines health check endpoints
 * 5. Attaches API route groups
 * 6. Registers global error handling
 *
 * INPUT:
 * - Incoming HTTP requests
 *
 * OUTPUT:
 * - A fully configured Express application (exported as `app`)
 *   ready to be started by server.js
 * -----------------------------------------------------------------------------
 */


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import authenticateToken from './middleware/auth.js';
import cookieParser from 'cookie-parser';

// setting up Routers
import ingestRouter from './routes/ingest.js';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';
import sessionsRouter from './routes/sessions.js';
import messagesRouter from './routes/messages.js';
import projectsRouter from './routes/projects.js';
import userRouter from './routes/user.js';

// User queries
import { getUserById, createUser, updateUserLogin } from './db/models/user_queries.js';

// Load environment variables
dotenv.config();

// Create Express app
export const app = express();

// Global middleware
app.use(cors({ origin: true }));               // Enable CORS
app.use(express.json({ limit: '10mb' }));      // Parse JSON bodies
app.use(cookieParser());                       // Parse cookies
app.use(requestLogger(logger));             // Optional request logging

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// using the API routes

app.get('/protected', authenticateToken, async (req, res) => {
  try {
    const { uid, email, fullname, email_verified } = req.user;

    // Check if user exists
    let user = await getUserById(uid);

    if (!user) {
      console.log(`Creating new user: ${email}`);

      // Determine auth provider and oauth status
      const provider = req.user.sign_in_provider || 'unknown';
      const isOauth = provider !== 'password' && provider !== 'email';

      // Create new user
      user = await createUser({
        id: uid,
        email: email || "",
        name: fullname || "User",
        email_verified: email_verified || false,
        auth_provider: provider,
        is_oauth_user: isOauth,
        oauth_verified: isOauth // Assuming oauth implies verified for now
      });
    } else {
      // Update last login
      await updateUserLogin(uid);
    }

    res.json({
      message: 'You are authenticated',
      user: req.user,
      dbUser: user
    });
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ error: "Internal server error during user sync" });
  }
});

// using the API routes
app.use('/api/ingest', ingestRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', authenticateToken, chatRouter);
// Mount sessions under /api to match frontend expectations
app.use("/api/sessions", authenticateToken, sessionsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/projects", authenticateToken, projectsRouter);
app.use("/api/user", authenticateToken, userRouter);

// Global error handler (must be last)
app.use(errorHandler(logger));
