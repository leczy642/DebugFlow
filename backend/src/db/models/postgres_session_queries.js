import { pool } from "../postgres_connect.js";
import { v4 as uuid } from "uuid";

export async function getAllSessions() {
//   const res = await pool.query("SELECT * FROM sessions ORDER BY created_at DESC");
//   return res.rows;
  const { rows } = await pool.query(
    `SELECT * FROM sessions ORDER BY updated_at DESC`);
    return rows;

}

export async function createSession() {
  const id = uuid();
  const title = "New Debug Session";

  const { rows } = await pool.query(
    `INSERT INTO sessions (id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [id, title]
  );

  return rows[0];
}


export async function getSessionWithMessages(sessionId) {
  const session = await pool.query(
    `SELECT * FROM sessions WHERE id = $1`,
    [sessionId]
  );

  const messages = await pool.query(
    `SELECT role, content
     FROM messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );

  return {
    ...session.rows[0],
    messages: messages.rows,
  };
}

export async function addMessage(sessionId, role, content) {
  await pool.query(
    `INSERT INTO messages (id, session_id, role, content)
     VALUES ($1, $2, $3, $4)`,
    [uuid(), sessionId, role, content]
  );

  await pool.query(
    `UPDATE sessions SET updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}