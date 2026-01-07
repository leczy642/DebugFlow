// components/chat/StreamingMarkdown.tsx
"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
    content: string;
    isStreaming?: boolean;
};

/**
 * StreamingMarkdown - Renders markdown content with syntax highlighting.
 * Handles incomplete code blocks gracefully during streaming.
 */
export default function StreamingMarkdown({ content, isStreaming = false }: Props) {
    // Memoize the processed content to avoid unnecessary re-renders
    const processedContent = useMemo(() => {
        if (!isStreaming) return content;

        // During streaming, check for incomplete code fences and close them temporarily
        // to prevent markdown parsing errors.
        const codeBlockRegex = /```/g;
        const matches = content.match(codeBlockRegex);
        const count = matches ? matches.length : 0;

        // If odd number of ```, the last code block is incomplete - add a closing fence
        if (count % 2 !== 0) {
            return content + "\n```";
        }

        return content;
    }, [content, isStreaming]);

    return (
        <div className="streaming-markdown">
            <ReactMarkdown
                components={{
                    // Custom renderer for code blocks
                    code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match && !className;

                        if (isInline) {
                            // Inline code styling
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
                                <div className="code-block-header">
                                    <span className="code-block-language">{language}</span>
                                    <button
                                        className="code-block-copy"
                                        onClick={() => navigator.clipboard.writeText(codeString)}
                                        title="Copy code"
                                    >
                                        Copy
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
                    },
                    // Paragraph styling
                    p({ children }) {
                        return <p className="mb-3 last:mb-0">{children}</p>;
                    },
                    // List styling
                    ul({ children }) {
                        return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
                    },
                    // Heading styling
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
                    // Link styling
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
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}
