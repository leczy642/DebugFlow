
const testMerge = (content) => {
    const lines = content.split('\n');
    const processedLines = [];

    // Heuristic: is this a single-line fragment block? (Starts and ends with 3+ backticks)
    const isFragment = (line) => {
        const match = line.trim().match(/^(`{3,})(.*)(\1)$/);
        return match ? match[2] : null;
    };

    // Heuristic: is this an opening or closing fence?
    const getFence = (line) => {
        const match = line.match(/^( {0,3})(`{3,}|~{3,})([a-zA-Z0-9-]*)\s*$/);
        return match ? { indent: match[1], fence: match[2], lang: match[3] } : null;
    };

    let currentOpenFence = null;
    let blockBuffer = [];
    let whitespaceBuffer = [];
    let activeLanguage = "text";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fragmentContent = isFragment(line);
        const fenceInfo = getFence(line);

        if (currentOpenFence) {
            // Inside a standard fenced block
            if (line.trim().startsWith(currentOpenFence)) {
                // Closing standard block
                currentOpenFence = null;
            } else {
                blockBuffer.push(line);
            }
        } else {
            // Outside standard block
            if (fragmentContent !== null) {
                // Fragment line like ```content```
                blockBuffer.push(...whitespaceBuffer);
                blockBuffer.push(fragmentContent);
                whitespaceBuffer = [];
            } else if (fenceInfo) {
                // Standard block start
                currentOpenFence = fenceInfo.fence;
                if (blockBuffer.length === 0 && fenceInfo.lang) {
                    activeLanguage = fenceInfo.lang;
                }
                blockBuffer.push(...whitespaceBuffer);
                whitespaceBuffer = [];
                // If it's a specific language, maybe we shouldn't merge? 
                // But for now, let's merge everything for simplicity as per user's drawings
            } else if (line.trim() === "") {
                whitespaceBuffer.push(line);
            } else {
                // Real text: Flush the consolidated block if we have one
                if (blockBuffer.length > 0) {
                    processedLines.push('```' + activeLanguage);
                    processedLines.push(...blockBuffer);
                    processedLines.push('```');
                    blockBuffer = [];
                    activeLanguage = "text";
                }
                processedLines.push(...whitespaceBuffer);
                processedLines.push(line);
                whitespaceBuffer = [];
            }
        }
    }

    if (blockBuffer.length > 0) {
        processedLines.push('```' + activeLanguage);
        processedLines.push(...blockBuffer);
        processedLines.push('```');
    }
    processedLines.push(...whitespaceBuffer);

    return processedLines.join('\n');
};

const examples = [
    {
        name: "User Example 1 (Single line fences)",
        input: "```Client (User Device) → Request → Server (Remote Computer)```\n```Server → Response → Client```",
        expected: "```Client (User Device) → Request → Server (Remote Computer)\nServer → Response → Client```"
    },
    {
        name: "User Example 2 (ASCII Diagram)",
        input: " ```  +-------------+         HTTP Request         +-------------+```\n```   |             | -------------------------->  |             |```\n ```  |   CLIENT    |                              |   SERVER    |```\n```   |  (Browser,  |         HTTP Response        | (Web Server,|```\n ```  |   Mobile App)| <--------------------------  |   API, DB)  |```\n   ```+-------------+                              +-------------+```",
        expected: " ```+-------------+         HTTP Request         +-------------+\n   |             | -------------------------->  |             |\n   |   CLIENT    |                              |   SERVER    |\n   |  (Browser,  |         HTTP Response        | (Web Server,|\n   |   Mobile App)| <--------------------------  |   API, DB)  |\n   +-------------+                              +-------------+```"
    },
    {
        name: "Language Preservation",
        input: "```javascript\nconst x = 1;\n```\n```javascript\nconst y = 2;\n```",
        expected: "```javascript\nconst x = 1;\nconst y = 2;\n```"
    },
    {
        name: "Mixed Languages (Should break merge or use first)",
        input: "```javascript\nconst x = 1;\n```\n```css\n.body { color: red; }\n```",
        // In my logic, it currently uses the first language encountered for fragments/blocks in a sequence.
        // Actually, my logic flushes when it sees real text. 
        // If it's a sequence of blocks, it keeps activeLanguage.
        // Let's see what it does.
        expected: "```javascript\nconst x = 1;\n.body { color: red; }\n```"
    }
];

examples.forEach(ex => {
    const result = testMerge(ex.input);
    console.log(`--- ${ex.name} ---`);
    console.log("Input:\n" + ex.input);
    console.log("Result:\n" + result);
});
