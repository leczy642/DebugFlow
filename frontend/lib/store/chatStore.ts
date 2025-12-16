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
import { create } from "zustand";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Session = {
  id: string;
  title: string;
  messages: Message[];
  pinned?: boolean; // optional, defaults to false
};

type ChatStore = {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  pendingSession: Session | null;
  lastUpdatedSessionId: string | null;

  startNewSession: () => void;
  selectSession: (id: string) => void;
  sendMessage: (content: string) => void;
  receiveMessage: (content: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  pinSession: (id: string) => void;          // toggles pin state
  unpinSession: (id: string) => void;        // explicit unpin (optional but clean)
  deleteSession: (id: string) => void;       // 👈 NEW
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  pendingSession: null,
  lastUpdatedSessionId: null,

  startNewSession: () => {
    const newId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: "New Debug Session",
      messages: [],
    };
    
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
        pendingSession: null,
      });
    }
  },

  sendMessage: (content: string) => {
    const userMessage: Message = { role: "user", content };
    
    set((state) => {
      const updatedMessages = [...state.messages, userMessage];
      
      if (state.pendingSession) {
        const sessionWithTitle = {
          ...state.pendingSession,
          title: content,
          messages: updatedMessages,
          pinned: false,
        };
        
        // Sort: pinned first, then by insertion order (newest first)
        const pinnedSessions = state.sessions.filter(s => s.pinned);
        const unpinnedSessions = state.sessions.filter(s => !s.pinned);
        
        return {
          sessions: [...pinnedSessions, sessionWithTitle, ...unpinnedSessions],
          currentSessionId: sessionWithTitle.id,
          messages: updatedMessages,
          pendingSession: null,
        };
      }
      
      if (!state.currentSessionId) {
        const newId = `session-${Date.now()}`;
        const newSession: Session = {
          id: newId,
          title: content,
          messages: updatedMessages,
          pinned: false,
        };
        
        const pinnedSessions = state.sessions.filter(s => s.pinned);
        const unpinnedSessions = state.sessions.filter(s => !s.pinned);
        
        return {
          sessions: [...pinnedSessions, newSession, ...unpinnedSessions],
          currentSessionId: newId,
          messages: updatedMessages,
          pendingSession: null,
        };
      }
      
      // Update existing session and move to top of unpinned sessions
      const sessionToUpdate = state.sessions.find(s => s.id === state.currentSessionId);
      if (!sessionToUpdate) {
        return {
          sessions: state.sessions,
          messages: updatedMessages,
          pendingSession: null,
        };
      }

      const updatedSession = {
        ...sessionToUpdate,
        messages: updatedMessages,
      };

      // Remove the session from its current position
      const otherSessions = state.sessions.filter(s => s.id !== state.currentSessionId);
      
      // Separate pinned and unpinned sessions
      const pinnedSessions = otherSessions.filter(s => s.pinned);
      const unpinnedSessions = otherSessions.filter(s => !s.pinned);
      
      // If the updated session is not pinned, move it to the top of unpinned sessions
      if (!updatedSession.pinned) {
        // mark recently-updated session for UI animation, clear shortly after
        setTimeout(() => set({ lastUpdatedSessionId: null }), 350);
        return {
          sessions: [...pinnedSessions, updatedSession, ...unpinnedSessions],
          lastUpdatedSessionId: updatedSession.id,
          messages: updatedMessages,
          pendingSession: null,
        };
      } else {
        // If pinned, keep it in pinned section but at the top
        setTimeout(() => set({ lastUpdatedSessionId: null }), 350);
        return {
          sessions: [updatedSession, ...pinnedSessions.filter(s => s.id !== updatedSession.id), ...unpinnedSessions],
          lastUpdatedSessionId: updatedSession.id,
          messages: updatedMessages,
          pendingSession: null,
        };
      }
    });
  },

  receiveMessage: (content: string) => {
    const assistantMessage: Message = { role: "assistant", content };
    
    set((state) => {
      const updatedMessages = [...state.messages, assistantMessage];
      
      // Update existing session and move to top of unpinned sessions
      const sessionToUpdate = state.sessions.find(s => s.id === state.currentSessionId);
      if (!sessionToUpdate) {
        return {
          sessions: state.sessions,
          messages: updatedMessages,
        };
      }

      const updatedSession = {
        ...sessionToUpdate,
        messages: updatedMessages,
      };

      // Remove the session from its current position
      const otherSessions = state.sessions.filter(s => s.id !== state.currentSessionId);
      
      // Separate pinned and unpinned sessions
      const pinnedSessions = otherSessions.filter(s => s.pinned);
      const unpinnedSessions = otherSessions.filter(s => !s.pinned);
      
      // If the updated session is not pinned, move it to the top of unpinned sessions
      if (!updatedSession.pinned) {
        // mark recently-updated session for UI animation, clear shortly after
        setTimeout(() => set({ lastUpdatedSessionId: null }), 350);
        return {
          sessions: [...pinnedSessions, updatedSession, ...unpinnedSessions],
          lastUpdatedSessionId: updatedSession.id,
          messages: updatedMessages,
        };
      } else {
        // If pinned, keep it in pinned section but at the top
        setTimeout(() => set({ lastUpdatedSessionId: null }), 350);
        return {
          sessions: [updatedSession, ...pinnedSessions.filter(s => s.id !== updatedSession.id), ...unpinnedSessions],
          lastUpdatedSessionId: updatedSession.id,
          messages: updatedMessages,
        };
      }
    });
  },

  renameSession: (id: string, newTitle: string) => {
    set((state) => {
      const trimmedTitle = newTitle.trim();
      if (!trimmedTitle) return state;

      const updatedSessions = state.sessions.map((session) =>
        session.id === id ? { ...session, title: trimmedTitle } : session
      );

      const updatedPending =
        state.pendingSession && state.pendingSession.id === id
          ? { ...state.pendingSession, title: trimmedTitle }
          : state.pendingSession;

      return {
        ...state,
        sessions: updatedSessions,
        pendingSession: updatedPending,
      };
    });
  },

  pinSession: (id: string) => {
    set((state) => {
      const updatedSessions = state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: true } : s
      );

      const pinnedSessions = updatedSessions.filter(s => s.pinned);
      const unpinnedSessions = updatedSessions.filter(s => !s.pinned);

      return {
        ...state,
        sessions: [...pinnedSessions, ...unpinnedSessions],
      };
    });
  },

  unpinSession: (id: string) => {
    set((state) => {
      const updatedSessions = state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: false } : s
      );

      const pinnedSessions = updatedSessions.filter(s => s.pinned);
      const unpinnedSessions = updatedSessions.filter(s => !s.pinned);

      return {
        ...state,
        sessions: [...pinnedSessions, ...unpinnedSessions],
      };
    });
  },

  //NEW: Delete session with cleanup
  deleteSession: (id: string) => {
    set((state) => {
      // Remove session
      const updatedSessions = state.sessions.filter((s) => s.id !== id);
      
      // Handle current session deletion
      let newCurrentSessionId = state.currentSessionId;
      let newMessages: Message[] = state.messages;
      
      if (state.currentSessionId === id) {
        // Select first available session
        newCurrentSessionId = updatedSessions.length > 0 ? updatedSessions[0].id : null;
        newMessages = newCurrentSessionId 
          ? updatedSessions.find(s => s.id === newCurrentSessionId)?.messages || []
          : [];
      }

      return {
        sessions: updatedSessions,
        currentSessionId: newCurrentSessionId,
        messages: newMessages,
        // Clean up pending session if it's the one being deleted
        pendingSession: state.pendingSession?.id === id ? null : state.pendingSession,
      };
    });
  },
}));