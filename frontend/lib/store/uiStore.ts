/**
 * lib/store/uiStore.ts
 * Zustand store for managing UI state across the application.
 */
import { create } from "zustand";

type UIStore = {
  sidebarOpen: boolean;
  inputBarCentered: boolean;
  toggleSidebar: () => void;
  setInputBarCentered: (value: boolean) => void;
  centerInput: () => void;
  dockInput: () => void;

  // Modal states
  renameSessionModal: { isOpen: boolean; sessionId: string; title: string };
  deleteSessionModal: { isOpen: boolean; sessionId: string; title: string };
  addToProjectModal: { isOpen: boolean; sessionId: string; currentProjectId?: string | null };
  renameProjectModal: { isOpen: boolean; projectId: string; name: string };
  deleteProjectModal: { isOpen: boolean; projectId: string; name: string };

  // Modal actions
  openRenameSession: (sessionId: string, title: string) => void;
  closeRenameSession: () => void;
  openDeleteSession: (sessionId: string, title: string) => void;
  closeDeleteSession: () => void;
  openAddToProject: (sessionId: string, currentProjectId?: string | null) => void;
  closeAddToProject: () => void;
  openRenameProject: (projectId: string, name: string) => void;
  closeRenameProject: () => void;
  openDeleteProject: (projectId: string, name: string) => void;
  closeDeleteProject: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  inputBarCentered: true,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setInputBarCentered: (value) => set({ inputBarCentered: value }),
  centerInput: () => set({ inputBarCentered: true }),
  dockInput: () => set({ inputBarCentered: false }),

  renameSessionModal: { isOpen: false, sessionId: "", title: "" },
  openRenameSession: (sessionId, title) => set({ renameSessionModal: { isOpen: true, sessionId, title } }),
  closeRenameSession: () => set((s) => ({ renameSessionModal: { ...s.renameSessionModal, isOpen: false } })),

  deleteSessionModal: { isOpen: false, sessionId: "", title: "" },
  openDeleteSession: (sessionId, title) => set({ deleteSessionModal: { isOpen: true, sessionId, title } }),
  closeDeleteSession: () => set((s) => ({ deleteSessionModal: { ...s.deleteSessionModal, isOpen: false } })),

  addToProjectModal: { isOpen: false, sessionId: "", currentProjectId: null },
  openAddToProject: (sessionId, currentProjectId) => set({ addToProjectModal: { isOpen: true, sessionId, currentProjectId } }),
  closeAddToProject: () => set((s) => ({ addToProjectModal: { ...s.addToProjectModal, isOpen: false } })),

  renameProjectModal: { isOpen: false, projectId: "", name: "" },
  openRenameProject: (projectId, name) => set({ renameProjectModal: { isOpen: true, projectId, name } }),
  closeRenameProject: () => set((s) => ({ renameProjectModal: { ...s.renameProjectModal, isOpen: false } })),

  deleteProjectModal: { isOpen: false, projectId: "", name: "" },
  openDeleteProject: (projectId, name) => set({ deleteProjectModal: { isOpen: true, projectId, name } }),
  closeDeleteProject: () => set((s) => ({ deleteProjectModal: { ...s.deleteProjectModal, isOpen: false } })),
}));
