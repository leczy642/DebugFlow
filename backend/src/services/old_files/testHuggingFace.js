// src/services/testHuggingFace.js

import { HfInference } from "@huggingface/inference";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

async function testSetup() {
  console.log("🧪 Testing HuggingFace + Pinecone setup...\n");
  
  // Test 1: Environment variables
  console.log("1️⃣  Checking environment variables...");
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  const pcKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  
  console.log(`   HuggingFace: ${hfKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Pinecone: ${pcKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Index: ${indexName || "❌ Not set"}\n`);
  
  if (!hfKey || !pcKey || !indexName) {
    console.error("❌ Missing environment variables!");
    process.exit(1);
  }
  
  // Test 2: HuggingFace API with new endpoint
  console.log("2️⃣  Testing HuggingFace API...");
  try {
    const hf = new HfInference(hfKey, {
      baseUrl: "https://router.huggingface.co/hf-inference"  // ← NEW ENDPOINT
    });
    
    const embedding = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: "This is a test error message",
    });
    
    const vector = Array.isArray(embedding) ? embedding.flat() : Array.from(embedding);
    
    console.log(`   ✅ Embedding generated: ${vector.length} dimensions`);
    console.log(`   Sample: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(", ")}...]\n`);
  } catch (error) {
    console.error(`   ❌ HuggingFace error: ${error.message}\n`);
    process.exit(1);
  }
  
  // Test 3: Pinecone
  console.log("3️⃣  Testing Pinecone connection...");
  try {
    const pinecone = new Pinecone({ apiKey: pcKey });
    const index = pinecone.Index(indexName);
    
    const stats = await index.describeIndexStats();
    
    console.log(`   ✅ Connected to Pinecone`);
    console.log(`   Index: ${indexName}`);
    console.log(`   Dimensions: ${stats.dimension}`);
    console.log(`   Vectors: ${stats.namespaces?.[""]?.vectorCount || 0}\n`);
    
    if (stats.dimension !== 384) {
      console.error(`   ❌ ERROR: Index has ${stats.dimension} dimensions, expected 384!`);
      console.error(`   Recreate your Pinecone index with 384 dimensions.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`   ❌ Pinecone error: ${error.message}\n`);
    process.exit(1);
  }
  
  console.log("✅ All tests passed!\n");
  console.log("💡 Run: npm run embed:logs");
}

testSetup().catch(console.error);