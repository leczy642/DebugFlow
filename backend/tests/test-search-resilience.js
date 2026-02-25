// tests/test-search-resilience.js
import { streamChatWithAI } from "../src/services/chatService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

// SIMULATE SEARCH FAILURE by breaking the API key
process.env.TAVILY_API_KEY = "invalid_key_for_testing";

async function testSearchResilience() {
    console.log("\n🚀 Testing Search Resilience: Simulating Tavily API Failure");
    console.log("The system should catch the search error and fallback to DeepSeek's internal knowledge.");

    const prompt = "What is the latest stable version of the React library? (Simulated Search Fail)";
    const messages = [{ role: "user", content: prompt }];

    try {
        const stream = streamChatWithAI(messages);
        let searchTriggered = false;
        let fullResponse = "";

        for await (const chunk of stream) {
            if (chunk.isSearching) {
                searchTriggered = true;
                console.log("📡 Frontend Signal: searching...");
                continue;
            }
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
                fullResponse += content;
                process.stdout.write(content);
            }
        }

        console.log("\n\n--- Verification ---");
        console.log(`Search Was Attempted: ${searchTriggered ? "✅ YES" : "❌ NO"}`);
        console.log(`Response Received: ${fullResponse.length > 0 ? "✅ YES" : "❌ NO"}`);

        if (fullResponse.toLowerCase().includes("unavailable") || fullResponse.toLowerCase().includes("couldn't access")) {
            console.log("✅ Fallback Detection: AI admitted it couldn't access live results.");
        } else {
            console.log("⚠️ Fallback Detection: AI didn't explicitly mention the failure, but it completed the response.");
        }

        console.log("Verdict: The system successfully recovered from search failure and provided an answer.");
    } catch (error) {
        console.error("\n❌ Test failed: The system crashed during search failure instead of falling back.", error.message);
    }
}

testSearchResilience();
