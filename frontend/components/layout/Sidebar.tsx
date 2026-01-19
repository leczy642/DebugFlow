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
import ProjectActionsDropdown from "../chat/ProjectActionsDropdown";
import NewProjectModal from "../chat/NewProjectModal";
import SettingsPopup from "./SettingsPopup";
import { useAuth } from "@/lib/hooks/useAuth";

export default function Sidebar() {
    const {
        sidebarOpen, toggleSidebar, centerInput, dockInput, inputBarCentered,
        openRenameSession, openDeleteSession, openAddToProject,
        openRenameProject, openDeleteProject
    } = useUIStore();
    const { user } = useAuth();

    const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'User';

    const {
        sessions,
        projects,
        loadSessions,
        loadProjects,
        createProject,
        assignSessionToProject,
        selectSession,
        currentSessionId,
        pinSession,
        unpinSession,
        lastUpdatedSessionId,
        resetToDefault,
        selectedProjectId,
        selectProject,
    } = useChatStore();

    const handleNewSession = () => {
        if (inputBarCentered) return;
        centerInput();
        resetToDefault();
    };

    const handleHeaderClick = () => {
        if (inputBarCentered) return;
        centerInput();
        resetToDefault();
    };

    const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
    const [dropdownSessionId, setDropdownSessionId] = useState<string | null>(null);

    const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
    const [dropdownProjectId, setDropdownProjectId] = useState<string | null>(null);

    const [dropdownPosition, setDropdownPosition] = useState<{
        top: number;
        left?: number;
        right?: number;
        above: boolean;
    }>({
        top: 0,
        above: false
    });

    const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
    const [projectsListExpanded, setProjectsListExpanded] = useState(true);
    const [historyListExpanded, setHistoryListExpanded] = useState(true);

    const handleProjectClick = (projectId: string) => {
        selectProject(projectId);
        centerInput();
    };

    const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
    const [settingsPopupPosition, setSettingsPopupPosition] = useState({ bottom: 0, left: 0 });

    const handleMoreOptions = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const estimatedDropdownHeight = 170;
        const gap = 3;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldPositionAbove = spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

        // Position dropdown to align its right edge with the button's right edge
        // This is typically more stable in sidebars.
        const rightOffset = window.innerWidth - rect.right;

        setDropdownPosition({
            top: shouldPositionAbove
                ? rect.top - estimatedDropdownHeight - gap
                : rect.bottom + gap,
            right: rightOffset,
            above: shouldPositionAbove,
        });
        setDropdownSessionId(sessionId);
        setDropdownProjectId(null);
    };

    const handleProjectMoreOptions = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const estimatedDropdownHeight = 90;
        const gap = 3;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldPositionAbove = spaceBelow < estimatedDropdownHeight + gap && spaceAbove >= estimatedDropdownHeight + gap;

        const rightOffset = window.innerWidth - rect.right;

        setDropdownPosition({
            top: shouldPositionAbove
                ? rect.top - estimatedDropdownHeight - gap
                : rect.bottom + gap,
            right: rightOffset,
            above: shouldPositionAbove,
        });
        setDropdownProjectId(projectId);
        setDropdownSessionId(null);
    };

    const handleRenameFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openRenameSession(sessionId, session.title);
        }
        setDropdownSessionId(null);
    };

    const handleDeleteFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openDeleteSession(sessionId, session.title);
        }
        setDropdownSessionId(null);
    };

    const handleAddToProjectFromDropdown = (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            openAddToProject(sessionId, session.project_id);
        }
        setDropdownSessionId(null);
    };

    const handleRenameProjectTrigger = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            openRenameProject(projectId, project.name);
        }
        setDropdownProjectId(null);
    };

    const handleDeleteProjectTrigger = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            openDeleteProject(projectId, project.name);
        }
        setDropdownProjectId(null);
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

    useEffect(() => {
        if (currentSessionId) {
            dockInput();
        }
    }, [currentSessionId, dockInput]);

    useEffect(() => {
        loadSessions().catch((err) => console.error("Failed to load sessions:", err));
        loadProjects().catch((err) => console.error("Failed to load projects:", err));
    }, [loadSessions, loadProjects]);

    useEffect(() => {
        if (sidebarOpen) {
            loadSessions().catch((err) => console.error("Failed to refresh sessions:", err));
            loadProjects().catch((err) => console.error("Failed to refresh projects:", err));
        }
    }, [sidebarOpen, loadSessions, loadProjects]);

    const unassignedSessions = sessions.filter(s => !s.project_id);

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
            flex items-center rounded-xl transition-colors duration-200
            ${isActive ? "bg-[#e4edfd]" : "bg-transparent"}
            ${!isActive && "hover:bg-[#EAEAEA]"}
            ${isRecentlyUpdated ? " session-enter" : ""}
          `}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
            >
                {isPinned && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            unpinSession(session.id);
                        }}
                        className={`p-1.5 mr-1 ${isActive ? "text-blue-700" : "text-[#606060]"} hover:bg-[#EAEAEA] rounded transition-colors duration-150`}
                        aria-label="Unpin session"
                    >
                        <BookmarkIconSolid className="w-4 h-4" />
                    </button>
                )}

                <a
                    onClick={() => selectSession(session.id)}
                    className={`block cursor-pointer px-3 py-2.5 text-sm flex items-center min-w-0 flex-1 ${isActive ? "text-blue-700" : "text-[#1A1A1A]"}`}
                >
                    <span className="font-medium truncate" title={isTruncated ? session.title : undefined}>
                        {displayTitle}
                    </span>
                </a>

                {showDots && (
                    <button
                        onClick={(e) => handleMoreOptions(e, session.id)}
                        className={`p-1.5 ${isActive ? "text-blue-700" : "text-[#606060]"} transition-colors duration-150`}
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
                        className={`font-semibold text-[15px] text-[#1A1A1A] tracking-wide transition-all duration-200 cursor-pointer hover:opacity-70 ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}
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
                        className="w-full bg-white text-[#1A1A1A] p-3 rounded-xl text-sm border border-[#E5E5E5] shadow-sm hover:shadow-md hover:bg-[#FAFAFA] transition-all duration-200 flex items-center gap-2"
                    >
                        <span className="text-lg">+</span>
                        <span className={`transition-all duration-200 whitespace-nowrap ${sidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                            New Debug Session
                        </span>
                    </button>
                </div>

                {/* NEW PROJECT BUTTON */}
                <div className="px-3 py-2">
                    <button
                        onClick={() => setNewProjectModalOpen(true)}
                        className="w-full text-left px-3 py-2 text-sm text-[#606060] hover:text-[#1A1A1A] hover:bg-[#EAEAEA] rounded-lg transition-all duration-200 flex items-center gap-2"
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
                        {projects.length > 0 && (
                            <div className="mb-1">
                                <button
                                    onClick={() => setProjectsListExpanded(!projectsListExpanded)}
                                    className="w-full flex items-center gap-2 pl-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                                >
                                    {projectsListExpanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                    <span>Projects</span>
                                </button>
                            </div>
                        )}

                        {projectsListExpanded && projects.map(project => {
                            const isSelected = selectedProjectId === project.id;
                            const isHovered = hoveredProjectId === project.id;
                            const sessionCount = sessions.filter(s => s.project_id === project.id).length;

                            return (
                                <div
                                    key={project.id}
                                    className="mb-1"
                                    onMouseEnter={() => setHoveredProjectId(project.id)}
                                    onMouseLeave={() => setHoveredProjectId(null)}
                                >
                                    <div
                                        className={`w-full flex items-center justify-between pl-3 pr-2 py-2 text-sm font-medium rounded-lg transition-colors group relative ${isSelected ? "bg-[#e4edfd] text-blue-700" : "text-gray-700 hover:bg-gray-200"}`}
                                    >
                                        <div
                                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                            onClick={() => handleProjectClick(project.id)}
                                        >
                                            <FolderIcon className={`w-4 h-4 ${isSelected ? "text-blue-700" : "text-gray-500"}`} />
                                            <span className="truncate">{project.name}</span>
                                            <span className={`text-xs ml-1 ${isSelected ? "text-blue-500" : "text-gray-400"}`}>
                                                ({sessionCount})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {isHovered && (
                                                <div
                                                    onClick={(e) => handleProjectMoreOptions(e, project.id)}
                                                    className="p-0.5 rounded-md hover:bg-gray-300 text-gray-500 transition-colors cursor-pointer"
                                                >
                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Render sessions belonging to this project */}
                                    {isSelected && (
                                        <div className="ml-4 mt-1 border-l-2 border-[#E5E5E5] pl-1">
                                            {sessions
                                                .filter(s => s.project_id === project.id)
                                                .map(session => renderSessionItem(session))
                                            }
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="mt-4 mb-1">
                            <button
                                onClick={() => setHistoryListExpanded(!historyListExpanded)}
                                className="w-full flex items-center gap-2 pl-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                            >
                                {historyListExpanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                <span>History</span>
                            </button>
                        </div>

                        {historyListExpanded && (
                            <div className="mt-1">
                                {sessions.length === 0 && <p className="text-[#999] text-sm pl-4">No history yet…</p>}
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

            {!sidebarOpen && (
                <button
                    onClick={handleHeaderClick}
                    className="absolute top-3 left-20 text-[15px] font-semibold text-[#1A1A1A] tracking-wide transition-opacity duration-300 cursor-pointer hover:opacity-70"
                >
                    DebugFlow
                </button>
            )}

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

            {dropdownProjectId && (
                <ProjectActionsDropdown
                    projectId={dropdownProjectId}
                    position={dropdownPosition}
                    onClose={() => setDropdownProjectId(null)}
                    onRename={handleRenameProjectTrigger}
                    onDelete={handleDeleteProjectTrigger}
                />
            )}

            {newProjectModalOpen && (
                <NewProjectModal
                    onClose={() => setNewProjectModalOpen(false)}
                    onConfirm={(name) => {
                        createProject(name);
                        setNewProjectModalOpen(false);
                    }}
                />
            )}

            {settingsPopupOpen && (
                <SettingsPopup
                    position={settingsPopupPosition}
                    onClose={() => setSettingsPopupOpen(false)}
                />
            )}
        </div>
    );
}
