// components/chat/SessionActionsDropdown.tsx
import { useEffect, useRef } from "react";
import {
  PencilIcon,
  BookmarkIcon,
  ShareIcon,
  TrashIcon,
  FolderIcon,
  FolderMinusIcon
} from "@heroicons/react/24/outline";

interface SessionActionsDropdownProps {
  sessionId: string;
  onClose: () => void;
  onRename: (id: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToProject: (id: string) => void;
  onRemoveFromProject?: (id: string) => void;
  isPinned: boolean;
  isInProject?: boolean;
  position: { top: number; right?: number; left?: number; above?: boolean };
  anchorToParent?: boolean;
}

export default function SessionActionsDropdown({
  sessionId,
  onClose,
  onRename,
  onPin,
  onUnpin,
  onDelete,
  onAddToProject,
  onRemoveFromProject,
  isPinned,
  isInProject,
  position,
  anchorToParent = false,
}: SessionActionsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const baseClass = anchorToParent
    ? "absolute z-50 min-w-[140px] bg-white rounded-lg shadow-lg border border-gray-200 py-1"
    : "fixed z-50 min-w-[115px] bg-white rounded-lg shadow-lg border border-gray-200 py-1";

  const style = anchorToParent
    ? position.above
      // Place above the anchor element
      ? {
        bottom: "100%",
        right: 0,
        marginBottom: "4px",
      }
      // Default: place below the anchor element
      : {
        top: "100%",
        right: 0,
        marginTop: "4px",
      }
    : {
      top: `${position.top}px`,
      right: position.right !== undefined ? `${position.right}px` : undefined,
      left: position.left !== undefined ? `${position.left}px` : undefined,
      bottom: position.above ? "auto" : undefined,
    };

  return (
    <div
      ref={dropdownRef}
      className={baseClass}
      style={style}
    >
      <button
        onClick={() => {
          onRename(sessionId);
          onClose();
        }}
        className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <PencilIcon className="h-4 w-4" />
        Rename
      </button>
      <button
        onClick={() => {
          if (isPinned) {
            onUnpin(sessionId);
          } else {
            onPin(sessionId);
          }
          onClose();
        }}
        className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <BookmarkIcon className="h-4 w-4" />
        {isPinned ? "Unpin" : "Pin"}
      </button>
      <button className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
        <ShareIcon className="h-4 w-4" />
        Share
      </button>
      {isInProject && onRemoveFromProject ? (
        <>
          <button
            onClick={() => {
              onAddToProject(sessionId);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <FolderIcon className="h-4 w-4" />
            Move to project
          </button>
          <button
            onClick={() => {
              onRemoveFromProject(sessionId);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <FolderMinusIcon className="h-4 w-4" />
            Remove from folder
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            onAddToProject(sessionId);
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        >
          <FolderIcon className="h-4 w-4" />
          Add to project
        </button>
      )}
      <div className="border-t border-gray-100 my-0.5"></div>
      <button
        onClick={() => {
          onDelete(sessionId);
          onClose();
        }}
        className="w-full text-left px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <TrashIcon className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}