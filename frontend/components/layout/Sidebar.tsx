// components/layout/Sidebar.tsx
"use client";
import { useUIStore } from "../../lib/store/uiStore";
import { useChatStore } from "../../lib/store/chatStore";
import { Bars3Icon, Cog6ToothIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import SessionActionsDropdown from "../chat/SessionActionsDropdown";

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, centerInput, dockInput } = useUIStore();
  const { sessions, startNewSession, selectSession, currentSessionId } =
    useChatStore();

  const handleNewSession = () => {
    startNewSession();
    centerInput();
  };

  const handleSelectSession = (id: string) => {
    selectSession(id);
  };

  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [dropdownSessionId, setDropdownSessionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const handleMoreOptions = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
  
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right - window.scrollX + 4 - 25, // ← moved 25px right
    });
    setDropdownSessionId(sessionId);
  };

  // Close dropdown when sidebar state or session changes
  useEffect(() => {
    setDropdownSessionId(null);
  }, [sidebarOpen, currentSessionId]);

  return (
    <div className="relative flex h-full">
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
            onClick={handleNewSession}
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
        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {sessions.length === 0 && (
              <p className="text-[#999] text-sm">No history yet…</p>
            )}
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const isHovered = hoveredSessionId === session.id;
              const showDots = isActive || isHovered;
              const isTruncated = session.title.length > 22;
              const displayTitle = isTruncated
                ? session.title.slice(0, 22) + "…"
                : session.title;

              return (
                <div
                  key={session.id}
                  className={`
                    flex items-center
                    rounded-xl
                    transition-colors duration-200
                    ${isActive 
                      ? "bg-[#e4edfd]" 
                      : "bg-transparent"}
                    ${!isActive && "hover:bg-[#EAEAEA]"}
                  `}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  <a
                    onClick={() => selectSession(session.id)}
                    className={`
                      block cursor-pointer
                      px-3 py-2.5 text-sm
                      flex items-center
                      min-w-0
                      flex-1
                      ${isActive ? "text-blue-700" : "text-[#1A1A1A]"}
                    `}
                  >
                    <span 
                      className="font-medium truncate"
                      title={isTruncated ? session.title : undefined}
                    >
                      {displayTitle}
                    </span>
                  </a>
                  
                  {showDots && (
                    <button
                      onClick={(e) => handleMoreOptions(e, session.id)}
                      className={`
                        p-1.5
                        ${isActive ? "text-blue-700" : "text-[#606060]"}
                        transition-colors duration-150
                      `}
                      aria-label="More options"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* FOOTER */}
        <div className="mt-auto px-3 border-t border-[#E5E5E5] h-[83px]">
          <div className="h-full flex items-center justify-between">
            {sidebarOpen && <div className="text-sm text-[#1A1A1A]">Alex</div>}
            <button className="p-2 rounded-lg hover:bg-[#EAEAEA] transition">
              <Cog6ToothIcon className="w-5 h-5 text-[#606060]" />
            </button>
          </div>
        </div>
      </aside>

      {/* FLOATING DEBUGFLOW LOGO WHEN SIDEBAR IS CLOSED */}
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

      {/* SESSION ACTIONS DROPDOWN — BELOW THE THREE DOTS */}
      {dropdownSessionId && (
        <SessionActionsDropdown
          position={dropdownPosition}
          onClose={() => setDropdownSessionId(null)}
        />
      )}
    </div>
  );
}