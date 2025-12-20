import { Router } from "express";
import { embedLogsCohere } from "../services/embedLogsCohere.js";
import { getPineconeIndex } from "../db/pinecone_connect.js";
import { Claude } from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
const claude = new Claude({ apiKey: process.env.CLAUDE_API_KEY });

router.post("/", async (req, res) => {
  try {
    const query = req.body.query;
    const topK = req.body.topK || 5;
    const namespace = req.body.namespace || "default";

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    // 1️⃣ Generate embedding for query using Cohere
    const queryVector = (await embedLogsCohere([{ message: query }]))[0];

    // 2️⃣ Retrieve top-K similar logs from Pinecone
    const index = getPineconeIndex();
    const pineconeResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      namespace,
    });

    const retrievedLogs = pineconeResponse.matches.map(
      (match) => match.metadata.message
    );

    if (!retrievedLogs.length) {
      return res.json({
        logs: [],
        answer: "No relevant logs found.",
      });
    }

    // 3️⃣ Generate reasoning with Claude 3
    const prompt = `
You are a developer assistant.
Analyze the following logs and provide a root cause or key insights:

${retrievedLogs.join("\n")}
`;

    const claudeResponse = await claude.generate({
      model: "claude-3",
      prompt,
      max_tokens_to_sample: 500,
    });

    res.json({
      logs: retrievedLogs,
      answer: claudeResponse.completion,
    });
  } catch (err) {
    console.error("Error in /search:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
