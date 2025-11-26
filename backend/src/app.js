import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import ingestRouter from './routes/ingest.js';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger(logger));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/ingest', ingestRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);

// Error handler must be last
app.use(errorHandler(logger));
