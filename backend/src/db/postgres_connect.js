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
  try {
    const cert = fs.readFileSync(certPath);
    sslConfig = {
      rejectUnauthorized: true,
      ca: cert,
    };
  } catch (err) {
    console.error("⚠️ Failed to load SSL certificate for RDS:", err.message);
    // Fallback to old behavior if file reading fails
    sslConfig = { rejectUnauthorized: false };
  }
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