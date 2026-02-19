
const ReactMarkdown = require('react-markdown')
const remarkGfm = require('remark-gfm')

const content = `
Here is a drawing:
    +---+
    |   |
+---+
    |   |
    +---+
`;

// This is just a conceptual test since I can't easily run react-markdown in node without setup
// But I can simulate the logic
const process = (text) => {
    // My proposed fix: detect blocks and wrap
    return text.replace(/(?:\n|^)((?: {0,3}[+\-|/=<>\\_]{2,}.*\n?){2,})/g, (match) => {
        return '\n```text\n' + match.trim() + '\n```\n';
    });
};

console.log("Original:");
console.log(content);
console.log("\nProcessed:");
console.log(process(content));
