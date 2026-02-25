// tests/test-search-restriction.js
import { streamChatWithAI } from "../src/services/chatService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function testRestriction(prompt, description) {
    console.log(`\n\n--- Testing: ${description} ---`);
    console.log(`Prompt: "${prompt}"`);

    const messages = [{ role: "user", content: prompt }];

    try {
        const stream = streamChatWithAI(messages);
        let fullContent = "";
        let searchTriggered = false;

        // Use a custom console logger to detect our internal logs
        const originalLog = console.log;
        console.log = (...args) => {
            if (args[0] && args[0].includes("🔍 AI (stream) requested search")) {
                searchTriggered = true;
            }
            originalLog(...args);
        };

        for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }

        console.log = originalLog; // Restore logging

        console.log("\n--- Finished ---");
        console.log(`Search Triggered: ${searchTriggered ? "❌ YES (FAILURE)" : "✅ NO (SUCCESS)"}`);
    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
    }
}

async function runTests() {
    // Test 1: General News (Should NOT search)
    await testRestriction("What is the latest news from Reuters? https://reuters.com", "Non-technical URL & Query");

    // Test 2: Debugging Question (SHOULD search)
    await testRestriction("What is the latest stable version of the @huggingface/inference library?", "Technical Debugging Query");
}

runTests();
