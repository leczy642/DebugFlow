// components/chat/SessionHeader.tsx
"use client";
import { useChatStore } from '../../lib/store/chatStore';
import { useUIStore } from "../../lib/store/uiStore";

export default function SessionHeader() {
  const { currentSessionId, sessions } = useChatStore();
  const { sidebarOpen } = useUIStore();

  if (!currentSessionId) return null;

  const currentSession = sessions.find(s => s.id === currentSessionId);
  if (!currentSession) return null;

  const sidebarWidth = sidebarOpen ? 256 : 64;

  return (
    <div
      className="fixed z-40 bg-white border-b border-[#E5E5E5] flex items-center justify-center"
      style={{
        left: `${sidebarWidth}px`,
        right: 0,
        top: 0,
        minHeight: '61px', // Match sidebar header height (py-3 = 12px top + 12px bottom + ~24px content)
      }}
    >
      <div className="max-w-4xl w-full px-4 py-3 flex items-center justify-center">
        <h1
          className="text-sm font-medium text-[#1A1A1A] text-center w-full"
          style={{
            margin: 0,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            hyphens: 'auto',
          }}
        >
          {currentSession.title}
        </h1>
      </div>
    </div>
  );
}