
import { pool } from "./postgres_connect.js";

async function migrateProjects() {
    console.log("Starting migration for projects...");
    try {
        // Create projects table
        console.log("Creating projects table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id uuid PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        `);
        console.log("✅ projects table created.");

        // Add index on user_id for projects
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);

        // Add project_id to sessions
        console.log("Adding project_id to sessions table...");
        await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS project_id uuid`);
        console.log("✅ project_id column added to sessions.");

        // Add foreign key constraint (optional but good practice, though soft delete makes strict FK tricky sometimes, stick to simple ID for now or loose FK)
        // Let's add a loose relationship or simple column. Strict FK might fail if we delete project but keep sessions (moved to root).
        // For now, simple column is fine.

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrateProjects();
