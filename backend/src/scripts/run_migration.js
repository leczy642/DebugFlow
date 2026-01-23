
import { ensureUsersTableExists } from "../db/models/user_queries.js";
import { pool } from "../db/postgres_connect.js";

async function run() {
    console.log("Running migration...");
    await ensureUsersTableExists();
    console.log("Migration complete.");
    await pool.end();
}

run();
