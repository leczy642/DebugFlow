"use client";
import React from "react";
import { useChatStore } from "@/lib/store/chatStore";
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  SparklesIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

export default function TypingBubble() {
  const streamingStatus = useChatStore((state) => state.streamingStatus);

  const getStatusConfig = () => {
    switch (streamingStatus) {
      case "searching":
        return {
          icon: <MagnifyingGlassIcon className="w-4 h-4 animate-bounce" />,
          label: "Searching the web...",
          bgColor: "bg-blue-50 text-blue-600 border-blue-100",
          iconColor: "text-blue-500"
        };
      case "reading":
        return {
          icon: <BookOpenIcon className="w-4 h-4 animate-pulse" />,
          label: "Reading results...",
          bgColor: "bg-purple-50 text-purple-600 border-purple-100",
          iconColor: "text-purple-500"
        };
      case "generating":
        return {
          icon: <SparklesIcon className="w-4 h-4 animate-spin-slow" />,
          label: "Generating response...",
          bgColor: "bg-indigo-50 text-indigo-600 border-indigo-100",
          iconColor: "text-indigo-500"
        };
      default:
        return {
          icon: <ArrowPathIcon className="w-4 h-4 animate-spin" />,
          label: "Thinking...",
          bgColor: "bg-gray-50 text-gray-500 border-gray-100",
          iconColor: "text-gray-400"
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`
        inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-sm
        transition-all duration-500 ease-in-out relative overflow-hidden
        ${config.bgColor}
      `}>
        <div className={config.iconColor}>
          {config.icon}
        </div>
        <span className="text-sm font-semibold tracking-tight">
          {config.label}
        </span>

        {/* Subtle shimmer effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
}