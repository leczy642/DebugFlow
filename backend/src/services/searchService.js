// searchService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Handles external search requests using the Tavily API.
// - Optimized for LLM consumption (returns clean snippets).

import "../utils/loadEnv.js";

const TAVILY_API_URL = "https://api.tavily.com/search";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

/**
 * Perform a web search using Tavily.
 * @param {string} query The search query.
 * @returns {Promise<Array>} List of search results with title, url, and content.
 */
export async function searchWeb(query) {
    if (!TAVILY_API_KEY) {
        console.error("❌ TAVILY_API_KEY is not set in environment variables.");
        return [{ title: "Error", content: "Search API key missing.", url: "#" }];
    }

    try {
        const response = await fetch(TAVILY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: false,
                include_images: false,
                include_raw_content: false,
                max_results: 5,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Tavily API error (${response.status}):`, errorText);
            return [{ title: "Error", content: `Search failed: ${response.status}`, url: "#" }];
        }

        const data = await response.json();

        // Map Tavily results to a clean format for the LLM
        return (data.results || []).map(result => ({
            title: result.title,
            url: result.url,
            content: result.content
        }));
    } catch (error) {
        console.error("❌ Search request failed:", error);
        return [{ title: "Error", content: "An unexpected error occurred during search.", url: "#" }];
    }
}
