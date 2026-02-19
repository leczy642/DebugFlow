// components/chat/StreamingMarkdown.tsx
/**
 * StreamingMarkdown.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders markdown content from AI responses with rich formatting and syntax highlighting.
 * Special handling for streaming content ensures incomplete code blocks are displayed
 * gracefully without breaking the markdown parser.
 *
 * ROLE IN PROJECT:
 * - Primary markdown renderer for assistant messages in chat interface
 * - Provides code syntax highlighting with copy functionality
 * - Handles streaming edge cases (unclosed code fences, partial content)
 * - Ensures consistent styling across all markdown elements
 *
 * WHAT THIS FILE DOES:
 * 1. Processes streaming content to handle incomplete markdown structures
 * 2. Renders markdown with GitHub Flavored Markdown (GFM) support
 * 3. Provides syntax-highlighted code blocks with language detection
 * 4. Implements copy-to-clipboard functionality for code snippets
 * 5. Applies consistent styling to all markdown elements (headings, lists, tables, etc.)
 * 6. Handles inline code, links, blockquotes, and tables appropriately
 *
 * INPUTS:
 * - `content`: Markdown-formatted text to render
 * - `isStreaming`: Boolean indicating if content is still streaming (affects code block handling)
 *
 * OUTPUTS:
 * - Fully rendered markdown with appropriate HTML structure
 * - Interactive code blocks with copy buttons
 * - Accessible, styled markdown elements
 *
 * IMPORTANT:
 * This component uses ReactMarkdown with custom components to override default styling.
 * During streaming, it automatically closes incomplete code blocks to prevent parsing errors.
 * The copy functionality is per-component instance (not per code block) due to state limitations.
 * -----------------------------------------------------------------------------
 */

"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
    content: string;
    isStreaming?: boolean;
};

function CodeBlock({ language, codeString }: { language: string; codeString: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-block-language">{language}</span>
                <button
                    className="code-block-copy"
                    onClick={handleCopy}
                    title="Copy code"
                >
                    {copied ? (
                        <span className="flex items-center gap-1">
                            <span className="text-green-600 font-bold">✓</span>
                            Copied
                        </span>
                    ) : 'Copy'}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneLight}
                language={language}
                PreTag="div"
                customStyle={{
                    margin: 0,
                    borderRadius: "0 0 8px 8px",
                    fontSize: "13px",
                    lineHeight: "1.5",
                }}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    );
}

export default function StreamingMarkdown({ content, isStreaming = false }: Props) {
    // Process content to handle streaming edge cases
    const processedContent = useMemo(() => {
        // Stage 1: Streaming Safety (Ensure unclosed fences are handled)
        let workingContent = content;
        if (isStreaming) {
            const lines = content.split('\n');
            let openFence: string | null = null;
            for (const line of lines) {
                const match = line.match(/^(?: {0,3})(`{3,}|~{3,})/);
                if (match) {
                    const fence = match[1];
                    if (openFence) {
                        if (fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
                    } else {
                        openFence = fence;
                    }
                }
            }
            if (openFence) {
                workingContent = content + (content.endsWith('\n') ? '' : '\n') + openFence;
            }
        }

        // Stage 2: Fragment & Block Merging (Consolidate adjacent blocks/fragments)
        const lines = workingContent.split('\n');
        const processedLines: string[] = [];

        // Match fragment line: ```content```
        const isFragment = (l: string) => {
            const m = l.trim().match(/^(`{3,})(.*)(\1)$/);
            return m ? m[2] : null;
        };
        // Match standard fence: ```language
        const getFence = (l: string) => {
            const m = l.match(/^( {0,3})(`{3,}|~{3,})([a-zA-Z0-9-]*)\s*$/);
            return m ? { indent: m[1], fence: m[2], lang: m[3] } : null;
        };

        let currentOpenFence: string | null = null;
        let blockBuffer: string[] = [];
        let whitespaceBuffer: string[] = [];
        let activeLanguage: string = "text";

        for (const line of lines) {
            const fragContent = isFragment(line);
            const fence = getFence(line);

            if (currentOpenFence) {
                // Inside standard block: looking for closer
                if (line.trim().startsWith(currentOpenFence)) {
                    currentOpenFence = null;
                } else {
                    blockBuffer.push(line);
                }
            } else if (fragContent !== null) {
                // Fragment found: buffer it (and any intermediate whitespace)
                blockBuffer.push(...whitespaceBuffer, fragContent);
                whitespaceBuffer = [];
            } else if (fence) {
                // Standard block start: enter buffer mode
                currentOpenFence = fence.fence;
                // If this is the first block in the buffer, capture its language
                if (blockBuffer.length === 0 && fence.lang) {
                    activeLanguage = fence.lang;
                }
                blockBuffer.push(...whitespaceBuffer);
                whitespaceBuffer = [];
            } else if (line.trim() === "") {
                whitespaceBuffer.push(line);
            } else {
                // Actual text: Break the merging chain and flush buffer
                if (blockBuffer.length > 0) {
                    processedLines.push('```' + activeLanguage, ...blockBuffer, '```');
                    blockBuffer = [];
                    activeLanguage = "text";
                }
                processedLines.push(...whitespaceBuffer, line);
                whitespaceBuffer = [];
            }
        }

        // Final flush
        if (blockBuffer.length > 0) {
            processedLines.push('```' + activeLanguage, ...blockBuffer, '```');
        }
        processedLines.push(...whitespaceBuffer);

        return processedLines.join('\n');
    }, [content, isStreaming]);

    return (
        <div className="streaming-markdown">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
                components={{
                    // Custom renderer for code blocks (both inline and fenced)
                    code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match && !className;

                        // Inline code styling
                        if (isInline) {
                            return (
                                <code
                                    className="inline-code"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }

                        // Fenced code block with syntax highlighting
                        const language = match ? match[1] : "text";

                        // Fix for streaming commas: join array children without separators
                        // react-markdown sometimes sends children as an array of text chunks
                        const codeString = Array.isArray(children)
                            ? children.join("").replace(/\n$/, "")
                            : String(children).replace(/\n$/, "");

                        return <CodeBlock language={language} codeString={codeString} />;
                    },
                    // Paragraph styling
                    p({ children }) {
                        return <p className="mb-3 last:mb-0">{children}</p>;
                    },
                    // Unordered list styling
                    ul({ children }) {
                        return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
                    },
                    // Ordered list styling
                    ol({ children }) {
                        return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
                    },
                    // Heading styling with appropriate hierarchy
                    h1({ children }) {
                        return <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>;
                    },
                    // Blockquote styling
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-3">
                                {children}
                            </blockquote>
                        );
                    },
                    // External link styling (opens in new tab)
                    a({ href, children }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                {children}
                            </a>
                        );
                    },
                    // Table container with horizontal scroll for responsiveness
                    table({ children }) {
                        return (
                            <div className="table-scroll-container">
                                <table className="markdown-table">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    thead({ children }) {
                        return <thead className="table-head">{children}</thead>;
                    },
                    tbody({ children }) {
                        return <tbody className="table-body">{children}</tbody>;
                    },
                    tr({ children }) {
                        return <tr className="table-row">{children}</tr>;
                    },
                    th({ children }) {
                        return <th className="table-header-cell">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="table-cell">{children}</td>;
                    },
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}