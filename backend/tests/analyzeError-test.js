// hf-reasoning-analysis.js
import { InferenceClient } from "@huggingface/inference";
import { retrieveSimilarLogs, EmbeddingService } from './retrieveSimilarLogs-test.js';

// Initialize Hugging Face for reasoning using inferenceClient
const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

class LogAnalysisService {
    constructor() {
        this.embeddingService = new EmbeddingService();
    }

    // Format similar logs for LLM context
    formatLogsForAnalysis(similarLogs, userQuery) {
        let context = `USER QUERY: "${userQuery}"\n\n`;
        context += "SIMILAR HISTORICAL LOGS FOUND:\n";
        
        similarLogs.forEach((log, index) => {
            context += `\n${index + 1}. [${log.type.toUpperCase()}] from ${log.source}\n`;
            context += `   Similarity: ${(log.score * 100).toFixed(1)}%\n`;
            context += `   Category: ${log.category}\n`;
            context += `   Content: ${log.text}\n`;
        });
        
        return context;
    }

    // Generate analysis prompt - removed unwanted sections
    createAnalysisPrompt(logsContext) {
        return `
You are a senior software engineer analyzing application logs. Your task is to analyze similar historical logs and provide insights about the current issue.

${logsContext}

Based on the similar historical logs above, please provide:

1. ROOT CAUSE ANALYSIS: What is the likely root cause of this issue?
2. RESOLUTION SUGGESTIONS: What steps should be taken to resolve or investigate further?

Please provide a structured, professional analysis focusing only on these two areas.
`;
    }

