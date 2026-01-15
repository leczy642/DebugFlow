import { pool } from "../postgres_connect.js";
import { v4 as uuid } from "uuid";

/* -----------------------------
   SESSIONS
----------------------------- */

export async function getAllSessions(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, pinned, created_at, updated_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return rows;
  } catch (err) {
    // If columns missing (pinned or user_id), add them and retry
    if (err && err.code === "42703") {
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`);
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)`);

      const { rows } = await pool.query(
        `SELECT id, title, pinned, created_at, updated_at
         FROM sessions
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      );
      return rows;
    }
    throw err;
  }
}

export async function createSession(userId) {
  const id = uuid();
  const title = "New Debug Session";

  try {
    const { rows } = await pool.query(
      `INSERT INTO sessions (id, title, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, pinned, created_at, updated_at`,
      [id, title, userId]
    );
    return rows[0];
  } catch (err) {
    if (err && err.code === "42703") {
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`);
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)`);

      const { rows } = await pool.query(
        `INSERT INTO sessions (id, title, user_id)
         VALUES ($1, $2, $3)
         RETURNING id, title, pinned, created_at, updated_at`,
        [id, title, userId]
      );
      return rows[0];
    }
    throw err;
  }
}

export async function sessionExists(sessionId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM sessions WHERE id = $1`,
    [sessionId]
  );
  return rowCount > 0;
}

export async function getSessionWithMessages(sessionId) {
  try {
    const sessionRes = await pool.query(
      `SELECT id, title, pinned, created_at, updated_at
       FROM sessions
       WHERE id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) return null;

    const messagesRes = await pool.query(
      `SELECT id, role, content, created_at, parent_id as "parentId", is_deleted as "isDeleted"
       FROM messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return {
      ...sessionRes.rows[0],
      messages: messagesRes.rows,
    };
  } catch (err) {
    if (err && err.code === "42703") {
      // Handle potential missing columns (pinned or parent_id)
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`);
      await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id uuid`);

      // Retry the operation
      return getSessionWithMessages(sessionId);
    }
    throw err;
  }
}

export async function renameSession(sessionId, newTitle) {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET title = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, created_at, updated_at`,
    [sessionId, newTitle]
  );

  return rows[0];
}

export async function setSessionPinned(sessionId, pinned) {
  try {
    const { rows } = await pool.query(
      `UPDATE sessions
       SET pinned = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, created_at, updated_at, pinned`,
      [sessionId, pinned]
    );

    return rows[0];
  } catch (err) {
    // If the pinned column doesn't exist, attempt to add it and retry
    // Postgres undefined column error code is 42703
    if (err && err.code === "42703") {
      await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`);
      const { rows } = await pool.query(
        `UPDATE sessions
         SET pinned = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, created_at, updated_at, pinned`,
        [sessionId, pinned]
      );
      return rows[0];
    }
    throw err;
  }
}

export async function deleteSessionById(sessionId) {
  // Remove messages first to avoid FK constraints
  await pool.query(
    `DELETE FROM messages WHERE session_id = $1`,
    [sessionId]
  );

  const { rows } = await pool.query(
    `DELETE FROM sessions WHERE id = $1 RETURNING id`,
    [sessionId]
  );

  return rows[0];
}

/* -----------------------------
   MESSAGES
----------------------------- */

export async function addMessage(
  sessionId,
  role,
  content,
  client = pool,
  parentId = null
) {
  const id = uuid();
  try {
    await client.query(
      `INSERT INTO messages (id, session_id, role, content, parent_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, sessionId, role, content, parentId]
    );
  } catch (err) {
    if (err && err.code === "42703") {
      await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id uuid`);
      await client.query(
        `INSERT INTO messages (id, session_id, role, content, parent_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, sessionId, role, content, parentId]
      );
    } else {
      throw err;
    }
  }

  await client.query(
    `UPDATE sessions
     SET updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );

  return id;
}

export async function deleteMessageById(messageId, userId = null) {
  // Soft delete: set is_deleted = true, deleted_at = NOW(), deleted_by = userId
  const { rowCount } = await pool.query(
    `UPDATE messages 
     SET is_deleted = true, deleted_at = NOW(), deleted_by = $2
     WHERE id = $1`,
    [messageId, userId]
  );
  return rowCount > 0;
}

export async function restoreMessageById(messageId) {
  const { rowCount } = await pool.query(
    `UPDATE messages 
     SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
     WHERE id = $1`,
    [messageId]
  );
  return rowCount > 0;
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
