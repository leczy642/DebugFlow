// test-vertex-ai.js
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';

dotenv.config();

async function testVertexAI() {
    try {
        console.log('🧪 Testing Vertex AI installation...');
        
        const vertexai = new VertexAI({
            project: process.env.GOOGLE_CLOUD_PROJECT,
            location: 'us-central1'
        });

        console.log('✅ Vertex AI client created successfully!');
        
        const model = vertexai.getGenerativeModel({
            model: 'textembedding-gecko@001'
        });
        
        console.log('✅ Embedding model loaded successfully!');
        console.log('🎉 Vertex AI is ready to use!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testVertexAI();