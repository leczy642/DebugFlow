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
// lib/store/chatStore.ts
// lib/store/chatStore.ts
import { create } from "zustand";

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
  currentSessionId: string | null;
  messages: Message[];
  pendingSession: Session | null; // New: holds session before first message
  
  startNewSession: () => void;
  selectSession: (id: string) => void;
  sendMessage: (content: string) => void;
  receiveMessage: (content: string) => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  pendingSession: null,

  startNewSession: () => {
    const newId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: "New Debug Session",
      messages: [],
    };
    
    // Store as pending session, don't add to history yet
    set({
      pendingSession: newSession,
      currentSessionId: null,
      messages: [],
    });
  },

  selectSession: (id: string) => {
    const session = get().sessions.find((s) => s.id === id);
    if (session) {
      set({
        currentSessionId: id,
        messages: session.messages,
        pendingSession: null, // Clear pending session when selecting existing one
      });
    }
  },

  sendMessage: (content: string) => {
    const userMessage: Message = { role: "user", content };
    
    set((state) => {
      const updatedMessages = [...state.messages, userMessage];
      
      // If there's a pending session, add it to history now
      if (state.pendingSession) {
        const sessionWithTitle = {
          ...state.pendingSession,
          title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
          messages: updatedMessages,
        };
        
        return {
          sessions: [sessionWithTitle, ...state.sessions],
          currentSessionId: sessionWithTitle.id,
          messages: updatedMessages,
          pendingSession: null,
        };
      }
      
      // If no current session and no pending session, create new one
      if (!state.currentSessionId) {
        const newId = `session-${Date.now()}`;
        const newSession: Session = {
          id: newId,
          title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
          messages: updatedMessages,
        };
        
        return {
          sessions: [newSession, ...state.sessions],
          currentSessionId: newId,
          messages: updatedMessages,
          pendingSession: null,
        };
      }
      
      // Update existing session
      const updatedSessions = state.sessions.map((session) =>
        session.id === state.currentSessionId
          ? { 
              ...session, 
              messages: updatedMessages,
            }
          : session
      );
      
      return {
        sessions: updatedSessions,
        messages: updatedMessages,
        pendingSession: null,
      };
    });
  },

  receiveMessage: (content: string) => {
    const assistantMessage: Message = { role: "assistant", content };
    
    set((state) => {
      const updatedMessages = [...state.messages, assistantMessage];
      
      const updatedSessions = state.sessions.map((session) =>
        session.id === state.currentSessionId
          ? { ...session, messages: updatedMessages }
          : session
      );
      
      return {
        sessions: updatedSessions,
        messages: updatedMessages,
      };
    });
  },
}));