/**
 * Zustand store for managing UI state across the application.
 * Provides centralized state management for UI elements like sidebar visibility.
 * 
 * Expected input: None - this is a standalone store definition.
 * Expected output: A React hook `useUIStore` that provides:
 *   - `sidebarOpen`: boolean state
 *   - `toggleSidebar`: function to toggle sidebar state
 */
/**
 * Zustand store for managing UI state across the application.
 * Provides centralized state management for UI elements like sidebar visibility.
 *
 * Exposed state:
 *   - sidebarOpen: boolean
 *   - inputBarCentered: boolean
 *
 * Exposed actions:
 *   - toggleSidebar(): toggle sidebar visibility
 *   - setInputBarCentered(value: boolean): manually set centered/docked
 *   - centerInput(): convenience helper → center the input bar
 *   - dockInput(): convenience helper → move input bar to bottom
 */

// lib/store/uiStore.ts
import { create } from "zustand";

type UIStore = {
  sidebarOpen: boolean;
  inputBarCentered: boolean;
  toggleSidebar: () => void;
  setInputBarCentered: (value: boolean) => void;
  centerInput: () => void;
  dockInput: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  // Default: input bar starts centered
  inputBarCentered: true,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setInputBarCentered: (value) =>
    set({ inputBarCentered: value }),

  // Convenience: center input bar
  centerInput: () =>
    set({ inputBarCentered: true }),

  // Convenience: dock input bar at bottom
  dockInput: () => {
    //console.log("dockInput called - setting inputBarCentered to false"); // Debug log
    set({ inputBarCentered: false });
  },
}));
