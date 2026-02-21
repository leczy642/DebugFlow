"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, InformationCircleIcon, TrashIcon, ArrowUpCircleIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useChatStore } from "@/lib/store/chatStore";
import { api } from "@/lib/api";

interface ProjectSettingsModalProps {
    projectId: string;
    projectName: string;
    onClose: () => void;
}

interface ProjectSummary {
    id: string;
    title: string;
    context_summary: string;
    summary_updated_at: string;
}

export default function ProjectSettingsModal({
    projectId,
    projectName,
    onClose,
}: ProjectSettingsModalProps) {
    const { getProjectWithContext, updateProjectContext, toggleProjectContext, projects } =
        useChatStore();

    const [instructions, setInstructions] = useState("");
    const [contextEnabled, setContextEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
    const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());

    // Get current project from store
    const project = projects.find((p) => p.id === projectId);

    useEffect(() => {
        // Load full project data with context fields
        const loadProjectData = async () => {
            setIsLoading(true);
            try {
                const fullProject = await getProjectWithContext(projectId);
                if (fullProject) {
                    setInstructions(fullProject.context_instructions || "");
                    setContextEnabled(fullProject.context_enabled !== false);
                }

                // Fetch summaries
                const summaryList = await api.get(`/api/projects/${projectId}/summaries`);
                setSummaries(summaryList);
            } catch (err) {
                console.error("Failed to load project data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadProjectData();
    }, [projectId, getProjectWithContext]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save instructions if changed
            if (instructions !== (project?.context_instructions || "")) {
                await updateProjectContext(projectId, instructions);
            }
            // Save toggle if changed
            if (contextEnabled !== (project?.context_enabled !== false)) {
                await toggleProjectContext(projectId, contextEnabled);
            }
            onClose();
        } catch (err) {
            console.error("Failed to save project settings:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSummary = async (sessionId: string) => {
        try {
            await api.delete(`/api/sessions/${sessionId}/summary`);
            setSummaries(summaries.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error("Failed to delete summary:", err);
        }
    };

    const handlePromoteSummary = async (sessionId: string) => {
        try {
            await api.post(`/api/sessions/${sessionId}/promote`, {});
            setPromotedIds(prev => new Set(prev).add(sessionId));
        } catch (err) {
            console.error("Failed to promote summary:", err);
        }
    };

    const handleToggle = () => {
        setContextEnabled(!contextEnabled);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        Project Settings
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                        {/* Project Name (read-only) */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Project
                            </label>
                            <p className="text-gray-900 font-medium">{projectName}</p>
                        </div>

                        {/* Context Toggle */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="contextToggle"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Use project context
                                    </label>
                                    <div className="group relative">
                                        <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity w-56 pointer-events-none z-10">
                                            When enabled, the AI remembers context from all sessions
                                            in this project.
                                        </div>
                                    </div>
                                </div>
                                <button
                                    id="contextToggle"
                                    onClick={handleToggle}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${contextEnabled ? "bg-blue-600" : "bg-gray-200"
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${contextEnabled ? "translate-x-6" : "translate-x-1"
                                            }`}
                                    />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {contextEnabled
                                    ? "AI will use summaries from other sessions in this project"
                                    : "AI will only see the current conversation"}
                            </p>
                        </div>

                        {/* Instructions Textarea */}
                        <div className="mb-6">
                            <label
                                htmlFor="instructions"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Project Instructions{" "}
                                <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                id="instructions"
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                rows={4}
                                maxLength={16000}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 resize-none"
                                placeholder="e.g., This project is about debugging React authentication issues. Always suggest React-specific solutions..."
                                disabled={!contextEnabled}
                            />
                            <div className="flex justify-between mt-1">
                                <p className="text-xs text-gray-400">
                                    These instructions are included in every chat within this project
                                </p>
                                <span className="text-xs text-gray-400">
                                    {instructions.length}/16000
                                </span>
                            </div>
                        </div>

                        {/* Project Memory Section */}
                        {contextEnabled && (
                            <div className="mb-6 border-t pt-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    Project Memory (Session Summaries)
                                    {summaries.length > 0 && (
                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                            {summaries.length}
                                        </span>
                                    )}
                                </h4>

                                {summaries.length > 0 ? (
                                    <div className="space-y-4">
                                        {summaries.map(summary => (
                                            <div key={summary.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-medium text-gray-500 truncate max-w-[70%]">
                                                        Session: {summary.title}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handlePromoteSummary(summary.id)}
                                                            disabled={promotedIds.has(summary.id)}
                                                            title="Promote to Global Brain"
                                                            className={`p-1 rounded-md transition-colors ${promotedIds.has(summary.id)
                                                                ? "text-green-600 bg-green-50"
                                                                : "text-blue-600 hover:bg-blue-100"
                                                                }`}
                                                        >
                                                            {promotedIds.has(summary.id) ? (
                                                                <CheckIcon className="w-4 h-4" />
                                                            ) : (
                                                                <ArrowUpCircleIcon className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSummary(summary.id)}
                                                            title="Delete from Project Memory"
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-700 leading-relaxed italic">
                                                    "{summary.context_summary}"
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 px-4 border-2 border-dashed border-gray-200 rounded-xl">
                                        <InformationCircleIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500 font-medium">No project memory insights yet.</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Summaries are automatically generated after sessions reach 5+ messages.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-end mt-4 sticky bottom-0 bg-white pt-4 border-t">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSaving ? "Saving..." : "Save Settings"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

