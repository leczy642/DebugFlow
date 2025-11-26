# Architecture

## Overview
The system implements a RAG pipeline for debugging:
1. Ingest logs/stack traces and metadata
2. Embed logs with an embedding model (OpenAI or compatible)
3. Store vectors in a vector database (Pinecone or pgvector)
4. Retrieve semantically similar logs for a given query/error
5. Compose a context window and prompt an LLM for analysis
6. Return root cause hypotheses, runbooks, and suggested fixes

## Tech Stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, React Query
- Backend: Node.js, Express, Axios, Zod, Pino
- LLM/Embeddings: OpenAI compatible API
- Vector DB: Pinecone or PostgreSQL with pgvector

## Security & Ops
- Input validation on all endpoints
- Centralized error handling
- Health checks and structured logs
- Environment-driven configuration
