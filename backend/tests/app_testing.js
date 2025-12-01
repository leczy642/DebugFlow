//simple JS files for fun testing
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_TOKEN, // Or your actual token
  model: "BAAI/bge-base-en-v1.5", // Or specify a different model
});

// You can also use HuggingFaceEndpoint for LLMs
// import { HuggingFaceEndpoint } from "@langchain/community/llms/hf";

// const llm = new HuggingFaceEndpoint({
//   apiKey: process.env.HUGGINGFACE_API_KEY,
//   repoId: "mistralai/Mistral-Nemo-Instruct-2407", // Or your desired LLM
// });

const text = "This is a sample text.";
const res = await embeddings.embedQuery(text);
console.log(res);

// const result = await llm.call("What is the capital of France?");
// console.log(result);
