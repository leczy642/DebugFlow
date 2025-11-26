import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/index.js';
import { embedLogs } from '../services/embedLogs.js';
import { retrieveSimilarLogs } from '../services/retrieveSimilarLogs.js';
import { analyzeError } from '../services/analyzeError.js';

const router = Router();

const AnalyzeBody = z.object({
  message: z.string(),
  stack: z.string().optional(),
  topK: z.number().int().min(1).max(20).optional(),
  namespace: z.string().optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const { message, stack, topK, namespace } = AnalyzeBody.parse(req.body);
  const [embedding] = await embedLogs([{ message, stack }]);
  const similar = await retrieveSimilarLogs(embedding, { topK: topK || 5, namespace });
  const result = await analyzeError({ message, stack }, similar);
  res.json(result);
}));

export default router;
