/**
 * analyze.js
 * -----------------------------
 * Express route for log analysis
 */

import express from 'express';
import { LogAnalysisService } from '../services/analyzeError.js';
import { logger } from '../utils/logger.js';
import { normalizeUserQuery } from '../utils/promptValidator.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { query, topK = 5, summary = false, testMode = false } = req.body;

  if (!query || typeof query !== 'string') {
    logger.warn('Invalid query received', { body: req.body });
    return res.status(400).json({ success: false, error: 'Query must be a non-empty string' });
  }

  const normalizedQuery = normalizeUserQuery(query);

  if (!normalizedQuery.ok) {
    logger.warn('Query failed normalization', { query });
    return res.status(400).json({ success: false, error: normalizedQuery.error }); // <-- FIXED
  }

  const analysisService = new LogAnalysisService();

  try {
    const results = await analysisService.analyzeLogsWithLLM(normalizedQuery.query, topK);

    let executiveSummary = null;
    if (summary) {
      executiveSummary = await analysisService.generateExecutiveSummary(results);
    }

    if (testMode) {
      console.log('🔍 Test Mode Output:', results);
      if (summary) console.log('💼 Executive Summary:', executiveSummary);
    } else {
      logger.info('Log analysis completed', {
        query,
        topK,
        model: results.model,
        similarLogsCount: results.similarLogs.length
      });
      if (summary) logger.info('Executive summary generated');
    }

    res.json({
      success: true,
      query: normalizedQuery.query,
      topK,
      results,
      executiveSummary
    });

  } catch (error) {
    logger.error('Error during log analysis', { error: error.message, query });
    res.status(500).json({ success: false, error: 'Internal server error during log analysis' });
  }
});

export default router;
