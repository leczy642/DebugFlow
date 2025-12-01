import { HfInference } from '@huggingface/inference';
import { HuggingFaceEmbeddings } from 'langchain/embeddings/huggingface';

// Initialize Hugging Face inference client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Initialize the embeddings model
const embeddings = new HuggingFaceEmbeddings({
  modelName: 'sentence-transformers/all-MiniLM-L6-v2',
  client: hf,
});

async function getEmbedding(text) {
  try {
    const embedding = await embeddings.embedQuery(text);
    console.log('Embedding vector:', embedding);
  } catch (error) {
    console.error('Error getting embedding:', error);
  }
}

// Example usage
getEmbedding('Hello, this is a test sentence for embedding.');
