// components/chat/MessageBubble.tsx
/**
 * MessageBubble.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders individual chat message bubbles with comprehensive interaction controls.
 * Handles multiple states: active messages, deleted messages, editing mode,
 * and version navigation for branching conversations.
 *
 * ROLE IN PROJECT:
 * - Core building block of chat interface displaying all message content
 * - Provides user interaction controls (copy, edit, delete, regenerate, restore)
 * - Manages version navigation for threaded conversations
 * - Handles both user and assistant message rendering with appropriate styling
 *
 * WHAT THIS FILE DOES:
 * 1. Renders message content with role-specific styling (user vs assistant)
 * 2. Provides interactive controls with hover visibility for cleaner UI
 * 3. Manages editing state with auto-resizing textarea
 * 4. Handles version navigation through sibling messages at same thread level
 * 5. Shows different UI states: active, deleted, and editing modes
 * 6. Integrates with DeleteConfirmationModal for safe deletion operations
 * 7. Uses StreamingMarkdown component for assistant message rendering
 *
 * INPUTS:
 * - `message`: The message object to display (content, role, deleted status)
 * - `siblings`: Array of alternative messages at same thread level for versioning
 * - `currentVersionIndex`: Which sibling is currently selected
 * - `onSelectVersion`: Callback when user selects different message version
 * - `onRegenerate`: Callback to regenerate assistant response
 * - `onDelete`: Callback to soft-delete message (moves to deleted state)
 * - `onEdit`: Callback to edit user message content
 * - `onRestore`: Callback to restore deleted message
 * - `isStreaming`: Whether streaming is active for this assistant message
 *
 * OUTPUTS:
 * - Visual message bubble with interactive controls
 * - User actions forwarded to parent component via callbacks
 * - Edit mode UI with save/cancel functionality
 * - Delete confirmation modal when triggered
 *
 * IMPORTANT:
 * This component manages complex state transitions between editing, deleted,
 * and active states while maintaining proper accessibility and user experience.
 * The hover-based controls reduce visual clutter while keeping functionality accessible.
 * -----------------------------------------------------------------------------
 */

import { ClipboardDocumentIcon, TrashIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, ArrowUturnLeftIcon, PlayIcon } from "@heroicons/react/24/outline";
import { useState, useEffect, useRef } from "react";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import StreamingMarkdown from "./StreamingMarkdown";
import { useChatStore } from "@/lib/store/chatStore";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  isDeleted?: boolean;
  wasManuallyStopped?: boolean;
};

type Props = {
  message: Message;
  siblings?: Message[];
  currentVersionIndex?: number;
  onSelectVersion?: (index: number) => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
  onRestore?: () => void;
  onContinue?: () => void;
  id?: string;
  isStreaming?: boolean;
};

