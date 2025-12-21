import { pool } from "../postgres_connect.js";
import { v4 as uuid } from "uuid";

/* -----------------------------
   SESSIONS
----------------------------- */

export async function getAllSessions() {
  const { rows } = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM sessions
     ORDER BY updated_at DESC`
  );
  return rows;
}

export async function createSession() {
  const id = uuid();
  const title = "New Debug Session";

  const { rows } = await pool.query(
    `INSERT INTO sessions (id, title)
     VALUES ($1, $2)
     RETURNING id, title, created_at, updated_at`,
    [id, title]
  );

  return rows[0];
}

export async function sessionExists(sessionId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM sessions WHERE id = $1`,
    [sessionId]
  );
  return rowCount > 0;
}

export async function getSessionWithMessages(sessionId) {
  const sessionRes = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM sessions
     WHERE id = $1`,
    [sessionId]
  );

  if (sessionRes.rowCount === 0) return null;

  const messagesRes = await pool.query(
    `SELECT role, content, created_at
     FROM messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );

  return {
    ...sessionRes.rows[0],
    messages: messagesRes.rows,
  };
}

/* -----------------------------
   MESSAGES
----------------------------- */

export async function addMessage(
  sessionId,
  role,
  content,
  client = pool
) {
  await client.query(
    `INSERT INTO messages (id, session_id, role, content)
     VALUES ($1, $2, $3, $4)`,
    [uuid(), sessionId, role, content]
  );

  await client.query(
    `UPDATE sessions
     SET updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );
}

/* -----------------------------
   TRANSACTIONS
----------------------------- */

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
