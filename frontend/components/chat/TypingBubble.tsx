"use client";
import React from "react";

export default function TypingBubble() {
  return (
    <div className="flex items-start mb-3">
      <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-2xl inline-flex items-center">
        <span className="dot h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse" style={{ animationDelay: "0s" }} />
        <span className="dot h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="dot h-2 w-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
