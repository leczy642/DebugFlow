/**
 * Zustand store for managing UI state across the application.
 * Provides centralized state management for UI elements like sidebar visibility.
 * 
 * Expected input: None - this is a standalone store definition.
 * Expected output: A React hook `useUIStore` that provides:
 *   - `sidebarOpen`: boolean state
 *   - `toggleSidebar`: function to toggle sidebar state
 */

import { create } from "zustand";

type UIStore = {
  sidebarOpen: boolean; // Current visibility state of the sidebar
  toggleSidebar: () => void; // Function to toggle sidebar visibility
};

// Create and export the Zustand store
export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true, // Initial state: sidebar is open
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })), // Toggle boolean value
}));
