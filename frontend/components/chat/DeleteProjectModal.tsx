import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DeleteProjectModalProps {
    projectName: string;
    onClose: () => void;
    onConfirm: () => void;
}

export default function DeleteProjectModal({
    projectName,
    onClose,
    onConfirm,
}: DeleteProjectModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-2 bg-red-50 rounded-full flex-shrink-0">
                            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-gray-900 font-medium mb-1">
                                Delete &quot;{projectName}&quot;?
                            </p>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                This will dissolve the project folder. Any sessions inside it will NOT be deleted; they will be moved back to your main history list.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                            Delete Project
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
