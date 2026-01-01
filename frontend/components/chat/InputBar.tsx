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
import { ArrowUpIcon } from "@heroicons/react/24/solid";

export default function InputBar() {
  const [text, setText] = useState("");

  // Chat store hooks
  const sendMessage = useChatStore((s) => s.sendMessage);
  const startNewSession = useChatStore((s) => s.startNewSession);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const awaitingSessionId = useChatStore((s) => s.awaitingSessionId);

  // UI store hooks
  const { inputBarCentered, dockInput, sidebarOpen } = useUIStore();

  // Clear the local input text when entering centered "new session" mode so the
  // input does not show stale text when a user starts a new session mid-response.
  useEffect(() => {
    if (inputBarCentered) setText("");
  }, [inputBarCentered]);

  // Clear input text when switching sessions
  useEffect(() => {
    setText("");
  }, [currentSessionId]);

  const isAwaitingResponse = !!currentSessionId && awaitingSessionId === currentSessionId;

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
    await sendMessage(text);
    setText("");
  };

  /* -----------------------------
     CENTERED MODE (NEW SESSION)
  ----------------------------- */
  if (inputBarCentered) {
    const sidebarWidth = sidebarOpen ? 256 : 64;
    const availableWidth = `calc(100% - ${sidebarWidth}px)`;

    return (
      <div
        className="fixed top-1/2 -translate-y-1/2 transition-all duration-300"
        style={{ left: `${sidebarWidth}px`, width: availableWidth }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-gray-500 text-3xl font-medium text-center mb-6">
            Start a new debug session.
          </h1>

          <div className="relative">
            <textarea
              className="w-full min-h-[100px] max-h-40 resize-none
                         border border-gray-300 rounded-xl
                         py-3 px-4 bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         placeholder:text-gray-500 text-gray-800 text-sm"
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

            <button
              onClick={handleSend}
              disabled={!text.trim() || isAwaitingResponse}
              className="absolute right-2 bottom-0 -translate-y-1/2
                         bg-blue-600 text-white p-2 rounded-lg
                         hover:bg-blue-700 disabled:bg-gray-300"
            >
              <ArrowUpIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -----------------------------
     DOCKED MODE (ACTIVE CHAT)
  ----------------------------- */
  return (
    <div className="p-4 border-t bg-white">
      <div className="relative max-w-4xl mx-auto">
        <textarea
          className="w-full border border-gray-300 rounded-xl
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

        <button
          onClick={handleSend}
          disabled={!text.trim() || isAwaitingResponse}
          className="absolute right-2 top-1/2 -translate-y-1/2
                     bg-blue-600 text-white p-2 rounded-lg
                     hover:bg-blue-700 disabled:bg-gray-300"
        >
          <ArrowUpIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
