import { app } from './app.js';
import { pool } from './db/postgres_connect.js';
import { ensureUsersTableExists } from './db/models/user_queries.js';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Ensure DB connection
    const client = await pool.connect();
    client.release();
    console.log("✅ Database connection verified");

    // Ensure tables exist
    await ensureUsersTableExists();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
