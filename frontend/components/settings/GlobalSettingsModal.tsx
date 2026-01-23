"use client";
import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Memory {
    id: string;
    content: string;
    type: 'EXPLICIT' | 'INFERRED' | 'PERSONAL_INFO';
    status: 'ACTIVE' | 'CANDIDATE';
    confidence: number;
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export default function GlobalSettingsModal({ isOpen, onClose }: GlobalSettingsModalProps) {
    const [activeTab, setActiveTab] = useState(0);
    const [instructions, setInstructions] = useState('');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [newMemory, setNewMemory] = useState('');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    // Fetch data
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch profile
            const profile = await api.get('/api/user/profile');
            setInstructions(profile.global_instructions || '');

            // Fetch memories
            const memoryList = await api.get('/api/user/memories');
            setMemories(memoryList);
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        } finally {
            setLoading(false);
        }
    };

    const saveInstructions = async () => {
        setSaveStatus('saving');
        try {
            await api.patch('/api/user/profile', { global_instructions: instructions });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const addMemory = async () => {
        if (!newMemory.trim()) return;
        setSaveStatus('saving');
        try {
            const added = await api.post('/api/user/memories', { content: newMemory });
            setMemories([added, ...memories]);
            setNewMemory('');
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const archiveMemory = async (id: string) => {
        try {
            await api.patch(`/api/user/memories/${id}/archive`, {});
            setMemories(memories.filter(m => m.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const promoteMemory = async (id: string) => {
        try {
            const updated = await api.patch(`/api/user/memories/${id}/promote`, {});
            setMemories(memories.map(m => m.id === id ? updated : m));
        } catch (err) {
            console.error(err);
        }
    };

    const activeMemories = memories.filter(m => m.status === 'ACTIVE');
    const candidateMemories = memories.filter(m => m.status === 'CANDIDATE');

    // Helper for button classes based on status
    const getButtonClasses = () => {
        const base = "inline-flex justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
        switch (saveStatus) {
            case 'success':
                return `${base} bg-green-600 text-white hover:bg-green-500 focus-visible:outline-green-600`;
            case 'error':
                return `${base} bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600`;
            case 'saving':
                return `${base} bg-blue-400 text-white cursor-not-allowed`;
            default:
                return `${base} bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600`;
        }
    };

    const getButtonText = () => {
        switch (saveStatus) {
            case 'success': return 'Saved!';
            case 'error': return 'Failed';
            case 'saving': return 'Saving...';
            default: return 'Save Changes';
        }
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Close</span>
                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="p-6">
                                    <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-gray-900 mb-6">
                                        Global Settings & Brain
                                    </Dialog.Title>

                                    <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                                        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/10 p-1 mb-6">
                                            <Tab className={({ selected }) => classNames(
                                                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                                'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                                selected ? 'bg-white text-blue-700 shadow' : 'text-blue-900 hover:bg-white/[0.12] hover:text-blue-800'
                                            )}>
                                                Instructions (Explicit)
                                            </Tab>
                                            <Tab className={({ selected }) => classNames(
                                                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                                'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                                selected ? 'bg-white text-blue-700 shadow' : 'text-blue-900 hover:bg-white/[0.12] hover:text-blue-800'
                                            )}>
                                                Memory Ledger
                                                {candidateMemories.length > 0 && (
                                                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                                        {candidateMemories.length}
                                                    </span>
                                                )}
                                            </Tab>
                                        </Tab.List>

                                        <Tab.Panels>
                                            <Tab.Panel className="focus:outline-none">
                                                <div className="space-y-4">
                                                    <p className="text-sm text-gray-500">
                                                        These instructions define the AI's persona and base behavior across ALL projects.
                                                    </p>
                                                    <textarea
                                                        rows={8}
                                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                                        placeholder="e.g., 'I am a senior engineer. Be concise. Prefer functional programming.'"
                                                        value={instructions}
                                                        onChange={(e) => setInstructions(e.target.value)}
                                                    />
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            className={getButtonClasses()}
                                                            onClick={saveInstructions}
                                                            disabled={saveStatus === 'saving'}
                                                        >
                                                            {saveStatus === 'success' && <CheckCircleIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />}
                                                            {saveStatus === 'error' && <ExclamationTriangleIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />}
                                                            {getButtonText()}
                                                        </button>
                                                    </div>
                                                </div>
                                            </Tab.Panel>

                                            <Tab.Panel className="focus:outline-none">
                                                <div className="space-y-6">
                                                    {/* Add New Memory */}
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                                            placeholder="Add a fact (e.g., 'Always use port 3000')"
                                                            value={newMemory}
                                                            onChange={(e) => setNewMemory(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={addMemory}
                                                            disabled={saveStatus === 'saving'}
                                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                                                        >
                                                            {saveStatus === 'saving' ? 'Adding...' : 'Add'}
                                                        </button>
                                                    </div>

                                                    {/* Candidate Memories */}
                                                    {candidateMemories.length > 0 && (
                                                        <div className="rounded-md bg-orange-50 p-4 border border-orange-200">
                                                            <div className="flex">
                                                                <div className="flex-shrink-0">
                                                                    <SparklesIcon className="h-5 w-5 text-orange-400" aria-hidden="true" />
                                                                </div>
                                                                <div className="ml-3">
                                                                    <h3 className="text-sm font-medium text-orange-800">Use Suggestions</h3>
                                                                    <div className="mt-2 space-y-2">
                                                                        {candidateMemories.map(memory => (
                                                                            <div key={memory.id} className="flex items-center justify-between text-sm">
                                                                                <p className="text-orange-700">{memory.content}</p>
                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        onClick={() => promoteMemory(memory.id)}
                                                                                        className="text-green-600 hover:text-green-800 font-medium"
                                                                                    >
                                                                                        Approve
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => archiveMemory(memory.id)}
                                                                                        className="text-red-600 hover:text-red-800"
                                                                                    >
                                                                                        Reject
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Active Memories */}
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-500 mb-2">Active Memory Ledger</h4>
                                                        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
                                                            {activeMemories.map(memory => (
                                                                <li key={memory.id} className="flex items-center justify-between gap-x-6 py-3 px-4">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-start gap-x-3">
                                                                            <p className="text-sm font-semibold leading-6 text-gray-900">{memory.content}</p>
                                                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${memory.type === 'EXPLICIT' ? 'bg-purple-50 text-purple-700 ring-purple-600/20' :
                                                                                memory.type === 'PERSONAL_INFO' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                                                    'bg-green-50 text-green-700 ring-green-600/20'
                                                                                }`}>
                                                                                {memory.type}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-none items-center gap-x-4">
                                                                        <button
                                                                            onClick={() => archiveMemory(memory.id)}
                                                                            className="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block"
                                                                        >
                                                                            Forget
                                                                        </button>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                            {activeMemories.length === 0 && (
                                                                <li className="py-4 text-center text-sm text-gray-500">
                                                                    No active memories yet. Try telling the AI to "Remember this".
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </Tab.Panel>
                                        </Tab.Panels>
                                    </Tab.Group>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}

