const isDrawingLine = (line) => {
    if (line.trim() === "") return false;
    if (line.startsWith('    ')) return true;
    const drawingChars = /[+\-|/=<>\\_*]{2,}/;
    const symbols = line.replace(/[a-zA-Z0-9\s]/g, '');
    return drawingChars.test(line) || symbols.length >= 3;
};

const testContent = (content) => {
    const lines = content.split('\n');
    let openFence = null;
    const processedLines = [];
    let drawingBuffer = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fm = line.match(/^(?: {0,3})(`{3,}|~{3,})/);

        if (fm) {
            const fence = fm[1];
            if (drawingBuffer.length > 0 && !openFence) {
                if (drawingBuffer.length >= 2) {
                    processedLines.push('```text');
                    processedLines.push(...drawingBuffer);
                    processedLines.push('```');
                } else {
                    processedLines.push(...drawingBuffer);
                }
                drawingBuffer = [];
            }
            if (openFence) {
                if (fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
            } else {
                openFence = fence;
            }
            processedLines.push(line);
            continue;
        }

        if (openFence) {
            processedLines.push(line);
            continue;
        }

        if (isDrawingLine(line)) {
            drawingBuffer.push(line);
        } else if (line.trim() === "" && drawingBuffer.length > 0) {
            drawingBuffer.push(line);
        } else {
            if (drawingBuffer.length > 0) {
                while (drawingBuffer.length > 0 && drawingBuffer[drawingBuffer.length - 1].trim() === "") drawingBuffer.pop();
                if (drawingBuffer.length >= 2) {
                    processedLines.push('```text');
                    processedLines.push(...drawingBuffer);
                    processedLines.push('```');
                } else {
                    processedLines.push(...drawingBuffer);
                }
                drawingBuffer = [];
            }
            processedLines.push(line);
        }
    }

    if (drawingBuffer.length > 0 && !openFence) {
        while (drawingBuffer.length > 0 && drawingBuffer[drawingBuffer.length - 1].trim() === "") drawingBuffer.pop();
        if (drawingBuffer.length >= 2) {
            processedLines.push('```text');
            processedLines.push(...drawingBuffer);
            processedLines.push('```');
        } else {
            processedLines.push(...drawingBuffer);
        }
    }

    return processedLines.join('\n');
};

console.log("Test 1 (Simple open):");
console.log(JSON.stringify(testContent("```\nline 1")));

console.log("\nTest 2 (Nested backticks - common in drawings):");
console.log(JSON.stringify(testContent("```\n+---+\n| ` |\n+---+")));

console.log("\nTest 3 (Four backticks - often used by modern LLMs):");
console.log(JSON.stringify(testContent("````javascript\ncode")));

console.log("\nTest 4 (Three backticks inside four backticks):");
console.log(JSON.stringify(testContent("````\n```\nline\n```\n````")));

console.log("\nTest 5 (ASCII Drawing Detection):");
const drawing = `
Here is a diagram:
    +---+
    |   |
    +---+
End of diagram.
`;
console.log(testContent(drawing));

console.log("\nTest 6 (Indented lines with symbols):");
const indented = `
Code:
    x = 10;
    y = 20;
    z = x + y;
`;
// My heuristic SHOULD wrap this too, which is actually desirable for consistency
console.log(testContent(indented));
