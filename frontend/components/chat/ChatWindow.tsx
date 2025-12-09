// components/chat/ChatWindow.tsx
//This holds an array of messages and renders MessageBubble.
"use client";

import MessageBubble from "./MessageBubble";
import { useChatStore } from "../../lib/store/chatStore";

export default function ChatWindow() {
  const { messages } = useChatStore();

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto p-6"> {/* NEW container to match InputBar */}
        
        {messages.length === 0 && (
          <div className="text-gray-400 text-center mt-10">
            Start a new debug session...
          </div>
        )}

        {messages.map((msg, index) => (
          <MessageBubble
            key={index}
            role={msg.role}
            content={msg.content}
          />
        ))}
      </div>
    </div>
  );
}
