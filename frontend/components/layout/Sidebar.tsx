// components/layout/Sidebar.tsx
// components/layout/Sidebar.tsx
"use client";
import { useUIStore } from "../../lib/store/uiStore";
import { useChatStore } from "../../lib/store/chatStore";
import {
  Bars3Icon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  BookmarkIcon as BookmarkIconSolid,
} from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import SessionActionsDropdown from "../chat/SessionActionsDropdown";
import RenameSessionModal from "../chat/RenameSessionModal";
import DeleteSessionModal from "../chat/DeleteSessionModal";
import NewProjectModal from "../chat/NewProjectModal";
import AddToProjectModal from "../chat/AddToProjectModal";
import ProjectActionsDropdown from "../chat/ProjectActionsDropdown";
import RenameProjectModal from "../chat/RenameProjectModal";
import DeleteProjectModal from "../chat/DeleteProjectModal";
import SettingsPopup from "./SettingsPopup";
import { useAuth } from "@/lib/hooks/useAuth";

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, centerInput, dockInput, inputBarCentered } = useUIStore();
  const { user } = useAuth();

  // Extract first name or fallback to "User"
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'User';

  const {
    sessions,
    projects,
    loadSessions,
    loadProjects,
    createProject,
    assignSessionToProject,
    renameProject,
    deleteProject,
    // startNewSession, // Unused
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

  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [dropdownSessionId, setDropdownSessionId] = useState<string | null>(null);

  // Project Dropdown State
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [dropdownProjectId, setDropdownProjectId] = useState<string | null>(null);

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
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [addToProjectModal, setAddToProjectModal] = useState<{
    sessionId: string;
    currentProjectId?: string | null;
  } | null>(null);

  // Project Modals State
  const [renameProjectModal, setRenameProjectModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteProjectModal, setDeleteProjectModal] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Track expanded state of project folders
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectsListExpanded, setProjectsListExpanded] = useState(true);
  const [historyListExpanded, setHistoryListExpanded] = useState(true);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const [settingsPopupPosition, setSettingsPopupPosition] = useState({ bottom: 0, left: 0 });

  const handleMoreOptions = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();

    // Estimate dropdown height
    const estimatedDropdownHeight = 170;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const gap = 4;

    const shouldPositionAbove = spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

    setDropdownPosition({
      top: shouldPositionAbove
        ? rect.top + window.scrollY - estimatedDropdownHeight - gap
        : rect.bottom + window.scrollY + gap,
      right: window.innerWidth - rect.right - window.scrollX + gap - 25,
      above: shouldPositionAbove,
    });
    setDropdownSessionId(sessionId);
    setDropdownProjectId(null); // Ensure only one dropdown is open
  };

  const handleProjectMoreOptions = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();

    // Estimate dropdown height
    const estimatedDropdownHeight = 90; // Rename + Delete
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const gap = 4;

    const shouldPositionAbove = spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

    setDropdownPosition({
      top: shouldPositionAbove
        ? rect.top + window.scrollY - estimatedDropdownHeight - gap
        : rect.bottom + window.scrollY + gap,
      right: window.innerWidth - rect.right - window.scrollX + gap - 25,
      above: shouldPositionAbove,
    });
    setDropdownProjectId(projectId);
    setDropdownSessionId(null); // Ensure only one dropdown is open
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

  const handleAddToProjectFromDropdown = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setAddToProjectModal({ sessionId, currentProjectId: session.project_id });
    }
    setDropdownSessionId(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteModal) {
      deleteSession(deleteModal.id);
    }
    setDeleteModal(null);
  };

  const handleRenameProjectTrigger = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setRenameProjectModal({ id: projectId, name: project.name });
    }
    setDropdownProjectId(null);
  };

  const handleRenameProjectConfirm = (newName: string) => {
    if (renameProjectModal) {
      renameProject(renameProjectModal.id, newName);
    }
    setRenameProjectModal(null);
  };

  const handleDeleteProjectTrigger = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setDeleteProjectModal({ id: projectId, name: project.name });
    }
    setDropdownProjectId(null);
  };

  const handleDeleteProjectConfirm = () => {
    if (deleteProjectModal) {
      deleteProject(deleteProjectModal.id);
    }
    setDeleteProjectModal(null);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();

    const sidebar = button.closest('aside');
    const sidebarRect = sidebar?.getBoundingClientRect();

    setSettingsPopupPosition({
      bottom: window.innerHeight - rect.top + 8,
      left: sidebarRect ? sidebarRect.left + 12 : rect.left,
    });
    setSettingsPopupOpen(!settingsPopupOpen);
  };

  useEffect(() => {
    setDropdownSessionId(null);
    setDropdownProjectId(null);
  }, [sidebarOpen, currentSessionId]);

  // Dock the input bar when an existing session is selected
  useEffect(() => {
    if (currentSessionId) {
      dockInput();
    }
  }, [currentSessionId, dockInput]);

  // Load sessions and projects from the server when the component mounts
  useEffect(() => {
    loadSessions().catch((err) => {
      console.error("Failed to load sessions:", err);
    });
    loadProjects().catch((err) => {
      console.error("Failed to load projects:", err);
    });
  }, [loadSessions, loadProjects]);

  useEffect(() => {
    if (sidebarOpen) {
      loadSessions().catch((err) => console.error("Failed to refresh sessions:", err));
      loadProjects().catch((err) => console.error("Failed to refresh projects:", err));
    }
  }, [sidebarOpen, loadSessions, loadProjects]);

  // Group sessions by project
  const sessionsInProjects = new Map<string, typeof sessions>();
  const unassignedSessions = sessions.filter(s => !s.project_id);

  projects.forEach(project => {
    sessionsInProjects.set(project.id, sessions.filter(s => s.project_id === project.id));
  });

  // Helper to render a session item (DRY)
  const renderSessionItem = (session: typeof sessions[0]) => {
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
  };

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
        <div className="px-3 pt-3">
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

        {/* NEW PROJECT BUTTON */}
        <div className="px-3 py-2">
          <button
            onClick={() => setNewProjectModalOpen(true)}
            className="
                    w-full text-left
                    px-3 py-2
                    text-sm text-[#606060] hover:text-[#1A1A1A]
                    hover:bg-[#EAEAEA] rounded-lg
                    transition-all duration-200
                    flex items-center gap-2
                "
          >
            <FolderIcon className="w-4 h-4" />
            <span className={`${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
              New Project
            </span>
          </button>
        </div>

        {/* SESSION HISTORY */}
        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto px-3 py-2">

            {/* PROJECTS HEADER / TOGGLE */}
            {projects.length > 0 && (
              <div className="mb-1">
                <button
                  onClick={() => setProjectsListExpanded(!projectsListExpanded)}
                  className="w-full flex items-center gap-2 pl-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                >
                  {projectsListExpanded ? (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Projects</span>
                </button>
              </div>
            )}

            {/* PROJECTS LIST */}
            {projectsListExpanded && projects.map(project => {
              const projectSessions = sessionsInProjects.get(project.id) || [];
              const isExpanded = expandedProjects.has(project.id);
              const isHovered = hoveredProjectId === project.id;

              return (
                <div
                  key={project.id}
                  className="mb-2"
                  onMouseEnter={() => setHoveredProjectId(project.id)}
                  onMouseLeave={() => setHoveredProjectId(null)}
                >
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="w-full flex items-center justify-between pl-3 pr-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors group relative"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Removed individual chevron */}
                      <FolderIcon className="w-4 h-4 text-gray-500" />
                      <span className="truncate">{project.name}</span>
                      <span className="text-xs text-gray-400 ml-1">({projectSessions.length})</span>
                    </div>

                    {isHovered && (
                      <div
                        onClick={(e) => handleProjectMoreOptions(e, project.id)}
                        className="p-0.5 rounded-md hover:bg-gray-300 text-gray-500 transition-colors"
                      >
                        <EllipsisVerticalIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-4 mt-1 space-y-0.5 border-l-2 border-gray-100 ml-2.5">
                      {projectSessions.length === 0 && (
                        <div className="text-xs text-gray-400 py-1 pl-2 font-light italic">Empty project</div>
                      )}
                      {projectSessions.map(session => renderSessionItem(session))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* HISTORY HEADER / TOGGLE */}
            <div className="mt-4 mb-1">
              <button
                onClick={() => setHistoryListExpanded(!historyListExpanded)}
                className="w-full flex items-center gap-2 pl-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
              >
                {historyListExpanded ? (
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                )}
                <span>History</span>
              </button>
            </div>

            {/* UNASSIGNED SESSIONS LIST */}
            {historyListExpanded && (
              <div className="mt-1">
                {sessions.length === 0 && (
                  <p className="text-[#999] text-sm pl-4">No history yet…</p>
                )}
                {unassignedSessions.map((session) => renderSessionItem(session))}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-auto px-3 h-[83px]">
          <div className="h-full flex items-center justify-between">
            {sidebarOpen && <div className="text-sm text-[#1A1A1A] font-medium">{firstName}</div>}
            <button
              onClick={handleSettingsClick}
              className="p-2 rounded-lg hover:bg-[#EAEAEA] transition"
            >
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
            onAddToProject={handleAddToProjectFromDropdown}
            onRemoveFromProject={(id) => assignSessionToProject(id, null)}
            isPinned={session?.pinned || false}
            isInProject={!!session?.project_id}
          />
        );
      })()}

      {/* PROJECT ACTIONS DROPDOWN */}
      {dropdownProjectId && (
        <ProjectActionsDropdown
          projectId={dropdownProjectId}
          position={dropdownPosition}
          onClose={() => setDropdownProjectId(null)}
          onRename={handleRenameProjectTrigger}
          onDelete={handleDeleteProjectTrigger}
        />
      )}

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

      {/* NEW PROJECT MODAL */}
      {newProjectModalOpen && (
        <NewProjectModal
          onClose={() => setNewProjectModalOpen(false)}
          onConfirm={(name) => {
            createProject(name);
            setNewProjectModalOpen(false);
          }}
        />
      )}

      {/* RENAME PROJECT MODAL */}
      {renameProjectModal && (
        <RenameProjectModal
          currentName={renameProjectModal.name}
          onClose={() => setRenameProjectModal(null)}
          onConfirm={handleRenameProjectConfirm}
        />
      )}

      {/* DELETE PROJECT MODAL */}
      {deleteProjectModal && (
        <DeleteProjectModal
          projectName={deleteProjectModal.name}
          onClose={() => setDeleteProjectModal(null)}
          onConfirm={handleDeleteProjectConfirm}
        />
      )}

      {/* ADD TO PROJECT MODAL */}
      {addToProjectModal && (
        <AddToProjectModal
          projects={projects}
          currentProjectId={addToProjectModal.currentProjectId}
          onClose={() => setAddToProjectModal(null)}
          onConfirm={(projectId) => {
            assignSessionToProject(addToProjectModal.sessionId, projectId);
            setAddToProjectModal(null);
            // Also expand the project folder if adding to one
            if (projectId) {
              setExpandedProjects(prev => new Set(prev).add(projectId));
            }
          }}
        />
      )}

      {/* SETTINGS POPUP */}
      {settingsPopupOpen && (
        <SettingsPopup
          position={settingsPopupPosition}
          onClose={() => setSettingsPopupOpen(false)}
        />
      )}
    </div>
  );
}