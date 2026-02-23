// tests/test-no-tools.js
// Test that streaming works WITHOUT TAVILY_API_KEY (simulates production)
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env but DELETE TAVILY_API_KEY to simulate production
dotenv.config({ path: path.join(__dirname, "../.env") });
delete process.env.TAVILY_API_KEY;

// Now import chatService AFTER clearing the key
const { streamChatWithAI } = await import("../src/services/chatService.js");

async function runTest() {
    console.log("🚀 Testing streaming WITHOUT TAVILY_API_KEY (should work like production)...");

    const messages = [
        { role: "user", content: "What is 2+2?" }
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
        console.log("\n✅ Stream completed successfully! Length:", fullContent.length);
    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
    }
}

runTest();