export default function MessageBubble({
  message,
  siblings = [],
  currentVersionIndex = 0,
  onSelectVersion,
  onRegenerate,
  onDelete,
  onEdit,
  onRestore,
  onContinue,
  id,
  isStreaming = false
}: Props) {
  // Component state
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync edit content with message updates
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  // Handle textarea auto-resize when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  // Copy message content to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save edited content and exit edit mode
  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  // Cancel editing and restore original content
  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  // Trigger delete confirmation flow
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  // Execute delete after confirmation
  const handleConfirmDelete = () => {
    if (onDelete) onDelete();
    setShowDeleteModal(false);
  };

  // Show navigation controls if multiple versions exist at this thread level
  const showNavigation = siblings.length > 1;

  // Render content based on message state (deleted, editing, or normal)
  const renderContent = () => {
    // Deleted message state - shows restoration option
    if (message.isDeleted) {
      return (
        <div className="flex items-center gap-2 text-gray-400 text-sm italic bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
          <span>Message deleted — </span>
          {onRestore && (
            <button
              onClick={onRestore}
              className="text-blue-500 hover:text-blue-600 hover:underline not-italic font-medium flex items-center gap-1"
            >
              <ArrowUturnLeftIcon className="h-3 w-3" />
              undo?
            </button>
          )}
        </div>
      );
    }

    // Edit mode - shows textarea with save/cancel controls
    if (isEditing) {
      return (
        <div className="w-full bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            className="w-full resize-none outline-none text-gray-900 text-sm bg-transparent"
            rows={1}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={handleSaveEdit} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
              Save & Submit
            </button>
            <button onClick={handleCancelEdit} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // User messages: plain text with sky blue background
    if (isUser) {
      return (
        <div className="rounded-lg whitespace-pre-wrap break-all overflow-hidden relative bg-sky-100 text-gray-900 p-3 text-left">
          {message.content}
        </div>
      );
    }

    // Assistant messages: markdown with syntax highlighting via StreamingMarkdown
    if (!message.content && !isStreaming) {
      return (
        <div className="rounded-lg relative text-gray-500 px-4 py-3 text-left w-full italic bg-gray-50 border border-dashed border-gray-300 flex flex-col items-start gap-2">
          <span>No response generated.</span>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-md text-xs font-medium not-italic text-gray-700 transition-colors"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Click to regenerate
            </button>
          )}
        </div>
      );
    }

    const sources = message.id ? useChatStore.getState().searchSources[message.id] : undefined;

    return (
      <div className="rounded-lg relative text-gray-900 px-1 py-1 text-left w-full overflow-hidden">
        <StreamingMarkdown content={message.content} isStreaming={isStreaming} sources={sources} />
      </div>
    );
  };

  return (
    <>
      <div id={id} className={`group flex my-3 min-w-0 overflow-hidden ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`flex flex-col min-w-0 overflow-hidden ${isUser ? "max-w-[90%] items-end" : "w-full items-start"}`}>

          {/* Main content area */}
          {renderContent()}

          {/* Controls footer (hidden during editing) */}
          {!isEditing && (
            <div className={`flex items-center gap-2 mt-1 ${isUser ? "self-end" : "self-start"}`}>
              {/* Version navigation - shown when multiple sibling messages exist */}
              {showNavigation && onSelectVersion && (
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium select-none mr-2">
                  <button
                    onClick={() => onSelectVersion(currentVersionIndex - 1)}
                    disabled={currentVersionIndex <= 0}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronLeftIcon className="h-3 w-3" />
                  </button>
                  <span>{currentVersionIndex + 1} / {siblings.length}</span>
                  <button
                    onClick={() => onSelectVersion(currentVersionIndex + 1)}
                    disabled={currentVersionIndex >= siblings.length - 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronRightIcon className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Action buttons - visible on hover, hidden for deleted messages or during streaming */}
              {!message.isDeleted && !isStreaming && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Copy button with temporary success indicator */}
                  <button onClick={handleCopy} title="Copy" className="p-1 hover:bg-gray-200 rounded text-gray-500">
                    {copied ? <span className="text-xs font-bold text-green-600">✓</span> : <ClipboardDocumentIcon className="h-4 w-4" />}
                  </button>

                  {/* Edit for user messages, Delete for assistant messages */}
                  {isUser && onEdit ? (
                    <button onClick={() => setIsEditing(true)} title="Edit" className="p-1 hover:bg-gray-200 rounded text-gray-500">
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    onDelete && (
                      <button onClick={handleDeleteClick} title="Delete" className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )
                  )}

                  {/* Regenerate button for assistant messages */}
                  {onRegenerate && !isUser && (
                    <button onClick={onRegenerate} title="Regenerate" className="p-1 hover:bg-gray-200 rounded text-gray-500">
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                  )}

                  {/* Continue button for manually stopped messages */}
                  {onContinue && !isUser && message.wasManuallyStopped && (
                    <button onClick={onContinue} title="Continue Generation" className="p-1 hover:bg-blue-100 rounded text-blue-600 flex items-center gap-1 px-2 border border-blue-200 ml-1">
                      <PlayIcon className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Continue</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal (rendered conditionally) */}
      <DeleteConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}