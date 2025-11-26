# debugFlow

An AI-powered debugging assistant that uses Retrieval-Augmented Generation (RAG) to analyze logs, stack traces, and source code context to accelerate root-cause analysis and remediation.

## Key Capabilities
- Ingest application logs, stack traces, and contextual metadata
- Generate embeddings and index logs for fast vector similarity search
- Retrieve similar incidents and known fixes
- Perform LLM-based analysis to summarize issues and infer likely root causes
- Conversational debugging: iterative Q&A with context-grounded answers

## Architecture Overview
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS + React Query
- Backend: Node.js (Express) API with routes for ingest, analyze, and chat
- RAG: Embedding service (OpenAI or compatible) + Vector DB (Pinecone or pgvector)
- Observability: Health endpoint, structured logging, error handling middleware
- CI/CD: GitHub Actions for install, lint, build
- Containerization: Dockerfiles per service and docker-compose for local orchestration

## Monorepo Layout
- frontend/ — Next.js app
- backend/ — Express API service
- data/ — Sample logs for local testing
- docs/ — Architecture and API documentation

## Getting Started
1. Copy `.env.example` to `.env` in backend and populate values.
2. Install dependencies:
   - Root: `npm install`
   - Frontend: `npm --workspace frontend install`
   - Backend: `npm --workspace backend install`
3. Run development:
   - Root: `npm run dev` (runs frontend and backend concurrently)
4. Build:
   - Root: `npm run build`

## Security Notes
- Never commit `.env` files.
- API keys are required for embeddings and LLM calls.
- CORS whitelist should be configured for production deployments.

## License
MIT
