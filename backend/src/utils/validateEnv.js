import { logger } from "../logger.js";

export function validateEnv() {
  // List of required environment variables (duplicates removed)
  const requiredVars = [
    "HUGGINGFACE_API_KEY",
    "OPENAI_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "PINECONE_ENV"
  ];

  // Collect any missing variables
  const missing = requiredVars.filter((variable) => !process.env[variable]);

  if (missing.length > 0) {
    logger.error("Missing required environment variables", { missing });
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  logger.info("All required environment variables are set");
}
