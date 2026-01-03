import { pool } from "./postgres_connect.js";

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log("Starting migration: Add soft delete columns to messages table...");

        await client.query("BEGIN");

        // Add is_deleted column
        await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
    `);
        console.log("Added is_deleted column.");

        // Add deleted_at column
        await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `);
        console.log("Added deleted_at column.");

        // Add deleted_by column
        // Note: Since we don't have a users table yet, this will just be a UUID or string for now, nullable.
        await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255)
    `);
        console.log("Added deleted_by column.");

        await client.query("COMMIT");
        console.log("Migration completed successfully.");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Migration failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
