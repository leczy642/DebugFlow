// components/chat/RenameSessionModal.tsx
/**
 * RenameSessionModal.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders a modal dialog for renaming chat sessions with input validation.
 * Provides a simple interface for users to update session titles while
 * maintaining clean, descriptive names for conversation history.
 *
 * ROLE IN PROJECT:
 * - User experience component for session management operations
 * - Provides data integrity through input validation (non-empty titles)
 * - Reusable modal for session renaming throughout the application
 * - Part of the session organization and management workflow
 *
 * WHAT THIS FILE DOES:
 * 1. Displays a modal with the current session title as default value
 * 2. Provides a focused text input for editing the session title
 * 3. Validates input to prevent empty session names
 * 4. Offers cancel and confirm actions with appropriate styling
 * 5. Supports keyboard navigation (Enter to submit, Escape to cancel)
 * 6. Uses semi-transparent backdrop to maintain context
 *
 * INPUTS:
 * - `currentTitle`: The existing session title (pre-populates input field)
 * - `onClose`: Callback to close the modal without saving changes
 * - `onConfirm`: Callback to execute with new title when user confirms rename
 *
 * OUTPUTS:
 * - Modal visibility state (controlled by parent component)
 * - Updated session title passed to parent via onConfirm callback
 * - User cancellation of rename operation via onClose callback
 *
 * IMPORTANT:
 * This component ensures session titles are never empty by validating
 * input before allowing confirmation. The Enter key shortcut provides
 * efficient workflow for keyboard users.
 * -----------------------------------------------------------------------------
 */

"use client";

import { useState } from "react";

interface RenameSessionModalProps {
  currentTitle: string;
  onClose: () => void;
  onConfirm: (newTitle: string) => void;
}

export default function RenameSessionModal({
  currentTitle,
  onClose,
  onConfirm,
}: RenameSessionModalProps) {
  // Local state for edited title, initialized with current value
  const [newTitle, setNewTitle] = useState(currentTitle);

  // Validate and submit the new title
  const handleSubmit = () => {
    if (newTitle.trim() !== "") {
      onConfirm(newTitle.trim());
    }
  };

  return (
    // Modal backdrop - dims background and prevents interaction with underlying content
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      {/* Modal container - centered with responsive max width */}
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Modal header */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Rename session</h2>

        {/* Title input field with auto-focus and keyboard support */}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {/* Action buttons */}
        <div className="flex justify-end gap-3 mt-6">
          {/* Cancel button - secondary action */}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          {/* Confirm button - primary action, disabled for empty input */}
          <button
            onClick={handleSubmit}
            disabled={!newTitle.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}