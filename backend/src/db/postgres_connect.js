import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import "../utils/loadEnv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const certPath = path.resolve(__dirname, "../../certs/global-bundle.pem");

let sslConfig = false;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.log("🔒 Forcing SSL bypass for RDS...");

  // 1. Force Node.js to ignore certificate issues globally
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // 2. Set SSL config for pg
  sslConfig = {
    rejectUnauthorized: false,
  };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  connectionTimeoutMillis: 5000, // Terminate connection attempt after 5 seconds
  idleTimeoutMillis: 30000,      // Close idle clients after 30 seconds
  max: 10                        // Maximum number of clients in the pool
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database.");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL client error:", err);
});

//console.log(process.env.DATABASE_URL);