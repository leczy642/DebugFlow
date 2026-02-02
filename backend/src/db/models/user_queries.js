import { pool } from "../postgres_connect.js";

/* -----------------------------
   USERS
----------------------------- */

/**
 * Ensures the users table exists.
 */
export async function ensureUsersTableExists() {
    console.log("🚀 Starting database initialization...");
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY, -- Firebase UID
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        auth_provider VARCHAR(50) DEFAULT 'email',
        is_oauth_user BOOLEAN DEFAULT FALSE,
        oauth_verified BOOLEAN DEFAULT FALSE,
        global_instructions TEXT,
        role VARCHAR(20) DEFAULT 'user', -- super_user, admin, user
        status VARCHAR(20) DEFAULT 'active', -- active, blocked, banned
        permissions JSONB DEFAULT '{}',
        suggested_role VARCHAR(20),
        suggestion_reason TEXT,
        block_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      );
    `);

        // Migration: check for new columns and add them if missing
        const alterQueries = [
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email'`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_verified BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS global_instructions TEXT`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS suggested_role VARCHAR(20)`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS suggestion_reason TEXT`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS block_expires_at TIMESTAMP`
        ];

        for (const query of alterQueries) {
            await pool.query(query);
        }

        // Create audit_logs table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            actor_id VARCHAR(255) REFERENCES users(id),
            target_id VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            details JSONB,
            timestamp TIMESTAMP DEFAULT NOW()
          );
        `);

        // Create global_settings table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS global_settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
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

        console.log("✅ Verified 'users' table exists and has correct columns.");
    } catch (err) {
        console.error("❌ Failed to ensure database tables:", err);
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
export async function createUser({ id, email, name, email_verified, auth_provider, is_oauth_user, oauth_verified }) {
    const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, email_verified, auth_provider, is_oauth_user, oauth_verified, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
        [id, email, name, email_verified, auth_provider || 'email', is_oauth_user || false, oauth_verified || false]
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

/**
 * Updates a user's role.
 */
export async function updateUserRole(uid, role) {
    const { rows } = await pool.query(
        `UPDATE users SET role = $1, suggested_role = NULL, suggestion_reason = NULL WHERE id = $2 RETURNING *`,
        [role, uid]
    );
    return rows[0];
}

/**
 * Updates a user's status.
 */
export async function updateUserStatus(uid, status) {
    const { rows } = await pool.query(
        `UPDATE users SET status = $1 WHERE id = $2 RETURNING *`,
        [status, uid]
    );
    return rows[0];
}

/**
 * Updates a user's block status and expiration.
 */
export async function updateUserBlock(uid, status, expiresAt) {
    const { rows } = await pool.query(
        `UPDATE users SET status = $1, block_expires_at = $2 WHERE id = $3 RETURNING *`,
        [status, expiresAt, uid]
    );
    return rows[0];
}

/**
 * Sets a role suggestion for a user.
 */
export async function setUserSuggestion(uid, role, reason) {
    const { rows } = await pool.query(
        `UPDATE users SET suggested_role = $1, suggestion_reason = $2 WHERE id = $3 RETURNING *`,
        [role, reason, uid]
    );
    return rows[0];
}

/**
 * Updates user permissions.
 */
export async function updateUserPermissions(uid, permissions) {
    const { rows } = await pool.query(
        `UPDATE users SET permissions = $1 WHERE id = $2 RETURNING *`,
        [JSON.stringify(permissions), uid]
    );
    return rows[0];
}

/**
 * Logs an administrative action.
 */
export async function logAuditEvent(actorId, targetId, action, details) {
    await pool.query(
        `INSERT INTO audit_logs (actor_id, target_id, action, details) VALUES ($1, $2, $3, $4)`,
        [actorId, targetId, action, JSON.stringify(details)]
    );
}

/**
 * Transfers super user role from one user to another.
 * This should be done inside a transaction in the service layer if possible,
 * but here we provide the individual atomic updates.
 */
export async function transferSuperUser(oldUid, newUid) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [oldUid]);
        await client.query(`UPDATE users SET role = 'super_user' WHERE id = $2`, [newUid]);
        // Also clear the pending transfer flag as part of the atomic transaction
        await client.query(`DELETE FROM global_settings WHERE key = 'pending_super_user_transfer'`);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Gets all admins.
 */
export async function getAdmins() {
    const { rows } = await pool.query(
        `SELECT id, email, name, role, status FROM users WHERE role = 'admin' OR role = 'super_user' ORDER BY role DESC`
    );
    return rows;
}

/**
 * Gets all pending admin promotion requests.
 */
export async function getPromotionRequests() {
    const { rows } = await pool.query(
        `SELECT id, email, name, role, status, suggested_role, suggestion_reason, created_at 
         FROM users 
         WHERE suggested_role = 'admin' 
         ORDER BY created_at DESC`
    );
    return rows;
}

/**
 * Gets a global setting.
 */
export async function getGlobalSetting(key) {
    const { rows } = await pool.query(
        `SELECT value FROM global_settings WHERE key = $1`,
        [key]
    );
    return rows[0]?.value || null;
}

/**
 * Checks if a global setting key is protected (Super User only).
 */
export function isKeyProtected(key) {
    const protectedKeys = ['super_global_context', 'pending_super_user_transfer'];
    return protectedKeys.includes(key);
}

/**
 * Updates a global setting.
 * Hardened to prevent unauthorized updates to protected keys.
 */
export async function updateGlobalSetting(key, value, actorRole = 'user') {
    if (isKeyProtected(key) && actorRole !== 'super_user') {
        throw new Error(`Unauthorized: Role '${actorRole}' is not allowed to modify protected key '${key}'`);
    }

    await pool.query(
        `INSERT INTO global_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
    );
}
