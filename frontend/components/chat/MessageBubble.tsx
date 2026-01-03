import { ClipboardDocumentIcon, TrashIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { useState, useEffect, useRef } from "react";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  isDeleted?: boolean;
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
};

export default function MessageBubble({
  message,
  siblings = [],
  currentVersionIndex = 0,
  onSelectVersion,
  onRegenerate,
  onDelete,
  onEdit,
  onRestore
}: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (onDelete) onDelete();
    setShowDeleteModal(false);
  };

  const showNavigation = siblings.length > 1;

  // If message is deleted, show placeholder
  if (message.isDeleted) {
    return (
      <div className={`group flex my-3 ${isUser ? "justify-end" : "justify-start"}`}>
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
      </div>
    );
  }

  return (
    <>
      <div className={`group flex my-3 ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`flex flex-col max-w-[90%] ${isUser ? "items-end" : "items-start"}`}>

          {isEditing ? (
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
          ) : (
            <div
              className={`
                rounded-lg whitespace-pre-wrap relative
                ${isUser ? "bg-sky-100 text-gray-900 p-3 text-left" : "text-gray-900 px-1 py-1 text-left"}
              `}
            >
              {message.content}
            </div>
          )}

          {!isEditing && (
            <div className={`flex items-center gap-2 mt-1 ${isUser ? "self-end" : "self-start"}`}>
              {/* Slide Navigation */}
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

              {/* Actions (Copy, Delete/Edit, Regenerate) - Visible on Hover */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleCopy} title="Copy" className="p-1 hover:bg-gray-200 rounded text-gray-500">
                  {copied ? <span className="text-xs font-bold text-green-600">✓</span> : <ClipboardDocumentIcon className="h-4 w-4" />}
                </button>

                {/* Edit for User, Delete for AI */}
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

                {onRegenerate && !isUser && (
                  <button onClick={onRegenerate} title="Regenerate" className="p-1 hover:bg-gray-200 rounded text-gray-500">
                    <ArrowPathIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
