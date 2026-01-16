
import { XMarkIcon, FolderIcon } from "@heroicons/react/24/outline";

interface Project {
    id: string;
    name: string;
}

interface AddToProjectModalProps {
    onClose: () => void;
    onConfirm: (projectId: string | null) => void;
    projects: Project[];
    currentProjectId?: string | null;
}

export default function AddToProjectModal({ onClose, onConfirm, projects, currentProjectId }: AddToProjectModalProps) {

    const handleSelect = (projectId: string | null) => {
        onConfirm(projectId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">Add to Project</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {/* Option to remove from project */}
                    <button
                        onClick={() => handleSelect(null)}
                        className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${!currentProjectId ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                        <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                            <XMarkIcon className="w-5 h-5" />
                        </div>
                        <span>No Project (Remove)</span>
                    </button>

                    {projects.length === 0 && (
                        <div className="py-4 text-center text-gray-500 text-sm">
                            No projects created yet.
                        </div>
                    )}

                    {projects.map((project) => (
                        <button
                            key={project.id}
                            onClick={() => handleSelect(project.id)}
                            className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${currentProjectId === project.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                        >
                            <div className={`p-1.5 rounded-lg ${currentProjectId === project.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <FolderIcon className="w-5 h-5" />
                            </div>
                            <span className="truncate">{project.name}</span>
                        </button>
                    ))}
                </div>

                <div className="border-t border-gray-100 mt-4 pt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    >
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    );
}
