// loadEnv.js
// Ensures .env loads correctly no matter where script is executed from.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Resolve *project root* automatically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Go from "src/config" → project root
const ROOT_ENV_PATH = path.resolve(__dirname, "../../.env");

// Load environment variables
dotenv.config({ path: ROOT_ENV_PATH });