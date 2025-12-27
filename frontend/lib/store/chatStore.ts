// lib/store/chatStore.ts
/**
 * chatStore.ts (Zustand)
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Centralized state manager for chat history, sessions, and AI interactions.
 *
 * ROLE IN PROJECT:
 * - Holds conversations, session metadata, and UI-driven state flags
 * - Coordinates API calls to the backend chat + sessions endpoints
 * - Updates UI layout state when sessions change (via uiStore)
 *
 * WHAT THIS FILE DOES:
 * 1. Loads sessions from the backend
 * 2. Creates & selects sessions
 * 3. Sends user messages and receives AI replies
 * 4. Manages pinned, renamed, and deleted sessions (optimistic updates)
 * 5. Tracks UI state like "awaitingResponse" and "recently updated session"
 *
 * INPUTS:
 * - API responses from backend
 * - User chat input
 *
 * OUTPUTS:
 * - Reactive Zustand state consumed by React components
 * - Calls UI store helpers to center/dock input bar when needed
 *
 * IMPORTANT:
 * This store owns **chat logic**, not rendering.
 * Components should subscribe only to what they need.
 * -----------------------------------------------------------------------------
 */
import { create } from "zustand";
import { useUIStore } from "./uiStore";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Session = {
  id: string;            // UUID from Postgres
  title: string;
  messages: Message[];
  pinned?: boolean;
};

