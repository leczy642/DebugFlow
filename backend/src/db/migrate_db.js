import { pool } from "./postgres_connect.js";

async function migrate() {
    console.log("Starting migration...");
    try {
        // Add parent_id to messages
        console.log("Adding parent_id to messages table...");
        await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id uuid`);
        console.log("✅ parent_id column added (or already exists).");

        // Add pinned to sessions (just in case)
        console.log("Adding pinned to sessions table...");
        await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`);
        console.log("✅ pinned column added (or already exists).");

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
