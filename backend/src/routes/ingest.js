import { Router } from "express";
import { z } from "zod";
import { embedLogsCohere } from "../services/embedLogsCohere.js";
import { getPineconeIndex } from "../db/connect.js";

const router = Router();

// Schema validation for logs
const LogSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string().optional(),
  severity: z.string().optional(),
  service: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
  context: z.record(z.any()).optional(),
});

router.post("/", async (req, res) => {
  try {
    const logs = req.body.logs;
    const namespace = req.body.namespace || "default";

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: "logs array is required" });
    }

    // 1️⃣ Generate embeddings with Cohere
    let embeddingsArray;
    try {
      embeddingsArray = await embedLogsCohere(logs);
    } catch (err) {
      console.error("Embedding generation failed:", err);
      return res.status(400).json({ 
        error: err.message || "Failed to generate embeddings",
        details: "Check that COHERE_API_KEY is set and valid, and that logs have 'message' or 'content' fields"
      });
    }

    if (!embeddingsArray || embeddingsArray.length === 0) {
      return res.status(400).json({ 
        error: "No vectors generated from logs",
        details: "Ensure logs have 'message' or 'content' fields and COHERE_API_KEY is valid"
      });
    }

    // 2️⃣ Prepare vectors for Pinecone
    const vectors = embeddingsArray.map((vector, i) => ({
      id: logs[i].id || `log-${Date.now()}-${i}`,
      values: vector,
      metadata: {
        message: logs[i].message,
        stack: logs[i].stack || "",
        service: logs[i].service || "unknown",
        severity: logs[i].severity || "INFO",
        timestamp: logs[i].timestamp || new Date().toISOString(),
        context: logs[i].context || {},
      },
    }));

    // 3️⃣ Upsert vectors into Pinecone
    const index = getPineconeIndex();
    await index.upsert({ vectors, namespace });

    res.json({ ingested: vectors.length });
  } catch (err) {
    console.error("Error ingesting logs:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
