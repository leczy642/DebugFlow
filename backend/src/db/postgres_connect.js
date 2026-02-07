import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import "../utils/loadEnv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Construct absolute path to cert, assuming certs folder is at backend/certs
const certPath = path.resolve(__dirname, "../../certs/global-bundle.pem");

let sslConfig = false;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.warn("⚠️ Forcing rejectUnauthorized: false for RDS connection to bypass SELF_SIGNED_CERT_IN_CHAIN error.");

  // 1. Force Node.js to ignore self-signed certs globally (Nuclear option)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // 2. Explicitly set SSL config for pg
  sslConfig = {
    rejectUnauthorized: false,
    requestCert: true,
  };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database.");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL client error:", err);
});

//console.log(process.env.DATABASE_URL);