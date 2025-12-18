// components/chat/ChatWindow.tsx
//This holds an array of messages and renders MessageBubble.
"use client";

import MessageBubble from "./MessageBubble";
import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "@heroicons/react/24/solid";
import TypingBubble from "./TypingBubble";
import { useChatStore } from "../../lib/store/chatStore";

export default function ChatWindow() {
  const { messages, currentSessionId } = useChatStore();
  const { awaitingResponse } = useChatStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevLastRoleRef = useRef<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (!currentSessionId) return;
    if (messages.length === 0) return;

    const last = messages[messages.length - 1];

    // Only auto-scroll when the last message is from the assistant
    if (last.role === "assistant") {
      // smooth scroll the bottom sentinel into view
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } else if (containerRef.current) {
        containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
      }
    }

    prevLastRoleRef.current = last.role;
  }, [messages, currentSessionId]);

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
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              role={msg.role}
              content={msg.content}
            />
          ))}

          {awaitingResponse && <TypingBubble />}

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
