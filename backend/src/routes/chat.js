import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/index.js';
import { analyzeError } from '../services/analyzeError.js';

const router = Router();

const ChatBody = z.object({
  message: z.string(),
  context: z.record(z.any()).optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const { message } = ChatBody.parse(req.body);
  // For MVP, call analyze pipeline with the message only
  const result = await analyzeError({ message }, []);
  res.json({ reply: result.summary, citations: result.similar });
}));

export default router;
