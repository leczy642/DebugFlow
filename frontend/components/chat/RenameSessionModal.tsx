// components/chat/RenameSessionModal.tsx
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
  const [newTitle, setNewTitle] = useState(currentTitle);

  const handleSubmit = () => {
    if (newTitle.trim() !== "") {
      onConfirm(newTitle.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Rename session</h2>
        
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
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