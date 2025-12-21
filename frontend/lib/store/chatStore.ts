// lib/store/chatStore.ts

// lib/store/chatStore.ts // lib/store/chatStore.ts import { create } from "zustand"; import { nanoid } from "nanoid"; 
// // Unique ID generation for sessions 
// /** * Zustand store for managing chat sessions and messages.
//  * Handles multiple chat sessions with message history and session switching. 
// * * Expected input: None - this is a standalone store definition. 
// * Expected output: A React hook useChatStore that provides: *
//  - sessions: Array of all chat sessions * 
// - activeSessionId: Currently selected session ID * 
// - messages: Messages from active session (derived state) * 
// - startNewSession: Creates new chat session * 
// - selectSession: Switches between existing sessions *
//  - sendMessage: Adds user message to active session * 
// - receiveMessage: Adds assistant message to active session */
// lib/store/chatStore.ts
import { create } from "zustand";

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

  /* -----------------------------
     LOAD EXISTING SESSIONS
  ----------------------------- */
  loadSessions: async () => {
    const res = await fetch("http://localhost:4000/api/sessions");
    const sessions = await res.json();

    set({
      sessions: sessions.map((s: any) => ({
        ...s,
        messages: [],
        pinned: false,
      })),
    });
  },

  /* -----------------------------
     CREATE SESSION (SERVER)
  ----------------------------- */
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

  /* -----------------------------
     SELECT SESSION
  ----------------------------- */
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

  /* -----------------------------
     SEND MESSAGE
  ----------------------------- */
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
      get().receiveMessage(data.reply);
    } else {
      get().receiveMessage("⚠️ Error processing request");
    }
  },

  /* -----------------------------
     RECEIVE MESSAGE
  ----------------------------- */
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

  /* -----------------------------
     UI HELPERS (LOCAL ONLY)
  ----------------------------- */
  renameSession: (id, newTitle) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title: newTitle.trim() } : s
      ),
    })),

  pinSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: true } : s
      ),
    })),

  unpinSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: false } : s
      ),
    })),

  deleteSession: async (id) => {
    await fetch(`http://localhost:4000/api/sessions/${id}`, {
      method: "DELETE",
    });

    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId:
        state.currentSessionId === id ? null : state.currentSessionId,
      messages:
        state.currentSessionId === id ? [] : state.messages,
    }));
  },
}));
