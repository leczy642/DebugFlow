//import { HfInference } from '@huggingface/inference';
import { InferenceClient } from "@huggingface/inference";
import { Pinecone } from '@pinecone-database/pinecone';
//import dotenv from 'dotenv';
import { config } from 'dotenv';

import fs from 'fs';
import {dirname} from 'path';
import { fileURLToPath } from "url";
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


//dotenv.config();

// Load .env from the parent directory (backend/)
const envPath = path.join(__dirname, '..', '.env');
console.log('📁 Loading .env from:', envPath);
console.log('📄 .env exists:', fs.existsSync(envPath))

// Explicitly load the .env file
const result = config({ path: envPath });
//console.log("Environmental variables: ", result)
if (result.error) {
    console.error('❌ Error loading .env:', result.error);
    process.exit(1);
}

console.log('✅ .env loaded successfully');
console.log('🔑 PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY);
console.log('🔑 HUGGINGFACE_API_KEY exists:', !!process.env.HUGGINGFACE_API_KEY);

if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY is not set in .env file');
    process.exit(1);
}

async function generateAndStoreEmbeddings() {
    try {
        console.log('🚀 Starting Hugging Face Embeddings + Pinecone Storage...\n');
        
        // Initialize Hugging Face with correct endpoint
        const hf = new InferenceClient(
            process.env.HUGGINGFACE_API_KEY,
            'https://router.huggingface.co/hf-inference'
        );

        // Initialize Pinecone
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });

        // Get or create index
        const indexName = 'debug-logs-hf';
        let index;
        
        try {
            index = pinecone.index(indexName);
            console.log(`✅ Using existing Pinecone index: ${indexName}`);
        } catch (error) {
            console.log(`❌ Index ${indexName} not found or error:`, error.message);
            console.log('Please create the index in Pinecone console first');
            return;
        }
        const filePath = path.join(__dirname, "..", "data", "sample_logs.json");
        console.log("Log data file path:", filePath);
        // Sample documents to embed and store
       // const documents = 
       let documents;

        try {
            documents = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            console.log("sample_logs.json contents: ", documents);
          } catch (err) {
            console.error("Error:", err);
          }

        const vectors = [];

        // Generate embeddings for each document using hugging face all-MiniLM-L6-v2 model
        for (const doc of documents) {
            console.log(`\n📝 Processing: "${doc.stacktrace.substring(0, 50)}..."`);
            
            const embedding = await hf.featureExtraction({
                model: 'sentence-transformers/all-MiniLM-L6-v2',
                inputs: doc.stacktrace,
            });
            
            console.log(`   ✅ Dimensions: ${embedding.length}`);
            console.log(`   📊 First 3 values: [${embedding.slice(0, 3).map(v => v.toFixed(6)).join(', ')}]`);

            // Prepare vector for Pinecone
            vectors.push({
                id: doc.id,
                values: embedding,
                metadata: {
                    text: doc.stacktrace,
                    category: doc.category,
                    source: doc.source,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Store all vectors in Pinecone
        console.log('\n💾 Storing embeddings in Pinecone...');
       //await index.upsert(vectors);
        console.log(`✅ Successfully stored ${vectors.length} embeddings in Pinecone`);

        // Verify by querying similar items
        console.log('\n🔍 Testing similarity search...');
        
        // Test query
        const testQuery = "eror 404: resource not found";
        console.log(`   Query: "${testQuery}"`);
        
        const queryEmbedding = await hf.featureExtraction({
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            inputs: testQuery
        });

        const results = await index.query({
            vector: queryEmbedding,
            topK: 3,
            includeMetadata: true
        });

        console.log('\n📈 Top similar results:');
        results.matches.forEach((match, index) => {
            console.log(`   ${index + 1}. Score: ${match.score.toFixed(4)}`);
            console.log(`      Text: "${match.metadata.text}"`);
            console.log(`      Category: ${match.metadata.category}`);
        });

        console.log('\n🎉 All operations completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('📋 Stack:', error.stack);
    }
}

// Run the function
generateAndStoreEmbeddings();
