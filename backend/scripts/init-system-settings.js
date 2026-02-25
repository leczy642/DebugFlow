// scripts/init-system-settings.js
import { updateGlobalSetting } from "../src/db/models/user_queries.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function initSettings() {
    console.log("🚀 Initializing system settings...");
    try {
        // Default search to enabled (The "TV plugged in" state)
        await updateGlobalSetting("web_search_enabled", "true", "super_user");
        console.log("✅ web_search_enabled set to 'true'");
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to initialize settings:", err.message);
        process.exit(1);
    }
}

initSettings();
