/**
 * analyzeError.js
 * ----------------
 * Refactored log analysis with Hugging Face LLM integration.
 * Supports single and batch queries, test and production display modes.
 * Structured logging in production, emojis & console logs in test mode.
 */

import { InferenceClient } from "@huggingface/inference";
import { retrieveSimilarLogs, EmbeddingService } from './retrieveSimilarLogs.js';
import { retryWithBackoff } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import { withTimeout } from "../utils/withTimeout.js";
import { normalizeUserQuery } from "../utils/promptValidator.js";

// Initialize Hugging Face LLM client
const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
const LLM_CHAT_MODEL = process.env.HUGGINGFACE_CHAT_MODEL || "deepseek-ai/DeepSeek-V3.1:novita";
const MAX_PROMPT_CHARS = Number(process.env.MAX_PROMPT_CHARS || 7000);
const LLM_RETRY_DELAY = Number(process.env.LLM_RETRY_BASE_DELAY_MS || 500);
const LLM_CHAT_TIMEOUT_MS = Number(process.env.HUGGINGFACE_CHAT_TIMEOUT_MS || 15000);
const LLM_RETRIES = Number(process.env.LLM_RETRIES || 3);

/**
 * LogAnalysisService
 * ------------------
 * Encapsulates log retrieval, formatting, LLM prompting, and analysis.
 * Input: user query string.
 * Output: structured analysis results including similar logs and LLM response.
 */
class LogAnalysisService {
    constructor() {
        this.embeddingService = new EmbeddingService(); // For future embedding-based retrieval
    }

    /**
     * Formats similar logs into a structured string for LLM context.
     * @param {Array} similarLogs - Logs returned by EmbeddingService.
     * @param {string} userQuery - Original user query.
     * @returns {string} LLM-ready context string.
     */
    formatLogsForAnalysis(similarLogs, userQuery) {
        let context = `USER QUERY: "${userQuery}"\nSIMILAR HISTORICAL LOGS FOUND:\n`;
        similarLogs.forEach((log, index) => {
            context += `\n${index + 1}. [${log.type.toUpperCase()}] from ${log.source}\n`;
            context += `   Similarity: ${(log.score * 100).toFixed(1)}%\n`;
            context += `   Category: ${log.category}\n`;
            context += `   Content: ${log.text}\n`;
        });
        return context;
    }

    /**
     * Builds the LLM prompt for root cause and resolution analysis.
     * Input: formatted logs context.
     * Output: prompt string for LLM.
     */
    createAnalysisPrompt(logsContext) {
        return `
        You are a senior software engineer analyzing application logs. Your task is to analyze similar historical logs and provide insights about the current issue.
        
        ${logsContext}

        Based on the similar historical logs above, please provide:

        1. ROOT CAUSE ANALYSIS: What is the likely root cause of this issue?
        2. RESOLUTION SUGGESTIONS: What steps should be taken to resolve or investigate further?

        Provide a structured, professional analysis focusing only on these two areas.
        `;
    }

    /**
     * Executes the LLM analysis for a single query.
     * Input: sanitized query string, topK similar logs.
     * Output: object containing analysis text, similar logs, model info, timestamp.
     */
    async analyzeLogsWithLLM(userQuery, topK = 5) {
        try {
            logger.info('Starting LLM log analysis...');
            const similarLogs = await retrieveSimilarLogs(userQuery, topK);

            if (!similarLogs.length) {
                return {
                    analysis: "No similar historical logs found for analysis.",
                    similarLogs: []
                };
            }

            const logsContext = this.formatLogsForAnalysis(similarLogs, userQuery);
            const prompt = this.createAnalysisPrompt(logsContext);

            if (prompt.length > MAX_PROMPT_CHARS) {
                throw new Error(`LLM prompt exceeds ${MAX_PROMPT_CHARS} characters`);
            }

            const chatCompletion = await retryWithBackoff(
                () => withTimeout(
                    signal => client.chatCompletion({
                        model: LLM_CHAT_MODEL,
                        messages: [{ role: "user", content: prompt }],
                        signal
                    }),
                    LLM_CHAT_TIMEOUT_MS
                ),
                LLM_RETRIES,
                LLM_RETRY_DELAY
            );

            return {
                analysis: chatCompletion.choices[0].message.content,
                similarLogs,
                query: userQuery,
                model: LLM_CHAT_MODEL,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error during LLM analysis', { error: error.message });
            throw error;
        }
    }

    /**
     * Generates an executive summary of an analysis result.
     * Input: results from analyzeLogsWithLLM().
     * Output: string summary.
     */
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

            const chatCompletion = await retryWithBackoff(
                () => withTimeout(
                    signal => client.chatCompletion({
                        model: LLM_CHAT_MODEL,
                        messages: [{ role: "user", content: summaryPrompt }],
                        signal
                    }),
                    LLM_CHAT_TIMEOUT_MS
                ),
                LLM_RETRIES,
                LLM_RETRY_DELAY
            );

            return chatCompletion.choices[0].message.content;
        } catch (error) {
            logger.error('Error generating summary', { error: error.message });
            return "Executive summary unavailable.";
        }
    }
}

