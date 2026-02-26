import { pool } from "./postgres_connect.js";

async function setupProductionDB() {
  console.log("🚀 Starting Production Database Initialization...");

  try {
    // 1. USERS Table
    console.log("Creating users table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            email_verified BOOLEAN DEFAULT FALSE,
            auth_provider VARCHAR(50) DEFAULT 'email',
            is_oauth_user BOOLEAN DEFAULT FALSE,
            oauth_verified BOOLEAN DEFAULT FALSE,
            global_instructions TEXT,
            role VARCHAR(20) DEFAULT 'user',
            status VARCHAR(20) DEFAULT 'active',
            permissions JSONB DEFAULT '{}',
            suggested_role VARCHAR(20),
            suggestion_reason TEXT,
            block_expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP
          );
        `);

    // 2. PROJECTS Table
    console.log("Creating projects table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            context_instructions TEXT,
            context_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);

    // 3. SESSIONS Table
    console.log("Creating sessions table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL REFERENCES users(id),
            project_id UUID REFERENCES projects(id),
            title TEXT DEFAULT 'New Debug Session',
            pinned BOOLEAN DEFAULT FALSE,
            context_summary TEXT,
            summary_updated_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);

    // 4. MESSAGES Table
    console.log("Creating messages table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES sessions(id),
            role VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            parent_id UUID,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP,
            deleted_by VARCHAR(255),
            sources JSONB,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);

    // 5. AUDIT LOGS Table
    console.log("Creating audit_logs table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            actor_id VARCHAR(255) REFERENCES users(id),
            target_id VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            details JSONB,
            timestamp TIMESTAMP DEFAULT NOW()
          );
        `);

    // 6. GLOBAL SETTINGS Table
    console.log("Creating global_settings table...");
    await pool.query(`
          CREATE TABLE IF NOT EXISTS global_settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);

    // Indexes
    console.log("Creating indexes...");
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`);

    console.log("✅ Production Database Setup Complete!");

  } catch (err) {
    console.error("❌ Setup failed:", err);
  } finally {
    await pool.end();
  }
}

setupProductionDB();
