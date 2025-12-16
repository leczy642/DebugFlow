// components/chat/ChatWindow.tsx
//This holds an array of messages and renders MessageBubble.
"use client";

import MessageBubble from "./MessageBubble";
import { useEffect, useRef } from "react";
import { useChatStore } from "../../lib/store/chatStore";

export default function ChatWindow() {
  const { messages, currentSessionId } = useChatStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevLastRoleRef = useRef<string | null>(null);

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

  return (
    <div id="chat-scroll-container" ref={containerRef} className="flex-1 overflow-y-auto bg-white pt-12">
      <div className="max-w-4xl mx-auto p-6"> {/* NEW container to match InputBar */}
        {messages.map((msg, index) => (
          <MessageBubble
            key={index}
            role={msg.role}
            content={msg.content}
          />
        ))}

        {/* sentinel element to scroll to */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
