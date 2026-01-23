import { pool } from './postgres_connect.js';

async function migrateUserContext() {
    const client = await pool.connect();

    try {
        console.log('🔄 Starting User Context migration...');

        await client.query('BEGIN');

        // 1. Add global_instructions to users table if missing
        console.log('Checking users table for global_instructions...');
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS global_instructions TEXT DEFAULT NULL
        `);
        console.log('✅ global_instructions column check complete.');

        // 2. Create user_context table
        console.log('Creating user_context table...');

        // Define ENUMs first (optional, or just use CHECK constraints for simplicity)
        // Using TEXT with CHECK constraints is often easier to manage than native ENUMs
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_context (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('EXPLICIT', 'INFERRED', 'PERSONAL_INFO', 'CANDIDATE')),
                status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CANDIDATE', 'ARCHIVED')),
                confidence INTEGER NOT NULL DEFAULT 0,
                last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON user_context(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_context_status ON user_context(status);
        `);
        console.log('✅ user_context table created.');

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
        pool.end();
    }
}

migrateUserContext();
