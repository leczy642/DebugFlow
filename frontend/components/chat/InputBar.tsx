// components/chat/InputBar.tsx
/**
 * InputBar.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders the chat input component used to type and send prompts.
 * The input bar can either:
 *   - float in the center when starting a new conversation, or
 *   - dock to the bottom of the chat window during an active session.
 *
 * ROLE IN PROJECT:
 * - Primary user entry point for interacting with the chat system
 * - Connects UI state (Zustand UI store) and chat logic (chatStore)
 *
 * WHAT THIS FILE DOES:
 * 1. Tracks input text locally
 * 2. Ensures a session exists before sending messages
 * 3. Moves input bar from center → docked once user sends a message
 * 4. Prevents sending while awaiting AI response
 *
 * INPUTS:
 * - User text typed into textarea
 *
 * OUTPUTS:
 * - Calls chatStore actions to create sessions and send messages
 * - Updates UI layout state (centered vs docked)
 *
 * IMPORTANT:
 * This component does NOT fetch messages directly.
 * It delegates all chat logic to Zustand stores.
 * -----------------------------------------------------------------------------
 */
"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "../../lib/store/chatStore";
import { useUIStore } from "../../lib/store/uiStore";
import { ArrowUpIcon, StopIcon } from "@heroicons/react/24/solid";

export default function InputBar() {
  const [text, setText] = useState("");

  // Chat store hooks
  const sendMessage = useChatStore((s) => s.sendMessage);
  const startNewSession = useChatStore((s) => s.startNewSession);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const awaitingSessionId = useChatStore((s) => s.awaitingSessionId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const stopGeneration = useChatStore((s) => s.stopGeneration);

  // UI store hooks
  const { inputBarCentered, dockInput, sidebarOpen } = useUIStore();

  const projects = useChatStore((s) => s.projects);
  const sessions = useChatStore((s) => s.sessions);
  const selectedProjectId = useChatStore((s) => s.selectedProjectId);
  const selectSession = useChatStore((s) => s.selectSession);

  // Clear the local input text when entering centered "new session" mode so the
  // input does not show stale text when a user starts a new session mid-response.
  useEffect(() => {
    if (inputBarCentered) setText("");
  }, [inputBarCentered]);

  // Clear input text when switching sessions
  useEffect(() => {
    setText("");
  }, [currentSessionId]);

  const isAwaitingResponse = (!!currentSessionId && awaitingSessionId === currentSessionId) || isStreaming;

  // Handle sending message
  const handleSend = async () => {
    if (!text.trim() || isAwaitingResponse) return;

    // Ensure a session exists
    if (!currentSessionId) {
      await startNewSession();
      // Optional: give Zustand state a microtick to update
      await new Promise((r) => setTimeout(r, 0));
    }

    // Dock input bar if centered
    if (inputBarCentered) {
      dockInput();
    }

    // Send message via chatStore
    // We clear text immediately to prevent blocking UI
    setText("");
    await sendMessage(text);
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
              disabled={isAwaitingResponse}
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
                disabled={!text.trim()}
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
                  <button
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    className="flex flex-col items-start p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left group"
                  >
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate w-full">
                      {session.title}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-1">
                      Added on {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'recently'}
                    </span>
                  </button>
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
          disabled={isAwaitingResponse}
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
            disabled={!text.trim()}
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
