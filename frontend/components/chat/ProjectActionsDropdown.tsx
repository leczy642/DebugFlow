import { useRef, useEffect } from "react";
import {
    PencilIcon,
    TrashIcon,
    Cog6ToothIcon
} from "@heroicons/react/24/outline";

interface ProjectActionsDropdownProps {
    projectId: string;
    onClose: () => void;
    onRename: (id: string) => void;
    onDelete: (id: string) => void;
    onSettings: (id: string) => void;
    position: { top: number; right?: number; left?: number; above?: boolean };
}

export default function ProjectActionsDropdown({
    projectId,
    onClose,
    onRename,
    onDelete,
    onSettings,
    position,
}: ProjectActionsDropdownProps) {
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

    return (
        <div
            ref={dropdownRef}
            className="fixed z-50 min-w-[140px] bg-white rounded-lg shadow-lg border border-gray-200 py-1"
            style={{
                top: `${position.top}px`,
                right: position.right !== undefined ? `${position.right}px` : undefined,
                left: position.left !== undefined ? `${position.left}px` : undefined,
                bottom: position.above ? 'auto' : undefined,
            }}
        >
            <button
                onClick={() => {
                    onRename(projectId);
                    onClose();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
                <PencilIcon className="h-4 w-4" />
                Rename Project
            </button>
            <button
                onClick={() => {
                    onSettings(projectId);
                    onClose();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
                <Cog6ToothIcon className="h-4 w-4" />
                Project Settings
            </button>
            <div className="border-t border-gray-100 my-0.5"></div>
            <button
                onClick={() => {
                    onDelete(projectId);
                    onClose();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
                <TrashIcon className="h-4 w-4" />
                Delete Project
            </button>
        </div>
    );
}
