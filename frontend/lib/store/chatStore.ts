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
  created_at?: string;
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

  activeRequestId: string | null;

  activeVersions: Record<string, string>;
  setActiveVersion: (parentId: string, messageId: string) => void;

  loadingSessionId: string | null;
  sessionLoadRequestId: string | null;
  sessionLoadAbortController: AbortController | null;

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
  sendMessage: (content: string, parentId?: string | null, skipUserMessage?: boolean, isContinuation?: boolean, projectIdForNewSession?: string | null) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  receiveMessage: (content: string, requestId?: string, parentId?: string) => void;
  getLastActiveMessage: () => Message | null;

  renameSession: (id: string, newTitle: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  restoreMessage: (id: string) => Promise<void>;
};

function sortMessagesByThread(messages: Message[], activeVersions: Record<string, string>): Message[] {
  if (!messages.length) return messages;

  const childrenMap = new Map<string, Message[]>();
  const roots: Message[] = [];
  const messageMap = new Map<string, Message>();

  messages.forEach(m => {
    if (m.id) messageMap.set(m.id, m);
    if (m.parentId) {
      if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
      childrenMap.get(m.parentId)!.push(m);
    } else {
      roots.push(m);
    }
  });

  childrenMap.forEach((children) => {
    children.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  });

  const result: Message[] = [];

  function traverse(currentSiblings: Message[], parentKey: string = 'root') {
    if (!currentSiblings.length) return;

    const activeId = activeVersions[parentKey];
    let activeIndex = -1;

    if (activeId) {
      activeIndex = currentSiblings.findIndex(m => m.id === activeId);
    }

    if (activeIndex === -1) {
      for (let i = 0; i < currentSiblings.length; i++) {
        const msg = currentSiblings[i];
        result.push(msg);
        if (msg.id && childrenMap.has(msg.id)) {
          traverse(childrenMap.get(msg.id)!, msg.id);
        }
      }
    } else {
      for (let i = 0; i <= activeIndex; i++) {
        const msg = currentSiblings[i];
        result.push(msg);
        if (i === activeIndex && msg.id && childrenMap.has(msg.id)) {
          traverse(childrenMap.get(msg.id)!, msg.id);
        }
      }
    }
  }

  traverse(roots);
  return result;
}

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

        if (nextResetAt.getTime() <= Date.now()) {
          nextResetAt = new Date(Date.now() + 60 * 60 * 1000);
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

  loadSessions: async () => {
    await get().checkUsage();
    const sessionsData = await api.get("/api/sessions") as Session[];

    set((state) => ({
      sessions: sessionsData.map((s) => {
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

  startNewSession: async (projectId: string | null = null) => {
    set({ pendingSession: true });

    const session = await api.post("/api/sessions", { project_id: projectId });

    set((state) => {
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

  selectSession: async (id: string) => {
    await get().checkUsage();

    const prev = get().sessionLoadAbortController;
    if (prev) prev.abort();

    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();

    const cached = get().sessions.find((s) => s.id === id)?.messages;
    const isAlreadyActive = get().currentSessionId === id;

    set({
      currentSessionId: id,
      pendingSession: false,
      awaitingSessionId: null,
      loadingSessionId: id,
      sessionLoadRequestId: requestId,
      sessionLoadAbortController: controller,
      messages: cached && cached.length ? cached : (isAlreadyActive ? get().messages : []),
    });

    try {
      const messages = await api.get(`/api/sessions/${id}/messages`, { signal: controller.signal }) as Message[];

      const state = get();
      if (state.currentSessionId !== id) return;
      if (state.sessionLoadRequestId !== requestId) return;

      set((s) => ({
        messages,
        loadingSessionId: null,
        sessionLoadAbortController: null,
        sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, messages } : sess)),
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      const state = get();
      if (state.currentSessionId === id && state.sessionLoadRequestId === requestId) {
        set({ loadingSessionId: null, sessionLoadAbortController: null });
      }
    }
  },

  selectProject: (id: string | null) => {
    set({
      selectedProjectId: id,
      currentSessionId: null,
      messages: [],
      pendingSession: false,
    });
  },

  /* ----------------------------------------------------------------
     SEND MESSAGE TO BACKEND + HANDLE RESPONSE
     IMPROVED: Now handles replication lag by merging server messages
     with local state to prevent messages from vanishing.
     FIXED: Branching issues by properly maintaining parent-child relationships
  ---------------------------------------------------------------- */
  sendMessage: async (content: string, parentId?: string | null, skipUserMessage?: boolean, isContinuation?: boolean, projectIdForNewSession?: string | null) => {
    let currentSessionId = get().currentSessionId;

    // --- 1. INSTANT SYNCHRONOUS UI UPDATE ---
    // We add the user message and set isStreaming state IMMEDIATELY to provide 
    // zero-latency feedback before any network calls start.
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const tempUserMessageId = `temp_user_${Date.now()}`;

    let effectiveParentId = parentId;
    if (effectiveParentId === undefined && !skipUserMessage) {
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
          let activeIndex = currentSiblings.findIndex(m => m.id === activeId);
          if (activeIndex === -1) activeIndex = currentSiblings.length - 1;

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
    set((state) => {
      const newSyncState: Partial<ChatStore> = {
        isStreaming: true,
        activeRequestId: requestId,
        abortController: controller,
      };

      if (!skipUserMessage && !isContinuation) {
        const userMessage: Message = {
          id: tempUserMessageId,
          role: "user",
          content,
          parentId: effectiveParentId || null
        };
        newSyncState.messages = [...state.messages, userMessage];

        if (currentSessionId) {
          const currentSession = state.sessions.find((s) => s.id === currentSessionId);
          if (currentSession && !currentSession.pinned) {
            const otherSessions = state.sessions.filter((s) => s.id !== currentSessionId);
            const pinned = otherSessions.filter((s) => s.pinned);
            const unpinned = otherSessions.filter((s) => !s.pinned);
            newSyncState.sessions = [...pinned, currentSession, ...unpinned];
          }
        }
      }

      if (currentSessionId) {
        newSyncState.awaitingSessionId = currentSessionId;
      }

      return newSyncState;
    });

    let assistantMessageId = "";
    let accumulatedContent = "";
    let confirmedMessageId: string | null = null;

    try {
      // --- 2. BACKGROUND SESSION CREATION (If needed) ---
      // If we don't have a session ID locally (e.g., first message in a new session),
      // we create it in the background to avoid blocking the initial user experience.
      if (!currentSessionId) {
        set({ pendingSession: true });
        const session = await api.post("/api/sessions", { project_id: projectIdForNewSession });

        currentSessionId = session.id;
        set((state) => {
          const pinned = state.sessions.filter((s) => s.pinned);
          const unpinned = state.sessions.filter((s) => !s.pinned);
          const newSessionWithMeta = { ...session, messages: [], pinned: false, project_id: projectIdForNewSession };

          return {
            currentSessionId: session.id,
            sessions: [...pinned, newSessionWithMeta, ...unpinned],
            pendingSession: false,
            awaitingSessionId: session.id
          };
        });
      }

      // --- 3. AUTH & NETWORK ---
      const authHeaders = await getAuthHeaders();

      // eslint-disable-next-line no-console
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

      set({ rateLimitedUntil: null });

      let assistantParentId: string | null | undefined = null;

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      set((state) => {
        if (state.activeRequestId !== requestId) return {};

        if (isContinuation) {
          const targetMessage = parentId
            ? state.messages.find(m => m.id === parentId)
            : [...state.messages].reverse().find(m => m.role === 'assistant');

          if (targetMessage && targetMessage.role === 'assistant') {
            assistantMessageId = targetMessage.id || "";
            accumulatedContent = targetMessage.content;
            assistantParentId = targetMessage.parentId;
            return {
              awaitingSessionId: null,
              messages: state.messages.map(m =>
                m.id === assistantMessageId ? { ...m, wasManuallyStopped: false } : m
              )
            };
          }
        }

        assistantMessageId = `temp_ai_${Date.now()}`;
        assistantParentId = skipUserMessage ? parentId : tempUserMessageId;

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          parentId: assistantParentId
        };

        return {
          messages: [...state.messages, assistantMessage],
        };
      });

      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: !done });

        buffer += chunkValue;
        const lines = buffer.split("\n");
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

              if (data.status) {
                // UI Fluidity Fix: We NO LONGER clear awaitingSessionId on status pulses (connecting, building_context).
                // This ensures the loader/skeleton stays active until the first real 'data.content' 
                // chunk arrives, preventing the "empty screen jump".
                continue;
              }

              if (data.userMessageId) {
                // ID Synchronization: Link the temporary local ID to the permanent DB ID.
                // This keeps the chat thread linear when the user ID transitions.
                set((state) => ({
                  messages: state.messages.map((m) => {
                    if (m.id === tempUserMessageId) return { ...m, id: data.userMessageId };
                    if (m.parentId === tempUserMessageId) return { ...m, parentId: data.userMessageId };
                    return m;
                  })
                }));
                assistantParentId = data.userMessageId;
              }

              if (data.title) {
                set((state) => {
                  const found = state.sessions.some((s) => s.id === currentSessionId);
                  const updatedSessions = found
                    ? state.sessions.map((s) => (s.id === currentSessionId ? { ...s, title: data.title } : s))
                    : [{ id: currentSessionId!, title: data.title, messages: [], pinned: false }, ...state.sessions];
                  return { sessions: updatedSessions, lastUpdatedSessionId: currentSessionId };
                });
              }

              if (data.messageId) {
                // Assistant ID Synchronization: Replace temp AI ID with real ID immediately.
                confirmedMessageId = data.messageId;
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMessageId ? {
                      ...m,
                      id: data.messageId,
                      parentId: assistantParentId
                    } : m
                  )
                }));
                assistantMessageId = data.messageId;
              }

              if (data.content) {
                accumulatedContent += data.content;

                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMessageId ? {
                      ...m,
                      content: accumulatedContent,
                      parentId: assistantParentId
                    } : m
                  ),
                  // Loader management: only clear the loading state once text starts appearing.
                  awaitingSessionId: null,
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

      if (get().currentSessionId === currentSessionId) {
        get().loadSessions();

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const freshMessages: Message[] = await api.get(`/api/sessions/${currentSessionId}/messages`);
          const freshMap = new Map(freshMessages.map(m => [m.id, m]));
          const currentMessages = get().messages;

          const streamedAssistant = currentMessages.find(m =>
            m.id === assistantMessageId || (confirmedMessageId && m.id === confirmedMessageId)
          );

          if (streamedAssistant && confirmedMessageId && !freshMap.has(confirmedMessageId)) {
            const preservedMessage = {
              ...streamedAssistant,
              id: confirmedMessageId,
              parentId: assistantParentId,
            };
            freshMessages.push(preservedMessage);
          } else if (streamedAssistant && confirmedMessageId && freshMap.has(confirmedMessageId)) {
            // DEFENSIVE CHECK: Don't let the fresh fetch overwrite our accumulated text with empty/shorter text
            const freshMsg = freshMap.get(confirmedMessageId);
            if (freshMsg && (!freshMsg.content || freshMsg.content.length < streamedAssistant.content.length)) {
              const preservedMessage = {
                ...streamedAssistant,
                id: confirmedMessageId,
                parentId: assistantParentId,
              };
              // Replace the faulty fetched message with our preserved local state
              const idx = freshMessages.findIndex(m => m.id === confirmedMessageId);
              if (idx !== -1) {
                freshMessages[idx] = preservedMessage;
              }
            }
          }

          if (!skipUserMessage && tempUserMessageId) {
            const userMessage = currentMessages.find(m => m.id === tempUserMessageId);
            const userExists = freshMessages.some(m =>
              m.role === 'user' &&
              m.content === content &&
              m.parentId === effectiveParentId
            );
            if (userMessage && !userExists) {
              freshMessages.push(userMessage);
            }
          }

          const sortedMessages = sortMessagesByThread(freshMessages, get().activeVersions);

          set((s) => ({
            messages: sortedMessages,
            sessions: s.sessions.map((sess) =>
              sess.id === currentSessionId ? { ...sess, messages: sortedMessages } : sess
            )
          }));
        } catch (err) {
          console.error("Failed to refresh messages after stream", err);
        }
      }

      set({ activeRequestId: null, abortController: null, isStreaming: false });

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      get().receiveMessage("⚠️ Error processing request. Connection may have dropped.", requestId);

      // VITAL FIX: Preserve whatever text was successfully streamed before the crash!
      set((state) => {
        const messages = state.messages.map(m => {
          if (m.id === assistantMessageId || (confirmedMessageId && m.id === confirmedMessageId)) {
            return { ...m, wasManuallyStopped: true };
          }
          return m;
        });
        return { isStreaming: false, messages };
      });

    } finally {
      set({ abortController: null, isStreaming: false });
    }
  },

  regenerateResponse: async (messageId: string) => {
    const { messages, sendMessage } = get();
    const messageToRegenerate = messages.find((m) => m.id === messageId);
    if (!messageToRegenerate) return;
    if (messageToRegenerate.role === "assistant") {
      const parentId = messageToRegenerate.parentId;
      if (!parentId) return;
      const parentMessage = messages.find((m) => m.id === parentId);
      if (!parentMessage) return;
      if (!messageToRegenerate.content || messageToRegenerate.wasManuallyStopped) {
        set((state) => ({
          messages: state.messages.map(m => m.id === messageId ? { ...m, isDeleted: true } : m).filter(m => m.id !== messageId)
        }));
        try {
          if (messageId && !messageId.startsWith('temp_')) {
            await api.delete(`/api/messages/${messageId}`);
          }
        } catch (e) { console.error("Failed to delete empty message", e); }
      }
      await sendMessage(parentMessage.content, parentMessage.id, true);
    }
  },

  editMessage: async (messageId: string, newContent: string) => {
    const { messages, sendMessage } = get();
    const originalMessage = messages.find((m) => m.id === messageId);
    if (!originalMessage) return;
    await sendMessage(newContent, originalMessage.parentId);
  },

  deleteMessage: async (id: string) => {
    const prevMessages = get().messages;
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
    set((state) => ({
      messages: state.messages.map((m) => m.id === id ? { ...m, isDeleted: false } : m),
    }));
    try {
      await api.post(`/api/messages/${id}/restore`, {});
    } catch {
      set({ messages: prevMessages });
    }
  },

  receiveMessage: (content: string, requestId?: string, parentId?: string) => {
    set((state) => {
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

  renameSession: (id: string, newTitle: string) =>
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

  pinSession: (id: string) =>
    (async (id: string) => {
      const prev = get().sessions;
      const sessionToPin = prev.find((s) => s.id === id);
      if (!sessionToPin) return;
      const updatedSession = { ...sessionToPin, pinned: true };
      const otherPinned = prev.filter((s) => s.id !== id && s.pinned);
      const unpinned = prev.filter((s) => s.id !== id && !s.pinned);
      set({ sessions: [updatedSession, ...otherPinned, ...unpinned] });
      try {
        await api.patch(`/api/sessions/${id}`, { pinned: true });
      } catch {
        set({ sessions: prev });
      }
    })(id),

  unpinSession: (id: string) =>
    (async (id: string) => {
      const prev = get().sessions;
      const sessionToUnpin = prev.find((s) => s.id === id);
      if (!sessionToUnpin) return;
      const updatedSession = { ...sessionToUnpin, pinned: false };
      const pinned = prev.filter((s) => s.id !== id && s.pinned);
      const otherUnpinned = prev.filter((s) => s.id !== id && !s.pinned);
      set({ sessions: [...pinned, updatedSession, ...otherUnpinned] });
      try {
        await api.patch(`/api/sessions/${id}`, { pinned: false });
      } catch {
        set({ sessions: prev });
      }
    })(id),

  deleteSession: async (id: string) => {
    const prev = get().sessions;
    const prevCurrent = get().currentSessionId;
    const prevMessages = get().messages;
    const prevInputCentered = useUIStore.getState().inputBarCentered;
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      messages: state.currentSessionId === id ? [] : state.messages,
    }));
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
    set((state) => {
      const updatedMessages = state.messages.map((m, idx) => {
        if (idx === state.messages.length - 1 && m.role === 'assistant') {
          return { ...m, wasManuallyStopped: true };
        }
        return m;
      });
      return {
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
      let activeIndex = currentSiblings.findIndex(m => m.id === activeId);
      if (activeIndex === -1) activeIndex = currentSiblings.length - 1;

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