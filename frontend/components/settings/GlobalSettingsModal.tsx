"use client";
import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Cookies from 'js-cookie';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    view?: 'profile' | 'memory';
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

export default function GlobalSettingsModal({ isOpen, onClose, view = 'memory' }: GlobalSettingsModalProps) {
    const [activeTab, setActiveTab] = useState(0);
    const [instructions, setInstructions] = useState('');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [newMemory, setNewMemory] = useState('');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);
    const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const router = useRouter();

    // Reset tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(0);
            setConfirmDeleteHistory(false);
            setConfirmDeleteAccount(false);
        }
    }, [isOpen, view]);

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
            if (added.status === 'LIMIT_EXCEEDED') {
                setError("Max 20 items, you need to delete to add new items once limits have been attained");
                setSaveStatus('error');
                setTimeout(() => { setError(null); setSaveStatus('idle'); }, 5000);
                return;
            }
            setMemories([added, ...memories]);
            setNewMemory('');
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to add memory");
            setSaveStatus('error');
            setTimeout(() => { setError(null); setSaveStatus('idle'); }, 5000);
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
            if (updated.status === 'LIMIT_EXCEEDED') {
                setError("Max 20 items, you need to delete to add new items once limits have been attained");
                setTimeout(() => setError(null), 5000);
                return;
            }
            setMemories(memories.map(m => m.id === id ? updated : m));
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to promote memory");
            setTimeout(() => setError(null), 5000);
        }
    };

    const handleDeleteHistory = async () => {
        setLoading(true);
        try {
            await api.delete('/api/user/history');
            onClose();
            window.location.reload();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            await api.delete('/api/user/account');
            await signOut(auth);
            Cookies.remove('debugflow_token');
            router.push('/login');
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const activeMemories = memories.filter(m => m.status === 'ACTIVE');
    const candidateMemories = memories.filter(m => m.status === 'CANDIDATE');

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

    const authProvider = user?.providerData?.[0]?.providerId || 'email';
    const providerName = authProvider === 'google.com' ? 'Google' : authProvider === 'github.com' ? 'GitHub' : 'Email/Password';

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
                                        {view === 'memory' ? 'Memory settings' : 'Accounts and Profile'}
                                    </Dialog.Title>

                                    <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                                        {view === 'memory' && (
                                            <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/10 p-1 mb-6">
                                                <Tab className={({ selected }) => classNames(
                                                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                                    selected ? 'bg-white text-blue-700 shadow' : 'text-blue-900 hover:bg-white/[0.12] hover:text-blue-800'
                                                )}>
                                                    Instructions
                                                </Tab>
                                                <Tab className={({ selected }) => classNames(
                                                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                                    selected ? 'bg-white text-blue-700 shadow' : 'text-blue-900 hover:bg-white/[0.12] hover:text-blue-800'
                                                )}>
                                                    Memory
                                                    {candidateMemories.length > 0 && (
                                                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                                            {candidateMemories.length}
                                                        </span>
                                                    )}
                                                </Tab>
                                            </Tab.List>
                                        )}

                                        <Tab.Panels>
                                            {view === 'profile' ? (
                                                <Tab.Panel static className="focus:outline-none">
                                                    <div className="space-y-6">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Full Name</h4>
                                                            <p className="text-base text-gray-900 font-semibold">{user?.displayName || 'Not set'}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Email Address</h4>
                                                            <p className="text-base text-gray-900 font-semibold">{user?.email}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Authentication Provider</h4>
                                                            <p className="text-base text-gray-900 font-semibold">{providerName}</p>
                                                        </div>

                                                        <div className="pt-6 border-t border-gray-100 space-y-4">
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div>
                                                                        <h4 className="text-sm font-medium text-gray-900">Delete entire chat history</h4>
                                                                        <p className="text-xs text-gray-500">This will remove all your sessions and messages permanently.</p>
                                                                    </div>
                                                                    {!confirmDeleteHistory ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmDeleteHistory(true)}
                                                                            className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100"
                                                                        >
                                                                            Delete History
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setConfirmDeleteHistory(false)}
                                                                                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={handleDeleteHistory}
                                                                                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                                                                            >
                                                                                Confirm Delete
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h4 className="text-sm font-medium text-gray-900">Delete account</h4>
                                                                        <p className="text-xs text-gray-500">Permanently remove your account and all associated data.</p>
                                                                    </div>
                                                                    {!confirmDeleteAccount ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmDeleteAccount(true)}
                                                                            className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100"
                                                                        >
                                                                            Delete Account
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setConfirmDeleteAccount(false)}
                                                                                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={handleDeleteAccount}
                                                                                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                                                                            >
                                                                                Delete Everything
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Tab.Panel>
                                            ) : (
                                                <>
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

                                                            {error && (
                                                                <div className="rounded-md bg-red-50 p-3 border border-red-200">
                                                                    <p className="text-sm text-red-600 flex items-center">
                                                                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                                                                        {error}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Candidate Memories */}
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Memory Suggestions</h4>
                                                                    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-inset ring-orange-700/10">
                                                                        Max 12 Items (FIFO)
                                                                    </span>
                                                                </div>

                                                                {candidateMemories.length > 0 ? (
                                                                    <div className="rounded-md bg-orange-50 p-4 border border-orange-200">
                                                                        <div className="flex">
                                                                            <div className="flex-shrink-0">
                                                                                <SparklesIcon className="h-5 w-5 text-orange-400" aria-hidden="true" />
                                                                            </div>
                                                                            <div className="ml-3 w-full">
                                                                                <div className="space-y-2">
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
                                                                ) : (
                                                                    <div className="text-center py-4 bg-gray-50 rounded-md border border-dashed border-gray-200">
                                                                        <p className="text-[11px] text-gray-400 italic">No suggestions available at the moment.</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Active Memories */}
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Active Memory Ledger</h4>
                                                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                                        Max 20 Items (Hard Cap)
                                                                    </span>
                                                                </div>

                                                                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                                    {activeMemories.map(memory => (
                                                                        <li key={memory.id} className="flex items-center justify-between gap-x-4 py-3 px-4 hover:bg-gray-50 transition-colors">
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-sm font-semibold leading-6 text-gray-900">{memory.content}</p>
                                                                            </div>
                                                                            <div className="flex flex-none items-center gap-x-4">
                                                                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${memory.type === 'EXPLICIT' ? 'bg-purple-50 text-purple-700 ring-purple-600/20' :
                                                                                    memory.type === 'PERSONAL_INFO' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                                                        'bg-green-50 text-green-700 ring-green-600/20'
                                                                                    }`}>
                                                                                    {memory.type}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => archiveMemory(memory.id)}
                                                                                    className="rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                                                                >
                                                                                    Forget
                                                                                </button>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                    {activeMemories.length === 0 && (
                                                                        <li className="py-8 text-center bg-gray-50">
                                                                            <p className="text-xs text-gray-500">No active memories yet.</p>
                                                                            <p className="text-[11px] text-gray-400 italic mt-1">Try telling the AI to "Remember this".</p>
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </Tab.Panel>
                                                </>
                                            )}
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
