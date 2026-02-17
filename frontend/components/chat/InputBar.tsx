// components/chat/InputBar.tsx
"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "../../lib/store/chatStore";
import { useUIStore } from "../../lib/store/uiStore";
import { ArrowUpIcon, StopIcon } from "@heroicons/react/24/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import SessionActionsDropdown from "./SessionActionsDropdown";
import { useAuth } from "@/lib/hooks/useAuth";

export default function InputBar() {
    const [text, setText] = useState("");

    // Chat store hooks
    const sendMessage = useChatStore((s) => s.sendMessage);
    const startNewSession = useChatStore((s) => s.startNewSession);
    const pendingSession = useChatStore((s) => s.pendingSession);
    const currentSessionId = useChatStore((s) => s.currentSessionId);
    const awaitingSessionId = useChatStore((s) => s.awaitingSessionId);
    const isStreaming = useChatStore((s) => s.isStreaming);
    const stopGeneration = useChatStore((s) => s.stopGeneration);

    // UI store hooks
    const {
        inputBarCentered, dockInput, sidebarOpen,
        openRenameSession, openDeleteSession, openAddToProject
    } = useUIStore();

    const rateLimitedUntil = useChatStore((s) => s.rateLimitedUntil);
    const clearRateLimit = useChatStore((s) => s.clearRateLimit);
    const [hoursLeft, setHoursLeft] = useState<number | null>(null);

    const projects = useChatStore((s) => s.projects);
    const sessions = useChatStore((s) => s.sessions);
    const selectedProjectId = useChatStore((s) => s.selectedProjectId);
    const selectSession = useChatStore((s) => s.selectSession);
    const pinSession = useChatStore((s) => s.pinSession);
    const unpinSession = useChatStore((s) => s.unpinSession);
    const assignSessionToProject = useChatStore((s) => s.assignSessionToProject);

    const [dropdownSessionId, setDropdownSessionId] = useState<string | null>(null);
    const [dropdownAbove, setDropdownAbove] = useState(false);

    // Rate Limit Countdown & Auto-Clear
    useEffect(() => {
        if (!rateLimitedUntil) {
            setHoursLeft(null);
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const resetAt = new Date(rateLimitedUntil);
            const msRemaining = resetAt.getTime() - now.getTime();

            if (msRemaining <= 0) {
                clearRateLimit();
                setHoursLeft(null);
            } else {
                setHoursLeft(Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60))));
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000 * 60); // Update every minute
        return () => clearInterval(interval);
    }, [rateLimitedUntil, clearRateLimit]);

    const { user, isAdmin, isSuperUser, isAuthenticated, loading: authLoading } = useAuth();

    // Initial check on mount for redundancy
    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            useChatStore.getState().checkUsage();
        }
    }, [isAuthenticated, authLoading]);

    // Clear the local input text when entering centered mode
    useEffect(() => {
        if (inputBarCentered) setText("");
    }, [inputBarCentered]);

    // Clear input text when switching sessions
    useEffect(() => {
        setText("");
    }, [currentSessionId]);

    const isAwaitingResponse = pendingSession || (!!currentSessionId && awaitingSessionId === currentSessionId) || isStreaming;

    // Handle sending message
    const handleSend = async () => {
        if (!text.trim() || isAwaitingResponse) return;

        const messageContent = text.trim();

        // INSTANT UI FEEDBACK: Clear input and dock the bar immediately
        setText("");
        if (inputBarCentered) {
            dockInput();
        }

        // Intercept "continue" command
        if (messageContent.toLowerCase() === "continue") {
            const lastMessage = useChatStore.getState().getLastActiveMessage();

            if (lastMessage?.role === "assistant" && !lastMessage.content.startsWith("⚠️")) {
                await sendMessage("continue", lastMessage.id, true, true);
                return;
            } else if (lastMessage?.role === "user") {
                await sendMessage(lastMessage.content, lastMessage.id, true, false);
                return;
            }
        }

        // Send message with selectedProjectId (in case a new session needs to be created)
        await sendMessage(messageContent, undefined, false, false, selectedProjectId);
    };

    const handleMoreOptions = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();

        // Try to base positioning on the whole session card
        const button = e.currentTarget as HTMLElement;
        const card = button.closest("[data-session-card]") as HTMLElement | null;
        const rect = (card ?? button).getBoundingClientRect();

        const estimatedDropdownHeight = 180;
        const gap = 6;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldFlipAbove =
            spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

        setDropdownAbove(shouldFlipAbove);
        setDropdownSessionId(sessionId);
    };

    const handleRenameFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openRenameSession(sessionId, session.title);
        }
        setDropdownSessionId(null);
    };

    const handleDeleteFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openDeleteSession(sessionId, session.title);
        }
        setDropdownSessionId(null);
    };

    const handleAddToProjectFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openAddToProject(sessionId, session.project_id);
        }
        setDropdownSessionId(null);
    };

    /* -----------------------------
       CENTERED MODE (NEW SESSION)
    ----------------------------- */
    if (inputBarCentered) {
        const sidebarWidth = sidebarOpen ? 256 : 64;
        const availableWidth = `calc(100% - ${sidebarWidth}px)`;

        const selectedProject = projects.find(p => p.id === selectedProjectId);
        const projectSessions = sessions.filter(s => s.project_id === selectedProjectId);

        return (
            <div
                className="fixed top-1/2 -translate-y-1/2 transition-all duration-300"
                style={{ left: `${sidebarWidth}px`, width: availableWidth }}
            >
                <div className="max-w-4xl mx-auto px-4">
                    {selectedProject ? (
                        <div className="flex items-center gap-3 mb-6 justify-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>
                            <h1 className="text-gray-900 text-3xl font-semibold">
                                {selectedProject.name}
                            </h1>
                        </div>
                    ) : (
                        <h1 className="text-gray-500 text-3xl font-medium text-center mb-6">
                            Start a new debug session.
                        </h1>
                    )}

                    <div className="relative">
                        {rateLimitedUntil && (
                            <div className="absolute -bottom-12 left-0 animate-in fade-in slide-in-from-top-2 duration-300 z-50 w-full flex justify-start">
                                <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>You have reached your usage limit, please try again after <strong>{hoursLeft || '1'} hours</strong></span>
                                </div>
                            </div>
                        )}
                        <textarea
                            className="w-full min-h-[110px] max-h-64 resize-none
                         border border-gray-300 rounded-xl
                         py-3 px-4 bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ask something… paste logs… describe an error…"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={isAwaitingResponse || !!rateLimitedUntil || pendingSession}
                        />

                        {isAwaitingResponse ? (
                            <button
                                onClick={stopGeneration}
                                className="absolute right-2 bottom-0 -translate-y-1/2
                           bg-[#606060] text-white p-2 rounded-lg
                           hover:bg-[#4a4a4a]"
                            >
                                <StopIcon className="h-5 w-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!text.trim() || !!rateLimitedUntil}
                                className="absolute right-2 bottom-0 -translate-y-1/2
                           bg-blue-600 text-white p-2 rounded-lg
                           hover:bg-blue-700 disabled:bg-gray-300"
                            >
                                <ArrowUpIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {selectedProject && projectSessions.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Recent Sessions in this Project
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {projectSessions.slice(0, 6).map((session) => (
                                    <div
                                        key={session.id}
                                        data-session-card
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all group relative cursor-pointer"
                                        onClick={() => selectSession(session.id)}
                                    >
                                        <div className="flex flex-col items-start min-w-0 flex-1">
                                            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate w-full">
                                                {session.title}
                                            </span>
                                            <span className="text-[11px] text-gray-400 mt-1">
                                                Added on {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'recently'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => handleMoreOptions(e, session.id)}
                                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 group-hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <EllipsisVerticalIcon className="w-5 h-5" />
                                        </button>

                                        {dropdownSessionId === session.id && (() => {
                                            const fullSession = sessions.find(s => s.id === session.id);
                                            return (
                                                <SessionActionsDropdown
                                                    sessionId={session.id}
                                                    position={{ top: 0, above: dropdownAbove }}
                                                    anchorToParent
                                                    onClose={() => setDropdownSessionId(null)}
                                                    onRename={handleRenameFromDropdown}
                                                    onPin={pinSession}
                                                    onUnpin={unpinSession}
                                                    onDelete={handleDeleteFromDropdown}
                                                    onAddToProject={handleAddToProjectFromDropdown}
                                                    onRemoveFromProject={(id) => assignSessionToProject(id, null)}
                                                    isPinned={!!fullSession?.pinned}
                                                    isInProject={!!fullSession?.project_id}
                                                />
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* -----------------------------
       DOCKED MODE (ACTIVE CHAT)
    ----------------------------- */
    return (
        <div className="p-4 bg-white">
            <div className="relative max-w-4xl mx-auto">
                {rateLimitedUntil && (
                    <div className="absolute -top-12 left-0 animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
                        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>You have reached your usage limit, please try again after <strong>{hoursLeft || '1'} hours</strong></span>
                        </div>
                    </div>
                )}
                <textarea
                    className="w-full min-h-[110px] border border-gray-300 rounded-xl
                     py-3 pl-4 pr-12 bg-gray-50 resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ask something… paste logs… describe an error…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    disabled={isAwaitingResponse || !!rateLimitedUntil || pendingSession}
                />

                {isAwaitingResponse ? (
                    <button
                        onClick={stopGeneration}
                        className="absolute right-2 top-1/2 -translate-y-1/2
                       bg-[#606060] text-white p-2 rounded-lg
                       hover:bg-[#4a4a4a]"
                    >
                        <StopIcon className="h-5 w-5" />
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || !!rateLimitedUntil}
                        className="absolute right-2 bottom-0 -translate-y-1/2
                       bg-blue-600 text-white p-2 rounded-lg
                       hover:bg-blue-700 disabled:bg-gray-300"
                    >
                        <ArrowUpIcon className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
}
