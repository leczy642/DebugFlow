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

export default function StreamingMarkdown({ content, isStreaming = false }: Props) {
    // Process content to handle streaming edge cases
    const processedContent = useMemo(() => {
        if (!isStreaming) return content;

        // During streaming, check for incomplete code fences
        // Unclosed code blocks can break markdown parsing, so we temporarily close them
        const codeBlockRegex = /```/g;
        const matches = content.match(codeBlockRegex);
        const count = matches ? matches.length : 0;

        // If odd number of ```, the last code block is incomplete
        // Add a closing fence to prevent parsing errors
        if (count % 2 !== 0) {
            return content + "\n```";
        }

        return content;
    }, [content, isStreaming]);

    // State for copy feedback (currently shared across all code blocks in this component)
    // Note: This creates shared state - all code blocks show "Copied" when any is copied
    const [copied, setCopied] = useState(false);

    // Handle copying code to clipboard
    const handleCopy = (codeSnippet: string) => {
        navigator.clipboard.writeText(codeSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        const codeString = String(children).replace(/\n$/, "");

                        return (
                            <div className="code-block-wrapper">
                                {/* Code block header with language label and copy button */}
                                <div className="code-block-header">
                                    <span className="code-block-language">{language}</span>
                                    <button
                                        className="code-block-copy"
                                        onClick={() => handleCopy(codeString)}
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
                                {/* Syntax-highlighted code content */}
                                <SyntaxHighlighter
                                    style={oneLight} // Light theme syntax highlighting
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