# API Specification

Base URL: `/api`

## Health
- GET `/health`
  - 200 OK: `{ status: 'ok', uptime, timestamp }`

## Ingest Logs
- POST `/api/ingest`
  - body: `{ logs: Array<{ id?: string, timestamp: string, severity: string, service?: string, message: string, stack?: string, context?: object }>, namespace?: string }`
  - 200 OK: `{ ingested: number }`

## Analyze Error
- POST `/api/analyze`
  - body: `{ message: string, stack?: string, topK?: number }`
  - 200 OK: `{ summary: string, rootCauses: string[], similar: any[] }`

## Chat
- POST `/api/chat`
  - body: `{ message: string, context?: object }`
  - 200 OK: `{ reply: string, citations?: any[] }`
