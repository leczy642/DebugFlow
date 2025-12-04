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

// Routers
import ingestRouter from './routes/ingest.js';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';

// Load environment variables
dotenv.config();

// Create Express app
export const app = express();

// Global middleware
app.use(cors({ origin: true }));               // Enable CORS
app.use(express.json({ limit: '10mb' }));      // Parse JSON bodies
// app.use(requestLogger(logger));             // Optional request logging

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
// app.use('/api/ingest', ingestRouter);
app.use('/api/analyze', analyzeRouter);
// app.use('/api/chat', chatRouter);

// Global error handler (must be last)
app.use(errorHandler(logger));
