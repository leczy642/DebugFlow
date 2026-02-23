// tests/diagnose-hf-error.js
import { InferenceClient } from "@huggingface/inference";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

async function diagnose() {
    const model = "deepseek-ai/DeepSeek-V3.2:novita";
    console.log(`📡 Diagnosing HF error for ${model}...`);

    const messages = [{ role: "user", content: "What is the capital of France?" }];
    const tools = [{
        type: "function",
        function: {
            name: "search_web",
            description: "Search the web",
            parameters: {
                type: "object",
                properties: { query: { type: "string" } },
                required: ["query"]
            }
        }
    }];

    try {
        const stream = hf.chatCompletionStream({
            model: model,
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            stream: true
        });

        for await (const chunk of stream) {
            console.log("Chunk:", JSON.stringify(chunk));
        }
    } catch (error) {
        console.log("❌ Error Caught:");
        if (error.httpResponse && error.httpResponse.body) {
            console.log("Response Status:", error.httpResponse.status);
            console.log("Response Body:", JSON.stringify(error.httpResponse.body, null, 2));
        } else {
            console.log(error);
        }
    }
}

diagnose();
