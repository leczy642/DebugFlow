// components/chat/DeleteSessionModal.tsx
/**
 * DeleteSessionModal.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders a confirmation modal specifically for deleting entire chat sessions.
 * Provides explicit warning about permanent data loss to prevent accidental deletion
 * of conversation history.
 *
 * ROLE IN PROJECT:
 * - Critical safety component for session management operations
 * - Prevents irreversible data loss through explicit user confirmation
 * - Reusable modal for session deletion throughout the application
 * - Part of the session management user interface in the sidebar
 *
 * WHAT THIS FILE DOES:
 * 1. Displays a modal with the session title being deleted for context
 * 2. Shows clear warning about permanent data loss (cannot be recovered)
 * 3. Provides two action options: Cancel (safe) and Delete (destructive)
 * 4. Uses semi-transparent backdrop to focus user attention
 * 5. Implements proper z-index layering above other interface elements
 *
 * INPUTS:
 * - `sessionTitle`: The name/title of the session to be deleted (for user confirmation)
 * - `onClose`: Callback to close the modal without taking action
 * - `onConfirm`: Callback to execute when user confirms permanent deletion
 *
 * OUTPUTS:
 * - Modal visibility (controlled by parent component)
 * - User confirmation or cancellation of session deletion
 * - Potential permanent removal of chat session and all associated messages
 *
 * IMPORTANT:
 * This component handles PERMANENT deletion operations (unlike message deletion).
 * Once confirmed, sessions cannot be restored, which is why this modal includes
 * explicit warnings about irreversibility.
 * -----------------------------------------------------------------------------
 */

"use client";

interface DeleteSessionModalProps {
  sessionTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteSessionModal({
  sessionTitle,
  onClose,
  onConfirm,
}: DeleteSessionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Delete session?</h2>
        <p className="text-sm text-gray-600 mb-1">
          Are you sure you want to delete "{sessionTitle}"?
        </p>
        <p className="text-sm text-red-600 mb-6 font-medium">
          Deleted sessions can never be recovered.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

