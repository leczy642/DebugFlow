"use client";

import { useUIStore } from "../../lib/store/uiStore";
import { useChatStore } from "../../lib/store/chatStore";
import { Bars3Icon, Cog6ToothIcon } from "@heroicons/react/24/outline";

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { sessions, startNewSession, selectSession } = useChatStore();

  return (
    <aside
      className={`
        h-full flex flex-col transition-all duration-300
        ${sidebarOpen ? "w-64" : "w-16"}
        bg-[#F5F5F5] border-r border-[#E5E5E5]
      `}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <span
          className={`
            font-semibold text-[15px] text-[#1A1A1A] tracking-wide
            transition-all duration-200
            ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}
          `}
        >
          DebugFlow
        </span>

        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-[#EAEAEA] transition"
        >
          <Bars3Icon className="w-5 h-5 text-[#606060]" />
        </button>
      </div>

      {/* NEW SESSION BUTTON — DeepSeek Style */}
      <div className="p-3">
        <button
          onClick={startNewSession}
          className="
            w-full bg-white text-[#1A1A1A]
            p-3 rounded-xl text-sm
            border border-[#E5E5E5]
            shadow-sm
            hover:shadow-md hover:bg-[#FAFAFA]
            transition-all duration-200
          "
        >
          + New Debug Session
        </button>
      </div>

      {/* SESSION HISTORY */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sessions.length === 0 && sidebarOpen && (
          <p className="text-[#999] text-sm">No history yet…</p>
        )}

        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => selectSession(session.id)}
            className="
              w-full text-left bg-white text-[#1A1A1A]
              px-3 py-3 rounded-xl text-sm
              border border-[#E5E5E5]
              shadow-sm
              hover:shadow-md hover:bg-[#FAFAFA]
              transition-all duration-200
              cursor-pointer
            "
          >
            {sidebarOpen ? session.title : session.title.slice(0, 2)}
          </button>
        ))}
      </div>

      {/* FOOTER — DeepSeek Style */}
      <div className="px-4 py-4 border-t border-[#E5E5E5] flex items-center justify-between">
        <div
          className={`
            text-sm text-[#1A1A1A]
            transition-all duration-300
            ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}
          `}
        >
          Alex
        </div>

        <button className="p-2 rounded-lg hover:bg-[#EAEAEA] transition">
          <Cog6ToothIcon className="w-5 h-5 text-[#606060]" />
        </button>
      </div>
    </aside>
  );
}
