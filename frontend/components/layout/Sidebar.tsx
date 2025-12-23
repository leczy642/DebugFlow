// components/layout/Sidebar.tsx
// components/layout/Sidebar.tsx
"use client";
import { useUIStore } from "../../lib/store/uiStore";
import { useChatStore } from "../../lib/store/chatStore";
import {
  Bars3Icon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import {
  BookmarkIcon as BookmarkIconSolid,
} from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import SessionActionsDropdown from "../chat/SessionActionsDropdown";
import RenameSessionModal from "../chat/RenameSessionModal";
import DeleteSessionModal from "../chat/DeleteSessionModal";

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, centerInput, dockInput, inputBarCentered } = useUIStore();
  const {
    sessions,
    loadSessions,
    startNewSession,
    selectSession,
    currentSessionId,
    renameSession,
    pinSession,
    unpinSession,
    deleteSession,
    lastUpdatedSessionId,
    resetToDefault,
  } = useChatStore();

  const handleNewSession = () => {
    // If already centered, do nothing
    if (inputBarCentered) return;

    // If docked, restore page to default state (center input, clear selection/messages)
    centerInput();
    resetToDefault();
  };

  const handleHeaderClick = () => {
    // If already centered, do nothing
    if (inputBarCentered) return;

    // If docked, center the input and restore default page state
    centerInput();
    resetToDefault();
  };

  const handleSelectSession = (id: string) => {
    selectSession(id);
  };

  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [dropdownSessionId, setDropdownSessionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ 
    top: 0, 
    right: 0, 
    above: false 
  });
  const [renameModal, setRenameModal] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const handleMoreOptions = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Estimate dropdown height (5 items + padding + borders ≈ 170px)
    const estimatedDropdownHeight = 170;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const gap = 4; // Gap between button and dropdown
    
    // Position above if there's not enough space below AND there's more space above
    const shouldPositionAbove = spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

    setDropdownPosition({
      top: shouldPositionAbove 
        ? rect.top + window.scrollY - estimatedDropdownHeight - gap
        : rect.bottom + window.scrollY + gap,
      right: window.innerWidth - rect.right - window.scrollX + gap - 25,
      above: shouldPositionAbove,
    });
    setDropdownSessionId(sessionId);
  };

  const handleRenameFromDropdown = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setRenameModal({ id: sessionId, title: session.title });
    }
    setDropdownSessionId(null);
  };

  const handleRenameConfirm = (newTitle: string) => {
    if (renameModal) {
      renameSession(renameModal.id, newTitle);
    }
    setRenameModal(null);
  };

  const handleDeleteFromDropdown = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setDeleteModal({ id: sessionId, title: session.title });
    }
    setDropdownSessionId(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteModal) {
      deleteSession(deleteModal.id);
    }
    setDeleteModal(null);
  };

  useEffect(() => {
    setDropdownSessionId(null);
  }, [sidebarOpen, currentSessionId]);

  // Dock the input bar when an existing session is selected
  useEffect(() => {
    if (currentSessionId) {
      dockInput();
    }
  }, [currentSessionId, dockInput]);

  // Load sessions from the server when the component mounts
  useEffect(() => {
    loadSessions().catch((err) => {
      // swallow - store will handle errors if necessary
      console.error("Failed to load sessions:", err);
    });
  }, [loadSessions]);

  // Refresh sessions whenever the sidebar is opened so user sees latest
  useEffect(() => {
    if (sidebarOpen) {
      loadSessions().catch((err) => console.error("Failed to refresh sessions:", err));
    }
  }, [sidebarOpen, loadSessions]);

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
          <button
            onClick={handleHeaderClick}
            className={`
              font-semibold text-[15px] text-[#1A1A1A] tracking-wide
              transition-all duration-200
              cursor-pointer hover:opacity-70
              ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}
            `}
          >
            DebugFlow
          </button>
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
              const isRecentlyUpdated = session.id === lastUpdatedSessionId;
              const showDots = isActive || isHovered;
              const isPinned = session.pinned || false;
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
                    ${isRecentlyUpdated ? " session-enter" : ""}
                  `}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  {/* Pin Icon - clickable to unpin */}
                  {isPinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unpinSession(session.id);
                      }}
                      className={`
                        p-1.5 mr-1
                        ${isActive ? "text-blue-700" : "text-[#606060]"}
                        hover:bg-[#EAEAEA] rounded
                        transition-colors duration-150
                      `}
                      aria-label="Unpin session"
                    >
                      <BookmarkIconSolid className="w-4 h-4" />
                    </button>
                  )}
                  
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
        <button
          onClick={handleNewSession}
          className="
            absolute top-3 left-20
            text-[15px] font-semibold text-[#1A1A1A]
            tracking-wide transition-opacity duration-300
            cursor-pointer hover:opacity-70
          "
        >
          DebugFlow
        </button>
      )}

      {/* ✅ SAFE: Only render dropdown when sessionId is not null */}
      {dropdownSessionId && (() => {
        const session = sessions.find(s => s.id === dropdownSessionId);
        return (
          <SessionActionsDropdown
            sessionId={dropdownSessionId}
            position={dropdownPosition}
            onClose={() => setDropdownSessionId(null)}
            onRename={handleRenameFromDropdown}
            onPin={pinSession}
            onUnpin={unpinSession}
            onDelete={handleDeleteFromDropdown}
            isPinned={session?.pinned || false}
          />
        );
      })()}

      {/* RENAME MODAL */}
      {renameModal && (
        <RenameSessionModal
          currentTitle={renameModal.title}
          onClose={() => setRenameModal(null)}
          onConfirm={handleRenameConfirm}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal && (
        <DeleteSessionModal
          sessionTitle={deleteModal.title}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}