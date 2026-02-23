// tests/test-search.js
import { chatWithAI } from "../src/services/chatService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend root
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
    console.log("🚀 Testing Web Search Integration...");

    const messages = [
        { role: "user", content: "What is the latest score of the Super Bowl 2025?" }
    ];

    // Override model for testing connectivity if needed
    process.env.HUGGINGFACE_CHAT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";

    try {
        console.log(`Using model: ${process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.1:novita"}`);
        console.log("Waiting for AI response (this should trigger a search)...");
        const response = await chatWithAI(messages);
        console.log("\n--- AI Response ---");
        console.log(response);
        console.log("--- End of Response ---\n");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

runTest();
