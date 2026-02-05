import { pool } from "./postgres_connect.js";

async function listTables() {
    console.log("🔍 Fetching database tables...");

    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        if (res.rows.length === 0) {
            console.log("📭 No tables found in the 'public' schema.");
        } else {
            console.log("📋 Found the following tables:");
            res.rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.table_name}`);
            });
        }
    } catch (err) {
        console.error("❌ Error listing tables:", err);
    } finally {
        await pool.end();
    }
}

listTables();
