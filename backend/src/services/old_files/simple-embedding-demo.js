// simple-embedding-demo.js
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function generateAndShowEmbeddings() {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const texts = [
        "Artificial intelligence is transforming the world",
        "Machine learning is a subset of AI",
        "The weather is beautiful today",
        "I love eating pizza"
    ];

    console.log("🎯 Generating OpenAI Embeddings\n");

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        console.log(`\n${i + 1}. Text: "${text}"`);
        
        try {
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float"
            });

            const embedding = response.data[0].embedding;
            
            console.log(`   ✅ Dimensions: ${embedding.length}`);
            console.log(`   🔢 Tokens: ${response.usage.total_tokens}`);
            console.log(`   📊 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
            console.log(`   📈 Last 5 values: [${embedding.slice(-5).map(v => v.toFixed(6)).join(', ')}]`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
}

// Run the function
generateAndShowEmbeddings().catch(console.error);