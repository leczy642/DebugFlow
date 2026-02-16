// lib/store/chatStore.ts
//
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
import { api, getAuthHeaders, BASE_URL } from '@/lib/api';

const TIER_LIMITS: Record<string, number> = {
  'free': 100,
  'basic': 500,
  'pro': 2000,
  'teams': 5000
};

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  isDeleted?: boolean;
  wasManuallyStopped?: boolean;
};

type Session = {
  id: string;            // UUID from Postgres
  title: string;
  messages: Message[];
  pinned?: boolean;
  project_id?: string | null;
  created_at?: string;
};

type Project = {
  id: string;
  name: string;
  context_instructions?: string;
  context_enabled?: boolean;  // defaults to true
};

type ChatStore = {
  sessions: Session[];
  projects: Project[];
  currentSessionId: string | null;
  selectedProjectId: string | null;
  messages: Message[];
  pendingSession: boolean;
  lastUpdatedSessionId: string | null;
  awaitingSessionId: string | null;
  isStreaming: boolean;
  abortController: AbortController | null;
  rateLimitedUntil: string | null;
  clearRateLimit: () => void;
  checkUsage: () => Promise<void>;

  // Tracks the in-flight request that should be accepted when a reply arrives.
  // When starting a new session or cancelling, this is set to null so older
  // responses are ignored.
  activeRequestId: string | null;

  // Threading
  activeVersions: Record<string, string>;
  setActiveVersion: (parentId: string, messageId: string) => void;

  // Session switching (message load) control to avoid stale updates + speed up switching
  loadingSessionId: string | null;
  sessionLoadRequestId: string | null;
  sessionLoadAbortController: AbortController | null;

  // Reset UI/chat to default view (no active session, empty messages)
  resetToDefault: () => void;
  stopGeneration: () => void;

  loadSessions: () => Promise<void>;
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  assignSessionToProject: (sessionId: string, projectId: string | null) => Promise<void>;
  renameProject: (id: string, newName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProjectContext: (id: string, instructions: string) => Promise<void>;
  toggleProjectContext: (id: string, enabled: boolean) => Promise<void>;
  getProjectWithContext: (id: string) => Promise<Project | null>;

  startNewSession: (projectId?: string | null) => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  selectProject: (id: string | null) => void;
  sendMessage: (content: string, parentId?: string | null, skipUserMessage?: boolean, isContinuation?: boolean) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  // Optional requestId used to ignore stale replies (when user started a new session)
  receiveMessage: (content: string, requestId?: string, parentId?: string) => void;
  getLastActiveMessage: () => Message | null;

  renameSession: (id: string, newTitle: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  restoreMessage: (id: string) => Promise<void>;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  projects: [],
  currentSessionId: null,
  selectedProjectId: null,
  messages: [],
  pendingSession: false,
  lastUpdatedSessionId: null,
  awaitingSessionId: null,
  isStreaming: false,
  abortController: null,
  activeRequestId: null,
  rateLimitedUntil: null,

  clearRateLimit: () => set({ rateLimitedUntil: null }),

  checkUsage: async () => {
    try {
      const profile = await api.get("/api/user/profile/full");
      const { role, tier, daily_requests_count, rate_limit_reset_at } = profile;

      // Super users are exempt from rate limits
      if (role === 'super_user') {
        set({ rateLimitedUntil: null });
        return;
      }

      const tierName = (tier || 'free').toLowerCase();
      const limit = TIER_LIMITS[tierName] || TIER_LIMITS['free'];
      const currentCount = Number(daily_requests_count) || 0;

      if (currentCount >= limit) {
        const resetAt = new Date(rate_limit_reset_at || Date.now());
        let nextResetAt = new Date(resetAt.getTime() + 24 * 60 * 60 * 1000);

        // If the calculated reset time is in the past but the count is still high,
        // it means the backend hasn't hit its 24h reset window yet.
        // We ensure a valid future string is set so UI stays disabled.
        if (nextResetAt.getTime() <= Date.now()) {
          nextResetAt = new Date(Date.now() + 60 * 60 * 1000); // Fallback to 1 hour from now
        }

        set({ rateLimitedUntil: nextResetAt.toISOString() });
      } else {
        set({ rateLimitedUntil: null });
      }
    } catch (err) {
      console.error("Failed to check usage:", err);
    }
  },

  loadingSessionId: null,
  sessionLoadRequestId: null,
  sessionLoadAbortController: null,
  activeVersions: {},

  /* ----------------------------------------------------------------
     LOAD EXISTING SESSIONS FROM SERVER
  ---------------------------------------------------------------- */
  loadSessions: async () => {
    await get().checkUsage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionsData: any[] = await api.get("/api/sessions");

    set((state) => ({
      sessions: sessionsData.map((s) => {
        // Find if we already have this session and preserve its message cache if any
        const existing = state.sessions.find((prev) => prev.id === s.id);
        return {
          ...s,
          messages: existing?.messages || [],
          pinned: typeof s.pinned === "boolean" ? s.pinned : false,
        };
      }),
    }));
  },

  loadProjects: async () => {
    const projects = await api.get("/api/projects");
    set({ projects });
  },

  createProject: async (name: string) => {
    const project = await api.post("/api/projects", { name });
    set((state) => ({
      projects: [project, ...state.projects],
    }));
  },

  renameProject: async (id: string, newName: string) => {
    const prev = get().projects;
    const trimmed = newName.trim();
    set((state) => ({
      projects: state.projects.map((p) => p.id === id ? { ...p, name: trimmed } : p)
    }));

    try {
      await api.patch(`/api/projects/${id}`, { name: trimmed });
    } catch {
      set({ projects: prev });
    }
  },

  deleteProject: async (id: string) => {
    const prevProjects = get().projects;
    const prevSessions = get().sessions;

    // Optimistic delete: remove project, move its sessions to root (project_id = null)
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      sessions: state.sessions.map(s => s.project_id === id ? { ...s, project_id: null } : s)
    }));

    try {
      await api.delete(`/api/projects/${id}`);
    } catch {
      set({ projects: prevProjects, sessions: prevSessions });
    }
  },

  assignSessionToProject: async (sessionId: string, projectId: string | null) => {
    const prev = get().sessions;
    set((state) => ({
      sessions: state.sessions.map((s) => s.id === sessionId ? { ...s, project_id: projectId } : s)
    }));

    try {
      await api.patch(`/api/sessions/${sessionId}`, { project_id: projectId });
    } catch {
      set({ sessions: prev });
    }
  },

  updateProjectContext: async (id: string, instructions: string) => {
    const prev = get().projects;
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, context_instructions: instructions } : p
      )
    }));

    try {
      await api.patch(`/api/projects/${id}/context`, { context_instructions: instructions });
    } catch {
      set({ projects: prev });
    }
  },

  toggleProjectContext: async (id: string, enabled: boolean) => {
    const prev = get().projects;
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, context_enabled: enabled } : p
      )
    }));

    try {
      await api.patch(`/api/projects/${id}/context-toggle`, { context_enabled: enabled });
    } catch {
      set({ projects: prev });
    }
  },

  getProjectWithContext: async (id: string) => {
    try {
      const project = await api.get(`/api/projects/${id}`);
      // Update local state with full project data
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...project } : p
        )
      }));
      return project;
    } catch {
      return null;
    }
  },

  /* ----------------------------------------------------------------
    CREATE NEW SESSION (SERVER + LOCAL STATE)
  ---------------------------------------------------------------- */
  startNewSession: async (projectId: string | null = null) => {
    set({ pendingSession: true });

    const session = await api.post("/api/sessions", { project_id: projectId });

    set((state) => {
      // Insert new unpinned session after all pinned sessions
      const pinned = state.sessions.filter((s) => s.pinned);
      const unpinned = state.sessions.filter((s) => !s.pinned);

      const newSessionWithMeta = { ...session, messages: [], pinned: false, project_id: projectId };

      return {
        sessions: [...pinned, newSessionWithMeta, ...unpinned],
        currentSessionId: session.id,
        messages: [],
        pendingSession: false,
      };
    });
  },

  /* ----------------------------------------------------------------
    SELECT SESSION & LOAD ITS MESSAGES
  ---------------------------------------------------------------- */
  selectSession: async (id: string) => {
    await get().checkUsage(); // Proactive check on click

    // Abort any in-flight session message load to prevent "late" updates
    const prev = get().sessionLoadAbortController;
    if (prev) prev.abort();

    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();

    // Show cached messages immediately if we already loaded this session once
    const cached = get().sessions.find((s) => s.id === id)?.messages;
    const isAlreadyActive = get().currentSessionId === id;

    set({
      currentSessionId: id,
      pendingSession: false,
      awaitingSessionId: null,
      loadingSessionId: id,
      sessionLoadRequestId: requestId,
      sessionLoadAbortController: controller,
      // Only reset messages to [] if we aren't already on this session and have no cache
      messages: cached && cached.length ? cached : (isAlreadyActive ? get().messages : []),
    });

    try {
      // api.get might not support {signal}; if it doesn't, the requestId guards still prevent stale state updates.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: any = await api.get(`/api/sessions/${id}/messages`, { signal: controller.signal });

      const state = get();
      if (state.currentSessionId !== id) return;
      if (state.sessionLoadRequestId !== requestId) return;

      set((s) => ({
        messages,
        loadingSessionId: null,
        sessionLoadAbortController: null,
        sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, messages } : sess)),
      }));
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      const state = get();
      if (state.currentSessionId === id && state.sessionLoadRequestId === requestId) {
        set({ loadingSessionId: null, sessionLoadAbortController: null });
      }
    }
  },

  selectProject: (id: string | null) => {
    set({
      selectedProjectId: id,
      currentSessionId: null, // Deselect any active session
      messages: [],
      pendingSession: false,
    });
  },

  /* ----------------------------------------------------------------
     SEND MESSAGE TO BACKEND + HANDLE RESPONSE
     IMPROVED: Now handles replication lag by merging server messages
     with local state to prevent messages from vanishing.
  ---------------------------------------------------------------- */
  sendMessage: async (content: string, parentId?: string | null, skipUserMessage?: boolean, isContinuation?: boolean) => {
    const { currentSessionId, messages } = get();
    if (!currentSessionId) return;

    // If no parentId is provided (normal chat flow), use the leaf of the CURRENT ACTIVE BRANCH
    // This ensures linear conversation history based on what the user is seeing.
    // If skipUserMessage is true (regeneration), parentId MUST be provided by caller.
    let effectiveParentId = parentId;
    if (effectiveParentId === undefined && !skipUserMessage) {
      // Traverse the thread using activeVersions to find the leaf
      const { messages, activeVersions } = get();
      if (messages.length > 0) {
        const childrenMap = new Map<string, Message[]>();
        const roots: Message[] = [];

        messages.forEach(m => {
          if (m.parentId) {
            if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
            childrenMap.get(m.parentId)!.push(m);
          } else {
            roots.push(m);
          }
        });

        let currentSiblings = roots;
        let parentIdKey = 'root';
        let lastMsg: Message | null = null;

        while (currentSiblings.length > 0) {
          const activeId = activeVersions[parentIdKey];
          let activeIndex = -1;

          if (activeId) {
            activeIndex = currentSiblings.findIndex(m => m.id === activeId);
          }

          // Default to latest if no active selection
          if (activeIndex === -1) {
            activeIndex = currentSiblings.length - 1;
          }

          const activeMessage = currentSiblings[activeIndex];
          lastMsg = activeMessage;

          if (activeMessage.id && childrenMap.has(activeMessage.id)) {
            currentSiblings = childrenMap.get(activeMessage.id)!;
            parentIdKey = activeMessage.id;
          } else {
            currentSiblings = [];
          }
        }

        if (lastMsg && lastMsg.id && !lastMsg.id.startsWith('temp_')) {
          effectiveParentId = lastMsg.id;
        }
      }
    }

    // Create a small locally-unique request id so we can ignore stale replies
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const tempUserMessageId = `temp_user_${Date.now()}`;

    set((state) => {
      let newSessions = state.sessions;
      if (!skipUserMessage && !isContinuation) {
        const userMessage: Message = {
          id: tempUserMessageId,
          role: "user",
          content,
          parentId: effectiveParentId || null
        };
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
          isStreaming: true,
          activeRequestId: requestId,
          abortController: controller,
        };
      }

      return {
        awaitingSessionId: currentSessionId,
        isStreaming: true,
        activeRequestId: requestId,
        abortController: controller,
      };
    });

    try {
      const authHeaders = await getAuthHeaders();

      // DEBUG: Log the payload being sent
      console.log("[Chat Debug] Sending to Backend:", {
        sessionId: currentSessionId,
        message: content,
        parentId: effectiveParentId,
        skipUserMessage,
        isContinuation,
        activeVersionsSnapshot: get().activeVersions
      });

      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: content,
          parentId: effectiveParentId,
          skipUserMessage,
          isContinuation,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          const errorData = await res.json().catch(() => ({}));
          set({ rateLimitedUntil: errorData.reset_at || new Date(Date.now() + 3600000).toISOString() });
          throw new Error(errorData.message || "Rate limit exceeded");
        }
        throw new Error("Failed to send message");
      }

      set({ rateLimitedUntil: null }); // Clear on success

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantMessageId = "";
      let accumulatedContent = "";
      let confirmedMessageId: string | null = null;

      // Create a placeholder message for the assistant (if not continuation)
      set((state) => {
        // Only add if we are the active request
        if (state.activeRequestId !== requestId) return {};

        if (isContinuation) {
          // Find the specific assistant message to append to (using parentId if provided, which should be the AI msg ID)
          const targetMessage = parentId
            ? state.messages.find(m => m.id === parentId)
            : [...state.messages].reverse().find(m => m.role === 'assistant');

          if (targetMessage && targetMessage.role === 'assistant') {
            assistantMessageId = targetMessage.id || "";
            accumulatedContent = targetMessage.content;
            return {
              awaitingSessionId: null,
              messages: state.messages.map(m =>
                m.id === assistantMessageId ? { ...m, wasManuallyStopped: false } : m
              )
            };
          }
        }

        // Generate a temporary ID for the assistant message so we can update it
        assistantMessageId = `temp_ai_${Date.now()}`;

        // IMPORTANT: Link to the temp user message ID if we just created one.
        // If regenerating (skipUserMessage), link to the existing parentId.
        const parentIdForAssistant = skipUserMessage ? parentId : tempUserMessageId;

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          parentId: parentIdForAssistant
        };

        return {
          messages: [...state.messages, assistantMessage],
          // awaitingSessionId remains set to keep TypingBubble visible until content arrives
        };
      });

      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: !done });

        // DEBUG: Log the raw chunk value to see what's coming from Lambda
        console.log("[Chat Debug] Received chunk:", chunkValue);

        buffer += chunkValue;
        const lines = buffer.split("\n");

        // The last line might be incomplete, so we keep it in the buffer
        // and process it in the next iteration.
        // Unless we are done, in which case we process everything.
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }

            try {
              const data = JSON.parse(dataStr);

              if (data.title) {
                // Handle title update
                set((state) => {
                  const found = state.sessions.some((s) => s.id === currentSessionId);
                  const updatedSessions = found
                    ? state.sessions.map((s) => (s.id === currentSessionId ? { ...s, title: data.title } : s))
                    : [{ id: currentSessionId!, title: data.title, messages: [], pinned: false }, ...state.sessions];
                  return { sessions: updatedSessions, lastUpdatedSessionId: currentSessionId };
                });
              }

              if (data.messageId) {
                confirmedMessageId = data.messageId;
                // Immediately update the assistant message ID in local state
                // This ensures we don't lose the message during the final merge
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMessageId ? { ...m, id: data.messageId } : m
                  )
                }));
                assistantMessageId = data.messageId; // update local variable too
              }

              if (data.content) {
                accumulatedContent += data.content;

                // Update the assistant message in the store
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m
                  ),
                  awaitingSessionId: null, // Clear loading state as soon as we have content
                }));
              }

              if (data.error) {
                get().receiveMessage("⚠️ " + data.error, requestId);
              }

            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }

      // After response is done, refresh to get the real DB data (IDs + title)
      if (get().currentSessionId === currentSessionId) {
        // Refresh metadata (title, etc)
        get().loadSessions();

        // CRITICAL: Fetch the REAL messages from DB to get the UUIDs 
        // replacing the temp_ai_ IDs. However, due to replication lag,
        // the new message might not be in the DB yet. We merge with local state
        // to prevent the assistant message from vanishing.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const freshMessages: Message[] = await api.get(`/api/sessions/${currentSessionId}/messages`);

          // Create a map of fresh messages by ID for quick lookup
          const freshMap = new Map(freshMessages.map(m => [m.id, m]));

          // Get current local messages
          const currentMessages = get().messages;

          // Locate the assistant message we just streamed (could be temp or confirmed ID)
          const streamedAssistant = currentMessages.find(m =>
            m.id === assistantMessageId || (confirmedMessageId && m.id === confirmedMessageId)
          );

          // CLIENT-SIDE PATCH FOR REPLICATION LAG
          // If we have a confirmedMessageId but it's not in the fresh list yet,
          // manually append our local version (with the correct ID) to prevent vanishing.
          if (streamedAssistant && confirmedMessageId && !freshMap.has(confirmedMessageId)) {
            console.warn("[Chat] Replication lag detected, preserving assistant message locally", confirmedMessageId);

            // Create a finalized message object using the confirmed ID
            const preservedMessage = {
              ...streamedAssistant,
              id: confirmedMessageId,
              // Ensure we don't keep temp ID
            };
            freshMessages.push(preservedMessage);
          }

          // Also ensure the user message (if any) is present in the merged result
          if (!skipUserMessage && tempUserMessageId) {
            const userMessage = currentMessages.find(m => m.id === tempUserMessageId);
            // Check if a similar user message already exists (by content and role)
            const userExists = freshMessages.some(m =>
              m.role === 'user' &&
              m.content === content &&
              m.parentId === effectiveParentId
            );
            if (userMessage && !userExists) {
              // If we can't find the user message, add it as a fallback
              freshMessages.push(userMessage);
            }
          }

          set((s) => ({
            messages: freshMessages,
            sessions: s.sessions.map((sess) =>
              sess.id === currentSessionId ? { ...sess, messages: freshMessages } : sess
            )
          }));
        } catch (err) {
          console.error("Failed to refresh messages after stream", err);
          // If refresh fails, keep the current messages to prevent data loss
        }
      }

      set({ activeRequestId: null, abortController: null, isStreaming: false });

    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (err.name === 'AbortError') {
        return;
      }

      get().receiveMessage("⚠️ Error processing request", requestId);
      set({ isStreaming: false });
    } finally {
      set({ abortController: null, isStreaming: false });
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

      // New requirement: If the message to regenerate is empty or manually stopped (e.g. error/empty state),
      // remove it so the new generation replaces it visually.
      if (!messageToRegenerate.content || messageToRegenerate.wasManuallyStopped) {
        set((state) => ({
          messages: state.messages.map(m => m.id === messageId ? { ...m, isDeleted: true } : m).filter(m => m.id !== messageId) // Hard remove from memory for "disappear" effect
        }));
        try {
          if (messageId && !messageId.startsWith('temp_')) {
            await api.delete(`/api/messages/${messageId}`);
          }
        } catch (e) { console.error("Failed to delete empty message", e); }
      }

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

    await sendMessage(newContent, originalMessage.parentId);
  },

  deleteMessage: async (id: string) => {
    const prevMessages = get().messages;

    // Optimistic soft delete: mark as deleted instead of removing
    set((state) => ({
      messages: state.messages.map((m) => m.id === id ? { ...m, isDeleted: true } : m),
    }));

    try {
      await api.delete(`/api/messages/${id}`);
    } catch {
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
      await api.post(`/api/messages/${id}/restore`, {});
    } catch {
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
        await api.patch(`/api/sessions/${id}`, { title: trimmed });
      } catch {
        set({ sessions: prev });
      }
    })(id, newTitle),

  pinSession: (id) =>
    // Optimistic pin with server persistence
    (async (id: string) => {
      const prev = get().sessions;
      const sessionToPin = prev.find((s) => s.id === id);
      if (!sessionToPin) return;

      // Update pinned status
      const updatedSession = { ...sessionToPin, pinned: true };

      // Reorder: New pinned session goes to TOP of pinned list
      // (assuming user wants their most recently pinned item accessible, or we treat it as "updated")
      const otherPinned = prev.filter((s) => s.id !== id && s.pinned);
      const unpinned = prev.filter((s) => s.id !== id && !s.pinned);

      set({ sessions: [updatedSession, ...otherPinned, ...unpinned] });

      try {
        await api.patch(`/api/sessions/${id}`, { pinned: true });
      } catch {
        set({ sessions: prev });
      }
    })(id),

  unpinSession: (id) =>
    // Optimistic unpin with server persistence
    (async (id: string) => {
      const prev = get().sessions;
      const sessionToUnpin = prev.find((s) => s.id === id);
      if (!sessionToUnpin) return;

      const updatedSession = { ...sessionToUnpin, pinned: false };

      // Reorder: Unpinned session goes to TOP of unpinned list (recently modified)
      const pinned = prev.filter((s) => s.id !== id && s.pinned);
      const otherUnpinned = prev.filter((s) => s.id !== id && !s.pinned);

      set({ sessions: [...pinned, updatedSession, ...otherUnpinned] });

      try {
        await api.patch(`/api/sessions/${id}`, { pinned: false });
      } catch {
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
      await api.delete(`/api/sessions/${id}`);
    } catch {
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
  resetToDefault: () => {
    const { sessionLoadAbortController } = get();
    if (sessionLoadAbortController) sessionLoadAbortController.abort();

    set({
      currentSessionId: null,
      selectedProjectId: null,
      messages: [],
      pendingSession: false,
      awaitingSessionId: null,
      activeRequestId: null,
      abortController: null,
      isStreaming: false,
      loadingSessionId: null,
      sessionLoadRequestId: null,
      sessionLoadAbortController: null,
      activeVersions: {},
    });
  },

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }

    // Also clear messages that are still temporary if they are empty
    set((state) => {
      const updatedMessages = state.messages.map((m, idx) => {
        if (idx === state.messages.length - 1 && m.role === 'assistant') {
          return { ...m, wasManuallyStopped: true };
        }
        return m;
      });

      return {
        // Keep empty messages if they were manually stopped so user can regenerate
        messages: updatedMessages.filter(m => (!m.id?.startsWith('temp_ai_') || m.content.trim() !== '') || m.wasManuallyStopped),
        awaitingSessionId: null,
        activeRequestId: null,
        abortController: null,
        isStreaming: false
      };
    });
  },

  setActiveVersion: (parentId: string, messageId: string) => {
    set((state) => ({
      activeVersions: {
        ...state.activeVersions,
        [parentId]: messageId
      }
    }));
  },


  getLastActiveMessage: () => {
    const { messages, activeVersions } = get();
    if (!messages.length) return null;

    const childrenMap = new Map<string, Message[]>();
    const roots: Message[] = [];

    messages.forEach(m => {
      if (m.parentId) {
        if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
        childrenMap.get(m.parentId)!.push(m);
      } else {
        roots.push(m);
      }
    });

    let currentSiblings = roots;
    let parentIdKey = 'root';
    let lastMsg: Message | null = null;

    while (currentSiblings.length > 0) {
      const activeId = activeVersions[parentIdKey];
      let activeIndex = -1;

      if (activeId) {
        activeIndex = currentSiblings.findIndex(m => m.id === activeId);
      }

      if (activeIndex === -1) {
        activeIndex = currentSiblings.length - 1;
      }

      const activeMessage = currentSiblings[activeIndex];
      lastMsg = activeMessage;

      if (activeMessage.id && childrenMap.has(activeMessage.id)) {
        currentSiblings = childrenMap.get(activeMessage.id)!;
        parentIdKey = activeMessage.id;
      } else {
        currentSiblings = [];
      }
    }
    return lastMsg;
  },
}));
