/**
 * Migration: Add Project Context Support
 * 
 * Adds columns to support project-level context management:
 * - sessions.context_summary: Auto-generated summary of session conversation
 * - sessions.summary_updated_at: When the summary was last generated
 * - projects.context_instructions: User-defined project instructions
 * - projects.context_enabled: Toggle for project context (default: true)
 */

import { pool } from "./postgres_connect.js";

async function migrateProjectContext() {
    console.log("Starting migration for project context...");
    try {
        // Add context_summary to sessions
        console.log("Adding context_summary to sessions table...");
        await pool.query(`
            ALTER TABLE sessions 
            ADD COLUMN IF NOT EXISTS context_summary TEXT,
            ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMP
        `);
        console.log("✅ context_summary and summary_updated_at columns added to sessions.");

        // Add context fields to projects
        console.log("Adding context fields to projects table...");
        await pool.query(`
            ALTER TABLE projects 
            ADD COLUMN IF NOT EXISTS context_instructions TEXT,
            ADD COLUMN IF NOT EXISTS context_enabled BOOLEAN DEFAULT true
        `);
        console.log("✅ context_instructions and context_enabled columns added to projects.");

        console.log("\n✅ Migration complete!");

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrateProjectContext();