    // Main analysis function
    async analyzeLogsWithLLM(userQuery, topK = 5) {
        try {
            console.log('🚀 Starting Hugging Face-Powered Log Analysis...\n');
            
            // Step 1: Retrieve similar logs
            const similarLogs = await retrieveSimilarLogs(userQuery, topK);
            
            if (similarLogs.length === 0) {
                return {
                    analysis: "No similar historical logs found for analysis.",
                    similarLogs: []
                };
            }

            // Step 2: Format logs for LLM context
            const logsContext = this.formatLogsForAnalysis(similarLogs, userQuery);
            
            // Step 3: Generate analysis with Hugging Face
            console.log('🤖 Generating AI analysis with Hugging Face...');
            const prompt = this.createAnalysisPrompt(logsContext);
            
            const chatCompletion = await client.chatCompletion({
                model: "deepseek-ai/DeepSeek-R1:novita",
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });

            // Step 4: Return comprehensive results
            return {
                analysis: chatCompletion.choices[0].message.content,
                similarLogs,
                query: userQuery,
                model: "deepseek-ai/DeepSeek-R1:novita",
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error in Hugging Face analysis:', error.message);
            throw error;
        }
    }

    // Generate executive summary - simplified
    async generateExecutiveSummary(analysisResults) {
        try {
            const summaryPrompt = `
Create a concise executive summary of this log analysis:

QUERY: ${analysisResults.query}
ANALYSIS: ${analysisResults.analysis}

Focus on:
- Main issue identified
- Key recommendations

Keep it professional and actionable for management.
`;

            const chatCompletion = await client.chatCompletion({
                model: "deepseek-ai/DeepSeek-R1:novita",
                messages: [
                    {
                        role: "user",
                        content: summaryPrompt,
                    },
                ],
            });

            return chatCompletion.choices[0].message.content;

        } catch (error) {
            console.error('❌ Error generating summary:', error.message);
            return "Executive summary unavailable.";
        }
    }
}

// Display results in a beautiful format
function displayAnalysisResults(results) {
    console.log('\n' + '🎯'.repeat(40));
    console.log('              HUGGING FACE LOG ANALYSIS RESULTS');
    console.log('🎯'.repeat(40));
    
    console.log(`\n📋 QUERY: "${results.query}"`);
    console.log(`🤖 MODEL: ${results.model}`);
    console.log(`📊 SIMILAR LOGS FOUND: ${results.similarLogs.length}`);
    console.log(`🕒 ANALYSIS TIME: ${new Date().toLocaleString()}`);
    
    // Display similar logs briefly
    if (results.similarLogs.length > 0) {
        console.log('\n📈 TOP SIMILAR LOGS:');
        console.log('─'.repeat(80));
        results.similarLogs.slice(0, 3).forEach((log, index) => {
            console.log(`${index + 1}. ${log.type.toUpperCase()} from ${log.source} (${(log.score * 100).toFixed(1)}% similar)`);
            console.log(`   ${log.text.substring(0, 80)}...`);
        });
    }
    
    // Display LLM analysis
    console.log('\n🤖 AI ANALYSIS:');
    console.log('═'.repeat(80));
    console.log(results.analysis);
    console.log('═'.repeat(80));
}

// Main analysis function
async function analyzeQuery(userQuery, topK = 5, generateSummary = false) {
    const analysisService = new LogAnalysisService();
    
    try {
        const results = await analysisService.analyzeLogsWithLLM(userQuery, topK);
        displayAnalysisResults(results);
        
        // Generate executive summary if requested
        if (generateSummary) {
            console.log('\n📄 GENERATING ERROR ANALYSIS SUMMARY...');
            const summary = await analysisService.generateExecutiveSummary(results);
            console.log('\n💼 ERROR ANALYSIS SUMMARY:');
            console.log('─'.repeat(80));
            console.log(summary);
            console.log('─'.repeat(80));
        }
        
        return results;
        
    } catch (error) {
        console.error('💥 Analysis failed:', error.message);
        return null;
    }
}

// Batch analysis for multiple queries
async function batchAnalysis(queries, topK = 3) {
    const analysisService = new LogAnalysisService();
    const results = [];
    
    for (const query of queries) {
        console.log(`\n${'🔍'.repeat(50)}`);
        console.log(`ANALYZING: "${query}"`);
        console.log('🔍'.repeat(50));
        
        try {
            const analysis = await analysisService.analyzeLogsWithLLM(query, topK);
            results.push(analysis);
            
            // Brief display for batch mode
            console.log(`\n📊 Found ${analysis.similarLogs.length} similar logs`);
            console.log(`🤖 Model: ${analysis.model}`);
            console.log('✅ Analysis completed successfully\n');
            
        } catch (error) {
            console.error(`❌ Failed to analyze "${query}":`, error.message);
            results.push({ query, error: error.message });
        }
        
        // Add delay between analyses to avoid rate limiting
        if (queries.indexOf(query) < queries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return results;
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage:
  node hf-reasoning-analysis.js <query> [topK] [--summary]
  node hf-reasoning-analysis.js --batch
  node hf-reasoning-analysis.js --test

Examples:
  node hf-reasoning-analysis.js "database connection timeout"
  node hf-reasoning-analysis.js "memory leak" 5 --summary
  node hf-reasoning-analysis.js --batch
        `);
        return;
    }

    if (args[0] === '--batch' || args[0] === '-b') {
        // Batch analysis with predefined queries
        const testQueries = [
            "database connection timeout error",
            "memory allocation failure",
            "authentication service down",
            "API endpoint returning 500 errors",
            "high CPU usage in production"
        ];
        
        console.log('🧪 Running batch analysis...\n');
        await batchAnalysis(testQueries, 3);
        
    } else if (args[0] === '--test' || args[0] === '-t') {
        // Single test query
        await analyzeQuery("database connection issues", 5, true);
        
    } else {
        // Single query analysis
        const query = args[0];
        const topK = parseInt(args[1]) || 5;
        const generateSummary = args.includes('--summary') || args.includes('-s');
        
        await analyzeQuery(query, topK, generateSummary);
    }
}

// Export for use in other modules
export { 
    LogAnalysisService, 
    analyzeQuery, 
    batchAnalysis 
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Application failed:', error);
        process.exit(1);
    });
}






// import { InferenceClient } from "@huggingface/inference";

// const client = new InferenceClient('YOUR_HUGGING_FACE_API_KEY');

// const chatCompletion = await client.chatCompletion({
//     model: "meta-llama/Llama-3.1-8B-Instruct:novita",
//     messages: [
//         {
//             role: "user",
//             content: "What is the capital of France?",
//         },
//     ],
// });

// console.log(chatCompletion.choices[0].message);

