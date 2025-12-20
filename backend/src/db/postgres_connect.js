import pkg from "pg";
const { Pool } = pkg;
import "../utils/loadEnv.js";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database.");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL client error:", err);
});

//console.log(process.env.DATABASE_URL);