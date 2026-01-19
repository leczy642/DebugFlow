// components/chat/ChatWindow.tsx
//This holds an array of messages and renders MessageBubble.

// components/chat/ChatWindow.tsx
/**
 * ChatWindow.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders the main chat interface displaying message history and thread navigation.
 * Manages complex thread structures with branching conversations where users
 * can select between different response versions at each branching point.
 *
 * ROLE IN PROJECT:
 * - Primary visualization component for chat history and message threads
 * - Handles complex thread navigation and version selection
 * - Manages auto-scrolling behavior during streaming responses
 * - Coordinates with MessageBubble components for message interactions
 *
 * WHAT THIS FILE DOES:
 * 1. Builds thread structure from flat message list using parent-child relationships
 * 2. Manages state for active version selection at each branching point
 * 3. Handles auto-scrolling logic during streaming and message updates
 * 4. Provides scroll-to-bottom functionality for long conversations
 * 5. Renders message bubbles with version selection controls
 *
 * INPUTS:
 * - Messages from chatStore (including thread relationships)
 * - User interactions (version selection, scrolling)
 * - Streaming state to manage auto-scroll behavior
 *
 * OUTPUTS:
 * - Visual representation of chat history with thread navigation
 * - Scroll position management
 * - User interactions forwarded to chatStore (regenerate, delete, edit, restore)
 *
 * IMPORTANT:
 * This component handles complex thread reconstruction from flat message data.
 * It maintains separate UI state for active version selection while delegating
 * message operations to the chatStore.
 * -----------------------------------------------------------------------------
 */
"use client";

import MessageBubble from "./MessageBubble";
import { useEffect, useRef, useState, useMemo } from "react";
import { ArrowDownIcon } from "@heroicons/react/24/solid";
import TypingBubble from "./TypingBubble";
import { useChatStore } from "../../lib/store/chatStore";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  isDeleted?: boolean;
};

