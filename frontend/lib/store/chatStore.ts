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
import { create } from "zustand";
import { nanoid } from "nanoid";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Session = {
  id: string;
  title: string;
  messages: Message[];
};

type ChatStore = {
  sessions: Session[];
  activeSessionId: string | null;
  currentSessionId: string | null; // added property
  messages: Message[];

  startNewSession: () => void;
  selectSession: (sessionId: string) => void;
  sendMessage: (content: string) => void;
  receiveMessage: (content: string) => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  currentSessionId: null, // initialize
  messages: [],

  startNewSession: () => {
    const newId = nanoid();
    const newSession: Session = {
      id: newId,
      title: `Debug Session ${get().sessions.length + 1}`,
      messages: [],
    };

    set((state) => ({
      sessions: [...state.sessions, newSession],
      activeSessionId: newId,
      currentSessionId: newId, // sync currentSessionId
      messages: [],
    }));
  },

  selectSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    set({
      activeSessionId: sessionId,
      currentSessionId: sessionId, // sync currentSessionId
      messages: session.messages,
    });
  },

  sendMessage: (content) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;

    const updatedSessions = sessions.map((session) =>
      session.id === activeSessionId
        ? { ...session, messages: [...session.messages, { role: "user", content }] }
        : session
    );

    set({
      sessions: updatedSessions,
      messages: updatedSessions.find((s) => s.id === activeSessionId)!.messages,
      currentSessionId: activeSessionId, // keep synced
    });
  },

  receiveMessage: (content) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;

    const updatedSessions = sessions.map((session) =>
      session.id === activeSessionId
        ? { ...session, messages: [...session.messages, { role: "assistant", content }] }
        : session
    );

    set({
      sessions: updatedSessions,
      messages: updatedSessions.find((s) => s.id === activeSessionId)!.messages,
      currentSessionId: activeSessionId, // keep synced
    });
  },
}));
