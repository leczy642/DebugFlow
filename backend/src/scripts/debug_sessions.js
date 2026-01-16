
import { pool } from '../db/postgres_connect.js';

async function checkSessions() {
    try {
        console.log("Checking sessions table schema and data...");

        // Check columns
        const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions';
    `);
        console.log("Columns:", columnsRes.rows.map(r => `${r.column_name} (${r.data_type})`));

        // Check data
        const res = await pool.query(`
      SELECT id, title, pinned, created_at, updated_at 
      FROM sessions 
      ORDER BY pinned DESC, updated_at DESC 
      LIMIT 10
    `);

        console.log("Top 10 sessions (sorted by query):");
        res.rows.forEach(r => {
            console.log(`[${r.pinned ? 'PINNED' : 'unpinned'}] ${r.title} (updated: ${r.updated_at}) ID: ${r.id}`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

checkSessions();