// ---------------------------
// Display helpers
// ---------------------------
/**
 * displayResultsProduction(results)
 *
 * WHAT: Formats and prints LLM analysis output cleanly for real-world use.
 * WHY: Production environments require readable output without noisy debug logs.
 * INPUT: "results" → array of objects returned from log analysis.
 * OUTPUT: Console-friendly summary of matched logs + reasoning without raw dumps.
 */
function displayResultsProduction(results) {
    logger.info('=== LOG ANALYSIS RESULTS ===');
    logger.info(`Query: ${results.query}`);
    logger.info(`Model: ${results.model}`);
    logger.info(`Similar logs found: ${results.similarLogs.length}`);
    logger.info(`Analysis timestamp: ${results.timestamp}`);

    results.similarLogs.slice(0, 3).forEach((log, index) => {
        logger.info(`[${index + 1}] ${log.type.toUpperCase()} from ${log.source}`);
        logger.info(`    Similarity: ${(log.score * 100).toFixed(1)}%`);
        logger.info(`    Category: ${log.category}`);
        logger.info(`    Content: ${log.text.substring(0, 100)}...`);
    });

    logger.info('--- LLM ANALYSIS ---');
    logger.info(results.analysis);
}

/**
 * displayResultsTest(results)
 *
 * WHAT: Outputs raw, detailed results for debugging and validation.
 * WHY: Test mode requires full visibility — no formatting, no hiding.
 * INPUT: "results" → array of analyzed log objects.
 * OUTPUT: Expanded JSON dump containing reasoning, scoring,_matches, etc.
 */
function displayResultsTest(results) {
    console.log(`\n📋 QUERY: "${results.query}"`);
    console.log(`🤖 MODEL: ${results.model}`);
    console.log(`📊 SIMILAR LOGS FOUND: ${results.similarLogs.length}`);
    console.log(`🕒 ANALYSIS TIME: ${results.timestamp}`);

    if (results.similarLogs.length > 0) {
        console.log('\n📈 TOP SIMILAR LOGS:');
        results.similarLogs.slice(0, 3).forEach((log, index) => {
            console.log(`${index + 1}. ${log.type.toUpperCase()} from ${log.source} (${(log.score * 100).toFixed(1)}% similar)`);
            console.log(`   ${log.text.substring(0, 80)}...`);
        });
    }

    console.log('\n🤖 AI ANALYSIS:');
    console.log(results.analysis);
}

// ---------------------------
// Analyze single query
// ---------------------------
/**
 * analyzeQuery(userQuery, topK = 5, generateSummary = false, TEST_MODE = false)
 *
 * WHAT: Processes one log-analysis request end-to-end (normalize → validate → LLM → format).
 * WHY: Single analysis operation must be reusable by batch mode & CLI mode.
 * INPUT:
 *    userQuery → raw text from user
 *    topK → how many log matches to return (default 5)
 *    generateSummary → whether LLM should also summarize findings
 *    TEST_MODE → if true, skip validation + return unfiltered internal data
 * OUTPUT: Object containing similarLogs[], reasoning text, scores, and optional summary.
 */
async function analyzeQuery(userQuery, topK = 5, generateSummary = false, TEST_MODE = false) {
    const analysisService = new LogAnalysisService();
    const result = normalizeUserQuery(userQuery);

    if (!result.ok) {
        return { success: false, error: result.error, hint: "Provide an error, stacktrace, log, or exception." };
    }

    const safeQuery = result.query;

    try {
        const results = await analysisService.analyzeLogsWithLLM(safeQuery, topK);

        if (TEST_MODE) displayResultsTest(results);
        else displayResultsProduction(results);

        if (generateSummary) {
            const summary = await analysisService.generateExecutiveSummary(results);
            if (TEST_MODE) console.log('\n💼 ERROR ANALYSIS SUMMARY:\n', summary);
            else logger.info('--- EXECUTIVE SUMMARY ---\n', summary);
        }

        return results;
    } catch (error) {
        if (TEST_MODE) console.error('💥 Analysis failed:', error.message);
        else logger.error('Analysis failed', { error: error.message });
        return null;
    }
}

// ---------------------------
// Batch analysis (respects TEST_MODE)
// ---------------------------
/**
 * batchAnalysis(queries, topK = 3, TEST_MODE = false, generateSummary = false)
 *
 * WHAT: Runs analyzeQuery() repeatedly for multiple prompts in one execution.
 * WHY: Useful for bulk log testing, benchmarking models, or automated evaluation.
 * INPUT:
 *    queries → array of query strings
 *    topK → number of matches per query
 *    TEST_MODE → if true, run without normalization/validation
 *    generateSummary → optional LLM summary per query
 * OUTPUT: Array of results — one result object per input query.
 */