type ChatStore = {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  pendingSession: boolean;
  lastUpdatedSessionId: string | null;
  awaitingResponse: boolean;

  // Reset UI/chat to default view (no active session, empty messages)
  resetToDefault: () => void;

  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  receiveMessage: (content: string) => void;

  renameSession: (id: string, newTitle: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  pendingSession: false,
  lastUpdatedSessionId: null,
  awaitingResponse: false,

  /* ----------------------------------------------------------------
     LOAD EXISTING SESSIONS FROM SERVER
  ---------------------------------------------------------------- */
  loadSessions: async () => {
    const res = await fetch("http://localhost:4000/api/sessions");
    const sessions = await res.json();

    set({
      sessions: sessions.map((s: any) => ({
        ...s,
        messages: [],
        pinned: typeof s.pinned === "boolean" ? s.pinned : false,
      })),
    });
  },

   /* ----------------------------------------------------------------
     CREATE NEW SESSION (SERVER + LOCAL STATE)
  ---------------------------------------------------------------- */
  startNewSession: async () => {
    set({ pendingSession: true });

    const res = await fetch("http://localhost:4000/api/sessions", {
      method: "POST",
    });

    const session = await res.json();

    set((state) => ({
      sessions: [
        { ...session, messages: [], pinned: false },
        ...state.sessions,
      ],
      currentSessionId: session.id,
      messages: [],
      pendingSession: false,
    }));
  },

   /* ----------------------------------------------------------------
     SELECT SESSION & LOAD ITS MESSAGES
  ---------------------------------------------------------------- */
  selectSession: async (id: string) => {
    const res = await fetch(
      `http://localhost:4000/api/sessions/${id}/messages`
    );
    const messages = await res.json();

    set({
      currentSessionId: id,
      messages,
      pendingSession: false,
    });
  },

  /* ----------------------------------------------------------------
     SEND MESSAGE TO BACKEND + HANDLE RESPONSE
  ---------------------------------------------------------------- */
  sendMessage: async (content: string) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    const userMessage: Message = { role: "user", content };

    set((state) => ({
      messages: [...state.messages, userMessage],
      awaitingResponse: true,
    }));

    const res = await fetch("http://localhost:4000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        message: content,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      // If backend generated a session title for the first message, apply it to local sessions
      if (data.title) {
        set((state) => {
          const found = state.sessions.some((s) => s.id === currentSessionId);
          const updatedSessions = found
            ? state.sessions.map((s) => (s.id === currentSessionId ? { ...s, title: data.title } : s))
            : [{ id: currentSessionId!, title: data.title, messages: [], pinned: false }, ...state.sessions];

          return {
            sessions: updatedSessions,
            // mark it recently updated so UI can react immediately
            lastUpdatedSessionId: currentSessionId,
          };
        });
      }

      get().receiveMessage(data.reply);
    } else {
      get().receiveMessage("⚠️ Error processing request");
    }
  },

   /* ----------------------------------------------------------------
     RECEIVE AI REPLY (LOCAL ONLY)
  ---------------------------------------------------------------- */
  receiveMessage: (content: string) => {
    const assistantMessage: Message = { role: "assistant", content };

    set((state) => {
      const updatedMessages = [...state.messages, assistantMessage];

      return {
        messages: updatedMessages,
        awaitingResponse: false,
        lastUpdatedSessionId: state.currentSessionId,
      };
    });

    setTimeout(() => set({ lastUpdatedSessionId: null }), 350);
  },

  /* ----------------------------------------------------------------
     UI HELPERS (OPTIMISTIC UPDATES + SERVER PERSISTENCE)
  ---------------------------------------------------------------- */
  renameSession: (id, newTitle) =>
    // Optimistic update: update UI immediately, persist to server, rollback on failure
    (async (id: string, newTitle: string) => {
      const prev = get().sessions;
      const trimmed = newTitle.trim();
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, title: trimmed } : s
        ),
      }));

      try {
        const res = await fetch(`http://localhost:4000/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) {
          set({ sessions: prev });
        }
      } catch (err) {
        set({ sessions: prev });
      }
    })(id, newTitle),

  pinSession: (id) =>
    // Optimistic pin with server persistence
    (async (id: string) => {
      const prev = get().sessions;
      const updated = get().sessions.map((s) => (s.id === id ? { ...s, pinned: true } : s));
      const reordered = [...updated.filter((s) => s.pinned), ...updated.filter((s) => !s.pinned)];
      set({ sessions: reordered });

      try {
        const res = await fetch(`http://localhost:4000/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: true }),
        });
        if (!res.ok) set({ sessions: prev });
      } catch (err) {
        set({ sessions: prev });
      }
    })(id),

  unpinSession: (id) =>
    // Optimistic unpin with server persistence
    (async (id: string) => {
      const prev = get().sessions;
      const updated = get().sessions.map((s) => (s.id === id ? { ...s, pinned: false } : s));
      const reordered = [...updated.filter((s) => s.pinned), ...updated.filter((s) => !s.pinned)];
      set({ sessions: reordered });

      try {
        const res = await fetch(`http://localhost:4000/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: false }),
        });
        if (!res.ok) set({ sessions: prev });
      } catch (err) {
        set({ sessions: prev });
      }
    })(id),

  deleteSession: async (id) => {
    const prev = get().sessions;
    const prevCurrent = get().currentSessionId;
    const prevMessages = get().messages;
    // Capture previous UI input state so we can restore on rollback
    const prevInputCentered = useUIStore.getState().inputBarCentered;

    // Optimistically remove session
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      messages: state.currentSessionId === id ? [] : state.messages,
    }));

    // If we removed the active session, center the input bar
    if (prevCurrent === id) {
      useUIStore.getState().centerInput();
    }

    try {
      const res = await fetch(`http://localhost:4000/api/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // rollback
        set({ sessions: prev, currentSessionId: prevCurrent, messages: prevMessages });
        // restore previous input bar state if we changed it
        if (prevCurrent === id && !prevInputCentered) {
          useUIStore.getState().dockInput();
        }
      }
    } catch (err) {
      set({ sessions: prev, currentSessionId: prevCurrent, messages: prevMessages });
      if (prevCurrent === id && !prevInputCentered) {
        useUIStore.getState().dockInput();
      }
    }
  },

  /* -----------------------------
     RESET TO DEFAULT VIEW
     - Clear current session selection and messages
     - Reset pending/awaiting flags
  ----------------------------- */
  resetToDefault: () =>
    set({ currentSessionId: null, messages: [], pendingSession: false, awaitingResponse: false }),
}));
