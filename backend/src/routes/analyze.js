/**
 * POST /analyze
 *  analyze.js
 * -----------------------------
 * Express route for log analysis
 * 
 * Analyzes log files using AI to find relevant entries and optionally generates an executive summary.
 * 
 * Input (req.body):
 *   - query: string (required) - Search query for log analysis
 *   - topK: number (optional, default: 5) - Number of top similar logs to return
 *   - summary: boolean (optional, default: false) - Whether to generate executive summary
 *   - testMode: boolean (optional, default: false) - Enable console output for testing
 * 
 * Output (res.json):
 *   Success (200): { 
 *     success: true, 
 *     query: string, 
 *     topK: number, 
 *     results: object, 
 *     executiveSummary: string | null 
 *   }
 *   Error (400): { success: false, error: string } - Invalid input
 *   Error (500): { success: false, error: string } - Analysis failed
 */

import express from 'express';
import { LogAnalysisService } from '../services/analyzeError.js';
import { logger } from '../utils/logger.js';
import { normalizeUserQuery } from '../utils/promptValidator.js';

const router = express.Router();

router.post('/', async (req, res) => {
  // Extract and set defaults for request parameters
  const { query, topK = 5, summary = false, testMode = false } = req.body;
  
  // Validate query is a non-empty string
  if (!query || typeof query !== 'string') {
    logger.warn('Invalid query received', { body: req.body });
    return res.status(400).json({ success: false, error: 'Query must be a non-empty string' });
  }
  
  // Normalize and sanitize user query
  const normalizedQuery = normalizeUserQuery(query);
  
  // Check if normalization succeeded
  if (!normalizedQuery.ok) {
    logger.warn('Query failed normalization', { query });
    return res.status(400).json({ success: false, error: normalizedQuery.error });
  }
  
  // Initialize log analysis service
  const analysisService = new LogAnalysisService();
  
  try {
    // Perform AI-powered log analysis
    const results = await analysisService.analyzeLogsWithLLM(normalizedQuery.query, topK);
    
    let executiveSummary = null;
    
    // Generate executive summary if requested
    if (summary) {
      executiveSummary = await analysisService.generateExecutiveSummary(results);
    }
    
    // Output to console if in test mode, otherwise log normally
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
    
    // Return successful response with analysis results
    res.json({
      success: true,
      query: normalizedQuery.query,
      topK,
      results,
      executiveSummary
    });
    
  } catch (error) {
    // Log error and return generic error response
    logger.error('Error during log analysis', { error: error.message, query });
    res.status(500).json({ success: false, error: 'Internal server error during log analysis' });
  }
});

export default router;