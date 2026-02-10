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
import adminRouter from './routes/admin.js';
import superUserRouter from './routes/superUser.js';

// User queries
import { ensureUsersTableExists } from './db/models/user_queries.js';
import { pool } from './db/postgres_connect.js';

// Load environment variables
dotenv.config();

// Ensure database tables exist
ensureUsersTableExists().catch(err => {
  logger.error("Database initialization failed", { error: err.message });
});

// Create Express app
export const app = express();

// CORS configuration - must be before other middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://debug-flow-frontend.vercel.app',
  'https://debugflow.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Also allow any vercel preview deployments
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Handle preflight requests explicitly for all routes
app.options('*', cors());

// Global middleware
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

// Database Debug Route (Unauthenticated for diagnostics)
app.get('/debug-db', async (req, res) => {
  const start = Date.now();
  try {
    const { rows } = await pool.query('SELECT NOW() as now, version()');
    res.json({
      success: true,
      message: "Database is reachable!",
      time_on_db: rows[0].now,
      version: rows[0].version,
      latency: `${Date.now() - start}ms`,
      env_db_set: !!process.env.DATABASE_URL,
      db_is_localhost: process.env.DATABASE_URL?.includes('localhost')
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: err.message,
      code: err.code,
      latency: `${Date.now() - start}ms`,
      env_db_set: !!process.env.DATABASE_URL,
    });
  }
});

// Internet Debug Route (Unauthenticated for diagnostics)
app.get('/debug-internet', async (req, res) => {
  const start = Date.now();
  try {
    const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    const data = await response.json();
    res.json({
      success: true,
      message: "Internet is reachable!",
      keys_count: Object.keys(data).length,
      latency: `${Date.now() - start}ms`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internet access failed",
      error: err.message,
      latency: `${Date.now() - start}ms`
    });
  }
});

// using the API routes

app.get('/protected', authenticateToken, async (req, res) => {
  res.json({
    message: 'You are authenticated',
    user: req.user
  });
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
app.use("/api/admin", authenticateToken, adminRouter);
app.use("/api/super-user", authenticateToken, superUserRouter);

// Global error handler (must be last)
app.use(errorHandler(logger));
