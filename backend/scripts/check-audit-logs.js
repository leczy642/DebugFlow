import { pool } from "../src/db/postgres_connect.js";

async function checkLogs() {
    try {
        const { rows } = await pool.query(`
            SELECT a.actor_id, u.email as actor_email, a.target_id, a.action, a.details, a.timestamp 
            FROM audit_logs a
            JOIN users u ON a.actor_id = u.id
            ORDER BY a.timestamp DESC 
            LIMIT 5
        `);
        console.table(rows);
    } catch (err) {
        console.error("Error querying database:", err);
    } finally {
        await pool.end();
    }
}

checkLogs();
