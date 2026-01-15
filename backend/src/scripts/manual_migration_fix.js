import { pool } from "../db/postgres_connect.js";

async function fixSchema() {
    try {
        console.log("Starting manual schema fix...");

        // 1. Add columns if they don't exist
        const alterQueries = [
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email'`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_verified BOOLEAN DEFAULT FALSE`
        ];

        for (const query of alterQueries) {
            console.log(`Executing: ${query}`);
            await pool.query(query);
        }

        console.log("✅ Schema update queries executed.");

        // 2. Verify columns exist
        const { rows } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);

        console.log("Current columns in 'users' table:");
        rows.forEach(row => console.log(` - ${row.column_name} (${row.data_type})`));

        // 3. Renaming check
        try {
            await pool.query(`
        DO $$
        BEGIN
          IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
            ALTER TABLE users RENAME COLUMN full_name TO name;
          END IF;
        END $$;
      `);
            console.log("✅ Renaming check executed.");
        } catch (e) {
            console.warn("Migration check for full_name -> name failed:", e.message);
        }

    } catch (err) {
        console.error("❌ Schema fix failed:", err);
    } finally {
        await pool.end();
    }
}

fixSchema();