async function batchAnalysis(queries, topK = 3, TEST_MODE = false, generateSummary = false) {
    const analysisService = new LogAnalysisService();
    const results = [];

    for (const queryString of queries) {
        // Log start
        if (TEST_MODE) {
            console.log(`${'🔍'.repeat(50)}\nANALYZING: "${queryString}"\n${'🔍'.repeat(50)}`);
        } else {
            logger.info('='.repeat(60));
            logger.info(`ANALYZING: "${queryString}"`);
            logger.info('='.repeat(60));
        }

        try {
            const result = normalizeUserQuery(queryString);
            if (!result.ok) {
                const msg = `Skipping invalid query → ${queryString}`;
                if (TEST_MODE) console.warn(msg);
                else logger.warn(msg);
                continue;
            }

            const analysis = await analysisService.analyzeLogsWithLLM(result.query, topK);

            if (TEST_MODE) displayResultsTest(analysis);
            else displayResultsProduction(analysis);

            if (generateSummary) {
                const summary = await analysisService.generateExecutiveSummary(analysis);
                if (TEST_MODE) console.log('\n💼 ERROR ANALYSIS SUMMARY:\n', summary);
                else logger.info('--- EXECUTIVE SUMMARY ---\n', summary);
            }

            results.push(analysis);

            const infoMsg = `Query analyzed successfully. Similar logs found: ${analysis.similarLogs.length}. Model: ${analysis.model}`;
            if (TEST_MODE) console.log(infoMsg);
            else logger.info(infoMsg);

        } catch (error) {
            const errMsg = `Failed to analyze "${queryString}" → ${error.message}`;
            if (TEST_MODE) console.error(errMsg);
            else logger.error(errMsg);
            results.push({ query: queryString, error: error.message });
        }

        await new Promise(r => setTimeout(r, 2000));
    }

    return results;
}

// ---------------------------
// CLI entrypoint
// ---------------------------
/**
 * main()
 * WHAT: Entry point that runs user queries.
 * WHY: Routes execution through TEST or PROD behavior.
 * INPUT: CLI args → query, topK, flags.
 * OUTPUT: Console results formatted per mode.
 */
async function main() {
    const rawArgs = process.argv.slice(2);

    if (!rawArgs.length) {
        console.log(`
Usage:
  node analyzeError.js <query> [topK] [--summary]           # Production mode
  node analyzeError.js --test <query> [topK] [--summary]    # Test mode
  node analyzeError.js --batch                               # Batch mode (production)

Examples:
  node analyzeError.js "database connection timeout"        # Prod mode
  node analyzeError.js "memory leak" 5 --summary            # Prod mode
  node analyzeError.js --test "database connection issues"  # Test mode
        `);
        return;
    }

    const TEST_MODE = rawArgs[0] === '--test';
    const BATCH_MODE = rawArgs[0] === '--batch' || rawArgs[0] === '-b';
    let query = rawArgs[0];
    let topK = 5;
    let generateSummary = rawArgs.includes('--summary') || rawArgs.includes('-s');

    if (TEST_MODE) {
        query = rawArgs[1];
        topK = parseInt(rawArgs[2]) || 5;
    }

    if (BATCH_MODE) {
        const testQueries = [
            "database connection timeout error",
            "memory allocation failure",
            "authentication service down",
            "API endpoint returning 500 errors",
            "high CPU usage in production"
        ];
        console.log("🧪 Running batch analysis...\n");
        await batchAnalysis(testQueries, 3, TEST_MODE, generateSummary);
        return;
    }

    await analyzeQuery(query, topK, generateSummary, TEST_MODE);
}

// ---------------------------
// Export modules
// ---------------------------
export { LogAnalysisService, analyzeQuery, batchAnalysis };

// ---------------------------
// Run if executed directly
// ---------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Application failed:', error);
        process.exit(1);
    });
}

// ---------------------------
// Running this module in commandline 
// ---------------------------
//1. TEST MODE
//----------------------------
// DEBUGFLOW_TEST_MODE=true node analyzeError.js "database connection timeout"

//TEST MODE - BATCH TESTING
// DEBUGFLOW_TEST_MODE=true node analyzeError.js --batch

//TEST MODE - SUMMARY
//DEBUGFLOW_TEST_MODE=true node analyzeError.js --batch --summary
//--summary generates executive summaries for each query:


//2. PRODUCTION MODE
//------------------
// node analyzeError.js "database connection timeout"


//PRODUCTION MODE - BATCH example
// node analyzeError.js --batch


//PRODUCTION MODE - SUMMARY
//node analyzeError.js --batch --summary
//--summary generates executive summaries for each query:
