import { pool } from "../postgres_connect.js";

/* -----------------------------
   USERS
----------------------------- */

/**
 * Ensures the users table exists.
 */
export async function ensureUsersTableExists() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY, -- Firebase UID
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      );
    `);

        // Migration: Check if full_name exists and rename it to name
        try {
            await pool.query(`
        DO $$
        BEGIN
          IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
            ALTER TABLE users RENAME COLUMN full_name TO name;
          END IF;
        END $$;
      `);
        } catch (e) {
            console.warn("Migration check for full_name -> name failed (might be benign):", e.message);
        }

        console.log("✅ Verified 'users' table exists.");
    } catch (err) {
        console.error("❌ Failed to ensure 'users' table:", err);
    }
}

/**
 * Gets a user by their Firebase UID.
 * @param {string} uid 
 * @returns {Promise<object|null>} The user object or null if not found.
 */
export async function getUserById(uid) {
    const { rows } = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [uid]
    );
    return rows[0] || null;
}

/**
 * Creates a new user in the database.
 * @param {object} userData 
 * @returns {Promise<object>} The created user.
 */
export async function createUser({ id, email, name, email_verified }) {
    const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, email_verified, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
        [id, email, name, email_verified]
    );
    return rows[0];
}

/**
 * Updates the last_login timestamp for a user.
 * @param {string} uid 
 */
export async function updateUserLogin(uid) {
    await pool.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [uid]
    );
}
