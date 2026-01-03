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
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  isDeleted?: boolean;
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
  awaitingSessionId: string | null;
  abortController: AbortController | null;

  // Tracks the in-flight request that should be accepted when a reply arrives.
  // When starting a new session or cancelling, this is set to null so older
  // responses are ignored.
  activeRequestId: string | null;

  // Reset UI/chat to default view (no active session, empty messages)
  resetToDefault: () => void;
  stopGeneration: () => void;

  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  sendMessage: (content: string, parentId?: string, skipUserMessage?: boolean) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  // Optional requestId used to ignore stale replies (when user started a new session)
  receiveMessage: (content: string, requestId?: string, parentId?: string) => void;

  renameSession: (id: string, newTitle: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  restoreMessage: (id: string) => Promise<void>;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  pendingSession: false,
  lastUpdatedSessionId: null,
  awaitingSessionId: null,
  abortController: null,
  activeRequestId: null,

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
      awaitingSessionId: null, // Clear loading state when switching sessions
    });
  },

  /* ----------------------------------------------------------------
     SEND MESSAGE TO BACKEND + HANDLE RESPONSE
  ---------------------------------------------------------------- */
  sendMessage: async (content: string, parentId?: string, skipUserMessage?: boolean) => {
    const { currentSessionId, messages } = get();
    if (!currentSessionId) return;

    // If no parentId is provided (normal chat flow), use the last message's ID as parent
    // This ensures linear conversation history.
    // If skipUserMessage is true (regeneration), parentId MUST be provided by caller.
    let effectiveParentId = parentId;
    if (!effectiveParentId && !skipUserMessage && messages.length > 0) {
      effectiveParentId = messages[messages.length - 1].id;
    }

    // Create a small locally-unique request id so we can ignore stale replies
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();

    set((state) => {
      // Note: The backend will assign an ID. If we want to link the *next* assistant message to this,
      // we need the ID. But `sendMessage` is async.
      // The backend `chat` endpoint now links them.

      // If skipping user message (regenerating), we don't add a new user message to the store optimistically
      // because it already exists. We just want to trigger the AI response.
      // However, we might want to show a loading state.
      // For now, let's just NOT add the user message if skipUserMessage is true.

      let newSessions = state.sessions;
      if (!skipUserMessage) {
        const userMessage: Message = { role: "user", content, parentId: effectiveParentId || null };
        // Reorder sessions logic...
        const currentSession = state.sessions.find((s) => s.id === currentSessionId);
        if (currentSession && !currentSession.pinned) {
          const otherSessions = state.sessions.filter((s) => s.id !== currentSessionId);
          const pinned = otherSessions.filter((s) => s.pinned);
          const unpinned = otherSessions.filter((s) => !s.pinned);
          newSessions = [...pinned, currentSession, ...unpinned];
        }
        return {
          messages: [...state.messages, userMessage],
          sessions: newSessions,
          awaitingSessionId: currentSessionId,
          activeRequestId: requestId,
          abortController: controller,
        };
      }

      return {
        awaitingSessionId: currentSessionId,
        activeRequestId: requestId,
        abortController: controller,
      };
    });

    try {
      const res = await fetch("http://localhost:4000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: content,
          parentId: effectiveParentId,
          skipUserMessage,
        }),
        signal: controller.signal,
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

        // We reload messages to get the correct IDs and structure from DB
        // This is a bit heavy but ensures consistency for now.
        await get().selectSession(currentSessionId);

        // Clear loading state since we are done
        set({ awaitingSessionId: null, activeRequestId: null });

        // get().receiveMessage(data.reply, requestId);
      } else {
        get().receiveMessage("⚠️ Error processing request", requestId);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      get().receiveMessage("⚠️ Error processing request", requestId);
    } finally {
      set({ abortController: null });
    }
  },

  regenerateResponse: async (messageId: string) => {
    const { messages, sendMessage } = get();
    const messageToRegenerate = messages.find((m) => m.id === messageId);
    if (!messageToRegenerate) return;

    // If it's an assistant message, we want to regenerate the response to its PARENT (the user message).
    // So we find the parent.
    if (messageToRegenerate.role === "assistant") {
      const parentId = messageToRegenerate.parentId;
      if (!parentId) return; // Can't regenerate if no parent (orphan)

      const parentMessage = messages.find((m) => m.id === parentId);
      if (!parentMessage) return;

      // Resend the parent message content, linked to the SAME parent ID as the user message?
      // No, we want to send a NEW request that is a child of the USER message.
      // So we pass parentId = parentMessage.id (the user message ID)
      // And skipUserMessage = true (so we don't create a duplicate user message)

      await sendMessage(parentMessage.content, parentMessage.id, true);
    }
  },

  editMessage: async (messageId: string, newContent: string) => {
    const { messages, sendMessage } = get();
    const originalMessage = messages.find((m) => m.id === messageId);
    if (!originalMessage) return;

    // To "edit" a message, we create a NEW message with the SAME parentId.
    // This makes it a sibling of the original message (a new version/slide).
    // If the original message was a root (no parent), we pass null/undefined as parentId.
    // We do NOT use skipUserMessage because this IS a user message (the edited version).

    // Note: sendMessage logic will auto-assign parentId if not provided. 
    // But here we explicitly want to use the ORIGINAL parentId, not the "last message" ID.
    // So we must pass it explicitly.

    await sendMessage(newContent, originalMessage.parentId || undefined);
  },

  deleteMessage: async (id: string) => {
    const prevMessages = get().messages;

    // Optimistic soft delete: mark as deleted instead of removing
    set((state) => ({
      messages: state.messages.map((m) => m.id === id ? { ...m, isDeleted: true } : m),
    }));

    try {
      const res = await fetch(`http://localhost:4000/api/messages/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        set({ messages: prevMessages });
      }
    } catch (err) {
      set({ messages: prevMessages });
    }
  },

  restoreMessage: async (id: string) => {
    const prevMessages = get().messages;

    // Optimistic restore
    set((state) => ({
      messages: state.messages.map((m) => m.id === id ? { ...m, isDeleted: false } : m),
    }));

    try {
      const res = await fetch(`http://localhost:4000/api/messages/${id}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        set({ messages: prevMessages });
      }
    } catch (err) {
      set({ messages: prevMessages });
    }
  },

  /* ----------------------------------------------------------------
    RECEIVE AI REPLY (LOCAL ONLY)
 ---------------------------------------------------------------- */
  receiveMessage: (content: string, requestId?: string, parentId?: string) => {
    set((state) => {
      // If this reply doesn't match the active request, ignore it (stale)
      if (requestId && state.activeRequestId !== requestId) {
        return {} as Partial<ChatStore>;
      }

      const assistantMessage: Message = { role: "assistant", content, parentId: parentId || null };
      const updatedMessages = [...state.messages, assistantMessage];

      return {
        messages: updatedMessages,
        awaitingSessionId: null,
        lastUpdatedSessionId: state.currentSessionId,
        activeRequestId: null,
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
    set({ currentSessionId: null, messages: [], pendingSession: false, awaitingSessionId: null, activeRequestId: null, abortController: null }),

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ awaitingSessionId: null, activeRequestId: null, abortController: null });
  },
}));
