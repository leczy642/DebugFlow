"use client";

import { useUIStore } from "../../lib/store/uiStore";
import { useChatStore } from "../../lib/store/chatStore";
import { Bars3Icon, Cog6ToothIcon } from "@heroicons/react/24/outline";

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { sessions, startNewSession, selectSession, currentSessionId } =
    useChatStore();

  return (
    <div className="relative">
      {/* SIDEBAR */}
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

        {/* NEW SESSION BUTTON */}
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
              flex items-center gap-2
            "
          >
            <span className="text-lg">+</span>

            <span
              className={`
                transition-all duration-200
                whitespace-nowrap
                ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}
              `}
            >
              New Debug Session
            </span>
          </button>
        </div>

        {/* SESSION HISTORY */}
        {/* SESSION HISTORY */}
{/* SESSION HISTORY */}
{/* SESSION HISTORY */}
{/* SESSION HISTORY */}
<div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
  {sessions.length === 0 && sidebarOpen && (
    <p className="text-[#999] text-sm">No history yet…</p>
  )}

  {sessions.map((session) => {
    const isActive = session.id === currentSessionId;

    return (
      <a
        key={session.id}
        onClick={() => selectSession(session.id)}
        className={`
          block cursor-pointer
          px-3 py-3 text-sm
          rounded-xl
          flex items-center
          transition-colors duration-200

          ${isActive 
            ? "bg-[#e4edfd] text-blue-700 shadow-md"   /* active state: no hover effect */
            : "bg-transparent text-[#1A1A1A] hover:bg-[#EAEAEA]"} /* idle state with hover */
        `}
      >
        {/* Collapsed mode (first 2 letters) */}
        {!sidebarOpen && (
          <span className="font-medium">{session.title.slice(0, 2)}</span>
        )}

        {/* Expanded mode (full title) */}
        <span
          className={`
            transition-all duration-200 ml-2
            ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}
          `}
        >
          {session.title}
        </span>
      </a>
    );
  })}
</div>






        {/* FOOTER */}
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

      {/* FLOATING TEXT WHEN COLLAPSED */}
      {!sidebarOpen && (
        <div
          className="
            absolute top-3 left-20
            text-[15px] font-semibold text-[#1A1A1A]
            tracking-wide transition-opacity duration-300
          "
        >
          DebugFlow
        </div>
      )}
    </div>
  );
}
