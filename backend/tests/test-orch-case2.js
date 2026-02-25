// tests/test-orch-case2.js
import { streamChatWithAI } from "../src/services/chatService.js";
import { updateGlobalSetting } from "../src/db/models/user_queries.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function testOrchCase2() {
    console.log("\n🚀 Testing Orchestration Case 2: Admin Toggle OFF");

    try {
        // 1. Manually set toggle to 'false' in DB
        console.log("Setting web_search_enabled = 'false' in DB...");
        await updateGlobalSetting("web_search_enabled", "false", "super_user");

        const prompt = "What is the latest stable version of React?";
        const messages = [{ role: "user", content: prompt }];

        console.log("Starting chat stream...");
        const stream = streamChatWithAI(messages);

        let searchSignalDetected = false;
        let anyContent = false;

        // Monitor internal logs
        const originalLog = console.log;
        let fastPassTriggered = false;
        console.log = (...args) => {
            if (args[0] && typeof args[0] === 'string') {
                if (args[0].includes("⚡ Fast search decision")) fastPassTriggered = true;
            }
            originalLog(...args);
        };

        for await (const chunk of stream) {
            if (chunk.isSearching) {
                searchSignalDetected = true;
            }
            if (chunk.choices?.[0]?.delta?.content) {
                anyContent = true;
            }
        }

        console.log = originalLog;

        console.log("\n--- Verification ---");
        console.log(`Fast Pass Triggered: ${fastPassTriggered ? "❌ YES (FAILURE)" : "✅ NO (SUCCESS)"}`);
        console.log(`Search Signal Detected: ${searchSignalDetected ? "❌ YES (FAILURE)" : "✅ NO (SUCCESS)"}`);
        console.log(`Response Received: ${anyContent ? "✅ YES" : "❌ NO"}`);

        if (!fastPassTriggered && !searchSignalDetected && anyContent) {
            console.log("Verdict: Case 2 PASSED. Admin toggle successfully bypassed search logic.");
        } else {
            console.log("Verdict: Case 2 FAILED.");
        }

        // 2. Cleanup: Set back to 'true'
        console.log("\nRestoring web_search_enabled = 'true'...");
        await updateGlobalSetting("web_search_enabled", "true", "super_user");

    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
    } finally {
        process.exit(0);
    }
}

testOrchCase2();
