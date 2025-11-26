// retrieve-similar-logs.js
import { OpenAIEmbeddings } from "@langchain/openai";
import { HfInference } from '@huggingface/inference';
import { Pinecone } from '@pinecone-database/pinecone';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory
const envPath = path.join(__dirname, '..', '.env');
console.log('📁 Loading .env from:', envPath);

const result = config({ path: envPath });
if (result.error) {
    console.error('❌ Error loading .env:', result.error);
    process.exit(1);
}

console.log('✅ Environment loaded');
console.log('🔑 PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('🔑 HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✅ Set' : '❌ Missing');

// Initialize services
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

const openaiEmbeddings = new OpenAIEmbeddings({ 
    apiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-small"
});

const hf = new HfInference(
    process.env.HUGGINGFACE_API_KEY,
    'https://router.huggingface.co/hf-inference'
);

class EmbeddingService {
    async generateEmbedding(text) {
        // Try OpenAI first
        if (process.env.OPENAI_API_KEY) {
            try {
                console.log('   🤖 Using OpenAI...');
                const vector = await openaiEmbeddings.embedQuery(text);
                console.log(`   ✅ OpenAI - ${vector.length} dimensions`);
                return vector;
            } catch (openaiError) {
                console.log(`   ⚠️ OpenAI failed: ${openaiError.message}`);
                console.log('   🔄 Falling back to Hugging Face...');
            }
        }

        // Fallback to Hugging Face
        if (process.env.HUGGINGFACE_API_KEY) {
            try {
                console.log('   🦙 Using Hugging Face...');
                const vector = await hf.featureExtraction({
                    model: 'sentence-transformers/all-MiniLM-L6-v2',
                    inputs: text
                });
                console.log(`   ✅ Hugging Face - ${vector.length} dimensions`);
                return vector;
            } catch (hfError) {
                console.error(`   ❌ Hugging Face failed: ${hfError.message}`);
            }
        }

        throw new Error('No embedding service available');
    }
}

const embeddingService = new EmbeddingService();

// Main function to retrieve similar logs
async function retrieveSimilarLogs(query, topK = 5) {
    try {
        console.log(`\n🔍 Searching for logs similar to: "${query}"`);
        
        // Generate embedding for the query
        const queryVector = await embeddingService.generateEmbedding(query);
        
        // Query Pinecone for similar logs
        const results = await index.query({
            topK,
            vector: queryVector,
            includeMetadata: true,
        });
        
        console.log(`📊 Found ${results.matches.length} similar logs\n`);
        
        // Format and return results
        return results.matches.map(match => ({
            id: match.id,
            score: match.score,
            type: match.metadata?.type || 'unknown',
            source: match.metadata?.source || 'unknown',
            category: match.metadata?.category || 'unknown',
            text: match.metadata?.text || match.metadata?.content || 'No content',
            timestamp: match.metadata?.timestamp || 'unknown'
        }));
        
    } catch (error) {
        console.error('❌ Error retrieving similar logs:', error.message);
        return [];
    }
}

// Display results in a clean format
function displayResults(results, query) {
    if (results.length === 0) {
        console.log('❌ No similar logs found');
        return;
    }

    console.log(`🎯 Top ${results.length} logs similar to: "${query}"`);
    console.log('═'.repeat(80));
    
    results.forEach((log, index) => {
        console.log(`\n${index + 1}. 📝 ${log.type.toUpperCase()} from ${log.source}`);
        console.log(`   ⭐ Similarity Score: ${(log.score * 100).toFixed(1)}%`);
        console.log(`   🏷️  Category: ${log.category}`);
        console.log(`   📅 Timestamp: ${log.timestamp}`);
        console.log(`   📄 Content: ${log.text.substring(0, 120)}...`);
        console.log('   ──────────────────────────────────────────────────────────');
    });
}

// Test with multiple queries
async function testRetrieval() {
    const testQueries = [
        "database connection error",
        "memory allocation failed", 
        "authentication timeout",
        "404 not found error",
        "syntax error in code"
    ];

    for (const query of testQueries) {
        const results = await retrieveSimilarLogs(query, 3);
        displayResults(results, query);
        
        // Add spacing between queries
        if (query !== testQueries[testQueries.length - 1]) {
            console.log('\n' + '•'.repeat(80) + '\n');
        }
    }
}

// Single query mode
async function singleQuery(query = null, topK = 5) {
    if (!query) {
        // Use command line argument or default query
        query = process.argv[2] || "error 404 resource not found";
    }
    
    const results = await retrieveSimilarLogs(query, topK);
    displayResults(results, query);
}

// Run based on command line arguments
async function main() {
    const mode = process.argv[2];
    
    if (mode === 'test' || mode === '--test') {
        console.log('🧪 Running test queries...\n');
        await testRetrieval();
    } else {
        // Single query mode - use provided query or default
        const query = process.argv[2] || "error in application";
        const topK = parseInt(process.argv[3]) || 5;
        await singleQuery(query, topK);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
}

// Export for use in other modules
export { retrieveSimilarLogs, EmbeddingService };