// tests/test-search-stream.js
import { streamChatWithAI } from "../src/services/chatService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
    console.log("🚀 Testing Streaming Web Search (prompt-based)...");
    console.log(`Model: ${process.env.HUGGINGFACE_CHAT_MODEL}`);
    console.log(`TAVILY_API_KEY set: ${!!process.env.TAVILY_API_KEY}`);

    const messages = [
        { role: "user", content: "what happened in Mexico over the weekend?" }
    ];

    try {
        const stream = streamChatWithAI(messages);
        let fullContent = "";
        for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
                process.stdout.write(content);
                fullContent += content;
            }
        }
        console.log("\n--- Stream Finished ---");
        console.log(`Total length: ${fullContent.length} chars`);
    } catch (error) {
        console.error("\n❌ Streaming test failed:", error.message);
    }
}

runTest();
