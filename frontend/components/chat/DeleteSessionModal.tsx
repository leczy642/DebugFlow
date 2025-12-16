// components/chat/DeleteSessionModal.tsx
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

