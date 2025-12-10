// components/chat/MessageBubble.tsx
//This displays a single message (user or AI).
"use client";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export default function MessageBubble({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex my-3 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[100%] p-3 rounded-lg whitespace-pre-wrap 
          ${isUser ? "bg-sky-100 text-gray-900 text-left max-w-[90%]" : "bg-gray-0 text-gray-900 text-left max-w-[100%]"}
          `}>
        {content}
      </div>
    </div>
  );
}
