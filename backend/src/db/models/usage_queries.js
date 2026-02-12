import { pool } from "../postgres_connect.js";

/**
 * Ensures the usage_logs table exists.
 */
export async function ensureUsageLogsTableExists() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usage_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                email VARCHAR(255),
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                status_code INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Verified 'usage_logs' table exists.");
    } catch (err) {
        console.error("❌ Failed to ensure usage_logs table:", err);
    }
}

/**
 * Logs an API request for usage monitoring.
 */
export async function logUsage(userId, email, endpoint, method, statusCode) {
    try {
        await pool.query(
            `INSERT INTO usage_logs (user_id, email, endpoint, method, status_code, timestamp) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [userId, email, endpoint, method, statusCode]
        );
    } catch (err) {
        console.error("❌ Failed to log usage:", err);
    }
}

/**
 * Gets top users by their daily request count.
 * @param {number} limit 
 */
export async function getTopUsersByUsage(limit = 10) {
    const { rows } = await pool.query(
        `SELECT id, email, name, tier, daily_requests_count, last_request_at, rate_limit_reset_at 
         FROM users 
         ORDER BY daily_requests_count DESC 
         LIMIT $1`,
        [limit]
    );
    return rows;
}

/**
 * Gets summary statistics for API usage.
 */
export async function getUsageStatSummary() {
    // Total requests in the last 24 hours
    const totalRequests24h = await pool.query(
        "SELECT COUNT(*) FROM usage_logs WHERE timestamp > NOW() - INTERVAL '24 hours'"
    );

    // Total blocked requests (429) in the last 24 hours
    const blockedRequests24h = await pool.query(
        "SELECT COUNT(*) FROM usage_logs WHERE status_code = 429 AND timestamp > NOW() - INTERVAL '24 hours'"
    );

    // Most active endpoint in the last 24 hours
    const topEndpoint = await pool.query(
        `SELECT endpoint, COUNT(*) as count 
         FROM usage_logs 
         WHERE timestamp > NOW() - INTERVAL '24 hours'
         GROUP BY endpoint 
         ORDER BY count DESC 
         LIMIT 1`
    );

    return {
        total_requests_24h: parseInt(totalRequests24h.rows[0].count),
        blocked_requests_24h: parseInt(blockedRequests24h.rows[0].count),
        top_endpoint: topEndpoint.rows[0] || null
    };
}