export default function ChatWindow() {
  const {
    messages,
    currentSessionId,
    awaitingSessionId,
    loadingSessionId,
    regenerateResponse,
    deleteMessage,
    isStreaming
  } = useChatStore();

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  // State to track which version is selected for each parent node
  const [activeVersions, setActiveVersions] = useState<Record<string, string>>({});
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const handleLinkClick = (id: string) => {
    const index = thread.findIndex(t => t.message.id === id);
    if (index !== -1 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index,
        align: 'center',
        behavior: 'smooth'
      });
      setActiveLinkId(id);
    }
  };

  // Build the thread to display based on active versions
  const thread = useMemo(() => {
    if (!messages.length) return [];

    const childrenMap = new Map<string, Message[]>();
    const roots: Message[] = [];

    messages.forEach(m => {
      if (m.parentId) {
        if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
        childrenMap.get(m.parentId)!.push(m);
      } else {
        roots.push(m);
      }
    });

    const result: { message: Message; siblings: Message[]; index: number; parentIdKey: string }[] = [];
    let currentSiblings = roots;
    let parentIdKey = 'root';

    while (currentSiblings.length > 0) {
      const activeId = activeVersions[parentIdKey];
      let activeIndex = -1;

      if (activeId) {
        activeIndex = currentSiblings.findIndex(m => m.id === activeId);
      }

      if (activeIndex === -1) {
        activeIndex = currentSiblings.length - 1;
      }

      const activeMessage = currentSiblings[activeIndex];
      result.push({
        message: activeMessage,
        siblings: currentSiblings,
        index: activeIndex,
        parentIdKey
      });

      if (activeMessage.id && childrenMap.has(activeMessage.id)) {
        currentSiblings = childrenMap.get(activeMessage.id)!;
        parentIdKey = activeMessage.id;
      } else {
        currentSiblings = [];
      }
    }

    return result;
  }, [messages, activeVersions]);

  const handleSelectVersion = (parentIdKey: string, messageId: string) => {
    setActiveVersions(prev => ({
      ...prev,
      [parentIdKey]: messageId
    }));
  };

  // Auto-scroll logic for Virtuoso
  useEffect(() => {
    if (isStreaming && atBottom && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: thread.length - 1,
        behavior: 'auto'
      });
    }
  }, [thread.length, isStreaming, atBottom]);

  // Handle initial scroll or session switch
  useEffect(() => {
    if (currentSessionId && thread.length > 0 && !isStreaming) {
      // Small timeout to ensure Virtuoso has rendered
      const timer = setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: thread.length - 1,
          behavior: 'auto'
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentSessionId, thread.length === 0]); // Trigger on session change or if thread first appears

  const isLoading = currentSessionId && loadingSessionId === currentSessionId;

  return (
    <>
      <div id="chat-scroll-container" className="flex-1 bg-white pt-12 relative h-full">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-500">Loading messages...</span>
            </div>
          </div>
        )}

        <Virtuoso
          ref={virtuosoRef}
          data={thread}
          className="h-full"
          initialTopMostItemIndex={thread.length > 0 ? thread.length - 1 : 0}
          atBottomStateChange={(bottom) => {
            setAtBottom(bottom);
            setShowScrollButton(!bottom);
          }}
          atBottomThreshold={200}
          increaseViewportBy={400}
          itemContent={(index, item) => (
            <div className={`max-w-4xl mx-auto px-6 ${index === 0 ? 'pt-6' : ''}`}>
              <MessageBubble
                key={item.message.id || index}
                id={item.message.id ? `msg-${item.message.id}` : undefined}
                message={item.message}
                siblings={item.siblings}
                currentVersionIndex={item.index}
                onSelectVersion={(idx) => {
                  const selectedMsg = item.siblings[idx];
                  if (selectedMsg && selectedMsg.id) {
                    handleSelectVersion(item.parentIdKey, selectedMsg.id);
                  }
                }}
                onRegenerate={item.message.id ? () => regenerateResponse(item.message.id!) : undefined}
                onDelete={item.message.id ? () => deleteMessage(item.message.id!) : undefined}
                onEdit={item.message.id ? (newContent) => useChatStore.getState().editMessage(item.message.id!, newContent) : undefined}
                onRestore={item.message.id ? () => useChatStore.getState().restoreMessage(item.message.id!) : undefined}
                isStreaming={isStreaming}
              />
            </div>
          )}
          components={{
            Footer: () => (
              <div className="max-w-4xl mx-auto px-6 pb-32">
                {!!currentSessionId && awaitingSessionId === currentSessionId && <TypingBubble />}
              </div>
            )
          }}
        />
      </div>

      {/* Conversation Navigation Links */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
        {thread.filter(t => t.message.role === 'user' && !t.message.isDeleted).map(t => (
          <div
            key={t.message.id}
            onClick={() => t.message.id && handleLinkClick(t.message.id)}
            className={`
              h-[3px] rounded-full cursor-pointer transition-all duration-200 relative group/link
              ${t.message.id === activeLinkId ? 'bg-blue-600' : 'bg-[#d0d3d9] hover:bg-[#1A1A1A]'}
              w-[10px] hover:w-[15px]
            `}
          >
            {/* Tooltip */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/link:opacity-100 transition-opacity whitespace-pre shadow-sm pointer-events-none">
              {t.message.content.slice(0, 26)}...
            </div>
          </div>
        ))}
      </div>

      {/* floating scroll-to-bottom button */}
      {showScrollButton && (
        <button
          aria-label="Scroll to bottom"
          onClick={() => {
            virtuosoRef.current?.scrollToIndex({
              index: thread.length - 1,
              behavior: 'smooth'
            });
          }}
          className="fixed right-6 z-50 bottom-24 bg-white border border-gray-200 shadow-lg p-2 rounded-full hover:scale-105 transition-transform"
        >
          <ArrowDownIcon className="h-5 w-5 text-gray-700" />
        </button>
      )}
    </>
  );
}
