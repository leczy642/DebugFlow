// components/chat/StreamingMarkdown.tsx
/**
 * StreamingMarkdown.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders markdown content from AI responses with rich formatting and syntax highlighting.
 * Special handling for streaming content ensures incomplete code blocks are displayed
 * gracefully without breaking the markdown parser.
 *
 * Also renders:
 * - Inline citation badges [1], [2] as small styled circles
 * - A collapsible reference pill at the bottom when search sources are provided
 * -----------------------------------------------------------------------------
 */

"use client";

import { useMemo, useState, Children, isValidElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type Source = {
    index: number;
    title: string;
    url: string;
};

type Props = {
    content: string;
    isStreaming?: boolean;
    sources?: Source[];
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

/**
 * CitationBadge — renders a small superscript circle with the citation number.
 */
function CitationBadge({ num, url }: { num: number; url?: string }) {
    const badge = (
        <span
            className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors align-super mx-[1px] leading-none"
            title={url ? `Source ${num}: ${url}` : `Source ${num}`}
        >
            {num}
        </span>
    );

    if (url) {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="no-underline">
                {badge}
            </a>
        );
    }
    return badge;
}

/**
 * ReferencePill — collapsible pill showing all web sources consulted.
 */
function ReferencePill({ sources }: { sources: Source[] }) {
    const [expanded, setExpanded] = useState(false);

    const getDomain = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    return (
        <div className="mt-4 mb-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
            >
                <span>🌐</span>
                <span>{sources.length} web page{sources.length !== 1 ? 's' : ''}</span>
                <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                    {sources.map((source) => (
                        <a
                            key={source.index}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors no-underline group"
                        >
                            <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200 mt-0.5">
                                {source.index}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                    {source.title}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5 truncate">
                                    {getDomain(source.url)}
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Recursively processes React children to replace [1], [2], etc. citation markers
 * with CitationBadge components.
 */
function processCitations(children: ReactNode, sources?: Source[]): ReactNode {
    return Children.map(children, (child) => {
        if (typeof child === 'string') {
            // Split on citation patterns like [1], [2], [3]
            const parts = child.split(/(\[\d+\])/g);
            if (parts.length === 1) return child; // No citations found

            return parts.map((part, i) => {
                const citationMatch = part.match(/^\[(\d+)\]$/);
                if (citationMatch) {
                    const num = parseInt(citationMatch[1], 10);
                    const source = sources?.find(s => s.index === num);
                    return <CitationBadge key={`cite-${i}`} num={num} url={source?.url} />;
                }
                return part;
            });
        }

        if (isValidElement(child) && child.props?.children) {
            // Recursively process children of React elements
            const newChildren = processCitations(child.props.children, sources);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { ...child, props: { ...child.props, children: newChildren } } as any;
        }

        return child;
    });
}

export default function StreamingMarkdown({ content, isStreaming = false, sources }: Props) {
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
            const m = l.trim().match(/^(`{3,})(.*)\1$/);
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
                    // Paragraph styling — with citation badge injection
                    p({ children }) {
                        const processed = sources ? processCitations(children, sources) : children;
                        return <p className="mb-3 last:mb-0">{processed}</p>;
                    },
                    // List item styling — with citation badge injection
                    li({ children }) {
                        const processed = sources ? processCitations(children, sources) : children;
                        return <li>{processed}</li>;
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

            {/* Reference Pill — shown after the response when sources exist */}
            {sources && sources.length > 0 && !isStreaming && (
                <ReferencePill sources={sources} />
            )}
        </div>
    );
}