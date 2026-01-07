// components/chat/ChatWindow.tsx
//This holds an array of messages and renders MessageBubble.
"use client";

import MessageBubble from "./MessageBubble";
import { useEffect, useRef, useState, useMemo } from "react";
import { ArrowDownIcon } from "@heroicons/react/24/solid";
import TypingBubble from "./TypingBubble";
import { useChatStore } from "../../lib/store/chatStore";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
};

export default function ChatWindow() {
  const { messages, currentSessionId, awaitingSessionId, regenerateResponse, deleteMessage, isStreaming } = useChatStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // State to track which version is selected for each parent node
  // Key: parentId (or 'root'), Value: selected messageId
  const [activeVersions, setActiveVersions] = useState<Record<string, string>>({});

  // Build the thread to display based on active versions
  const thread = useMemo(() => {
    if (!messages.length) return [];

    // Group by parentId
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

    // Start with roots
    let currentSiblings = roots;
    let parentIdKey = 'root';

    while (currentSiblings.length > 0) {
      // Determine which sibling is active
      // Default to the last one (most recent) if not set in state
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

      // Move to next level
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

  useEffect(() => {
    if (!currentSessionId) return;
    if (thread.length === 0) return;

    const last = thread[thread.length - 1].message;

    // Only auto-scroll when the last message is from the assistant
    if (last.role === "assistant") {
      const el = containerRef.current;
      if (!el) return;

      // If streaming, only auto-scroll if user is near the bottom
      if (isStreaming) {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (isNearBottom) {
          if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }
      } else {
        // If not streaming (e.g. initial load), force scroll to bottom
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
      }
    }
  }, [thread, currentSessionId, isStreaming]);

  // show/hide the scroll-to-bottom button based on scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const SCROLL_HIDE_THRESHOLD = 20; // px from bottom

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const shouldShow = distanceFromBottom > SCROLL_HIDE_THRESHOLD;
      setShowScrollButton(shouldShow);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // run once to set initial state
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div id="chat-scroll-container" ref={containerRef} className="flex-1 overflow-y-auto bg-white pt-12">
        <div className="max-w-4xl mx-auto p-6"> {/* NEW container to match InputBar */}
          {thread.map((item, index) => (
            <MessageBubble
              key={item.message.id || index}
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
          ))}

          {!!currentSessionId && awaitingSessionId === currentSessionId && <TypingBubble />}

          {/* sentinel element to scroll to */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* floating scroll-to-bottom button; positioned above the InputBar */}
      {showScrollButton && (
        <button
          aria-label="Scroll to bottom"
          onClick={() => {
            if (bottomRef.current) {
              bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
            } else if (containerRef.current) {
              containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
            }
          }}
          className="fixed right-6 z-50 bottom-24 bg-white border border-gray-200 shadow-lg p-2 rounded-full hover:scale-105 transition-transform"
        >
          <ArrowDownIcon className="h-5 w-5 text-gray-700" />
        </button>
      )}
    </>
  );
}
