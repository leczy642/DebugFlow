// lib/store/chatStore.ts
// lib/store/chatStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid"; // Unique ID generation for sessions

/**
 * Zustand store for managing chat sessions and messages.
 * Handles multiple chat sessions with message history and session switching.
 * 
 * Expected input: None - this is a standalone store definition.
 * Expected output: A React hook `useChatStore` that provides:
 *   - `sessions`: Array of all chat sessions
 *   - `activeSessionId`: Currently selected session ID
 *   - `messages`: Messages from active session (derived state)
 *   - `startNewSession`: Creates new chat session
 *   - `selectSession`: Switches between existing sessions
 *   - `sendMessage`: Adds user message to active session
 *   - `receiveMessage`: Adds assistant message to active session
 */

type Message = {
  role: "user" | "assistant"; // Message sender type
  content: string; // Message text content
};

type Session = {
  id: string; // Unique session identifier
  title: string; // Display title for session
  messages: Message[]; // Chat history for this session
};

type ChatStore = {
  sessions: Session[]; // All chat sessions
  activeSessionId: string | null; // Currently selected session ID
  messages: Message[]; // Derived from active session messages

  startNewSession: () => void; // Create new session
  selectSession: (sessionId: string) => void; // Switch to existing session
  sendMessage: (content: string) => void; // Add user message
  receiveMessage: (content: string) => void; // Add assistant message
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state - no sessions by default
  sessions: [],
  activeSessionId: null,
  messages: [],

  // Create new chat session with generated ID
  startNewSession: () => {
    const newId = nanoid(); // Generate unique session ID
    const newSession: Session = {
      id: newId,
      title: `Debug Session ${get().sessions.length + 1}`, // Default title
      messages: [],
    };

    set((state) => ({
      sessions: [...state.sessions, newSession], // Add to sessions array
      activeSessionId: newId, // Set as active
      messages: [], // Reset messages display
    }));
  },

  // Switch to existing session by ID
  selectSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return; // Ignore invalid session IDs

    set({
      activeSessionId: sessionId,
      messages: session.messages, // Load session messages
    });
  },

  // Add user message to active session
  sendMessage: (content) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return; // Require active session

    // Update messages in target session
    const updatedSessions = sessions.map((session) =>
      session.id === activeSessionId
        ? {
            ...session,
            messages: [
              ...session.messages,
              { role: "user", content },
            ],
          }
        : session
    );

    set({
      sessions: updatedSessions,
      messages: updatedSessions.find((s) => s.id === activeSessionId)!.messages,
    });
  },

  // Add assistant message to active session
  receiveMessage: (content) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return; // Require active session

    // Update messages in target session
    const updatedSessions = sessions.map((session) =>
      session.id === activeSessionId
        ? {
            ...session,
            messages: [
              ...session.messages,
              { role: "assistant", content },
            ],
          }
        : session
    );

    set({
      sessions: updatedSessions,
      messages: updatedSessions.find((s) => s.id === activeSessionId)!.messages,
    });
  },
}));