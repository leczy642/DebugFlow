"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
    GlobeAltIcon,
    UserPlusIcon,
    ShieldCheckIcon,
    ArrowRightCircleIcon,
    MagnifyingGlassIcon,
    UserMinusIcon,
    NoSymbolIcon,
    CheckCircleIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";

// --- BLOCK DURATION MODAL ---
function BlockDurationModal({ isOpen, onClose, onConfirm, userEmail }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (duration: string) => void;
    userEmail: string;
}) {
    const durations = [
        { label: '24 Hours', value: '24h' },
        { label: '1 Week', value: '1w' },
        { label: '1 Month', value: '1m' },
        { label: '3 Months', value: '3m' },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-gray-100 p-8">
                <div className="flex items-center gap-3 text-red-600 mb-6">
                    <NoSymbolIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold text-gray-900">Block User</h3>
                </div>

                <p className="text-sm text-gray-500 mb-8">
                    Select a block duration for <span className="font-semibold text-gray-900">{userEmail}</span>.
                </p>

                <div className="space-y-3 mb-8">
                    {durations.map((d) => (
                        <button
                            key={d.value}
                            onClick={() => onConfirm(d.value)}
                            className="w-full py-3 px-4 rounded-xl border border-gray-200 text-left font-medium text-gray-700 hover:border-red-500 hover:bg-red-50 transition-colors"
                        >
                            {d.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-100 transition"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// --- CONFIRMATION MODAL ---
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, confirmVariant = 'blue' }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: 'blue' | 'red' | 'green';
}) {
    if (!isOpen) return null;

    const variantClasses = {
        blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
        red: 'bg-red-600 hover:bg-red-700 shadow-red-200',
        green: 'bg-green-600 hover:bg-green-700 shadow-green-200'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
                </div>
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition">
                        Cancel
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`flex-1 px-6 py-2.5 rounded-xl font-medium text-white transition shadow-lg ${variantClasses[confirmVariant]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SuperUserPanel() {
    const [admins, setAdmins] = useState<any[]>([]);
    const [promotionRequests, setPromotionRequests] = useState<any[]>([]);
    const [globalContext, setGlobalContext] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        confirmVariant: 'blue' | 'red' | 'green';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "",
        confirmVariant: 'blue',
        onConfirm: () => { }
    });
    const [blockModal, setBlockModal] = useState<{
        isOpen: boolean;
        userId: string;
        userEmail: string;
    }>({
        isOpen: false,
        userId: "",
        userEmail: ""
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [adminsData, contextData, requestsData] = await Promise.all([
                api.get('/api/super-user/admins'),
                api.get('/api/super-user/global-context'),
                api.get('/api/super-user/promotion-requests')
            ]);
            setAdmins(adminsData);
            setGlobalContext(contextData.content || "");
            setPromotionRequests(requestsData);
        } catch (err) {
            console.error("Failed to fetch super user data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSaveGlobalContext = async () => {
        setSaving(true);
        try {
            await api.post('/api/super-user/global-context', { content: globalContext });
            alert("Super Global Context Updated!");
        } catch (err) {
            alert("Failed to update context");
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const results = await api.get(`/api/super-user/users/search/${encodeURIComponent(searchQuery)}`);
            setSearchResults(results);
            setHasSearched(true);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleUpdateRole = async (userId: string, userEmail: string, targetRole: 'admin' | 'user') => {
        setConfirmConfig({
            isOpen: true,
            title: targetRole === 'admin' ? "Promote User" : "Demote User",
            message: `Are you sure you want to change the role of ${userEmail} to ${targetRole}?`,
            confirmText: targetRole === 'admin' ? "Promote" : "Demote",
            confirmVariant: targetRole === 'admin' ? 'blue' : 'red',
            onConfirm: async () => {
                setUpdatingUserId(userId);
                try {
                    await api.patch(`/api/super-user/user/${userId}/role`, { role: targetRole });
                    await fetchData();
                    if (searchResults.length > 0) {
                        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
                    }
                    alert(`User role updated to ${targetRole}`);
                } catch (err) {
                    alert("Failed to update role");
                } finally {
                    setUpdatingUserId(null);
                }
            }
        });
    };

    const handleUpdateStatus = async (userId: string, userEmail: string, targetStatus: 'active' | 'banned' | 'blocked') => {
        if (targetStatus === 'blocked') {
            setBlockModal({
                isOpen: true,
                userId,
                userEmail
            });
            return;
        }

        setConfirmConfig({
            isOpen: true,
            title: targetStatus === 'banned' ? "Ban User" : "Restore User",
            message: `Are you sure you want to ${targetStatus === 'banned' ? 'ban' : 'restore'} account ${userEmail}?`,
            confirmText: targetStatus === 'banned' ? "Ban Account" : "Restore Account",
            confirmVariant: targetStatus === 'banned' ? 'red' : 'green',
            onConfirm: async () => {
                setUpdatingUserId(userId);
                try {
                    await api.patch(`/api/super-user/user/${userId}/status`, { status: targetStatus });
                    if (searchResults.length > 0) {
                        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, status: targetStatus } : u));
                    }
                    await fetchData();
                    alert(`User status updated to ${targetStatus}`);
                } catch (err) {
                    alert("Failed to update status");
                } finally {
                    setUpdatingUserId(null);
                }
            }
        });
    };

    const handleConfirmBlock = async (duration: string) => {
        const { userId } = blockModal;
        setUpdatingUserId(userId);
        setBlockModal(prev => ({ ...prev, isOpen: false }));

        try {
            await api.patch(`/api/super-user/user/${userId}/status`, { status: 'blocked', duration });
            if (searchResults.length > 0) {
                setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, status: 'blocked' } : u));
            }
            await fetchData();
            alert(`User blocked for ${duration}`);
        } catch (err) {
            alert("Failed to block user");
        } finally {
            setUpdatingUserId(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading && admins.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
                    Super User Control Panel
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* GLOBAL CONTEXT MANAGEMENT */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <GlobeAltIcon className="w-6 h-6 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Super Global Context</h2>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            These instructions are prepended to EVERY AI response for ALL users. Use this for platform-wide rules, character limits, or high-priority safety guidance.
                        </p>
                        <textarea
                            className="flex-1 min-h-[12rem] w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Enter platform-wide rules..."
                            value={globalContext}
                            onChange={(e) => setGlobalContext(e.target.value)}
                        />
                        <button
                            onClick={handleSaveGlobalContext}
                            disabled={saving}
                            className="mt-4 w-full bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {saving ? 'Updating...' : 'Update Global Context'}
                        </button>
                    </div>

                    {/* CURRENT ADMINS LIST */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <UserPlusIcon className="w-6 h-6 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Current Administration</h2>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {admins.map(admin => (
                                <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 group">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]" title={admin.email}>{admin.email}</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${admin.role === 'super_user' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {admin.role.replace('_', ' ')}
                                            </span>
                                            {admin.status === 'banned' && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold uppercase">Banned</span>
                                            )}
                                        </div>
                                    </div>

                                    {admin.role === 'admin' && (
                                        <button
                                            onClick={() => handleUpdateRole(admin.id, admin.email, 'user')}
                                            disabled={!!updatingUserId}
                                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                                            title="Demote to User"
                                        >
                                            <UserMinusIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* USER SEARCH & MANAGEMENT */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <MagnifyingGlassIcon className="w-6 h-6 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Global User Management</h2>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                        <input
                            type="text"
                            placeholder="Search by exact email or ID..."
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {searchResults.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-sm text-gray-400 font-medium">
                                        <th className="pb-4 pr-4">User Details</th>
                                        <th className="pb-4 px-4 text-center">Role</th>
                                        <th className="pb-4 px-4 text-center">Status</th>
                                        <th className="pb-4 pl-4 text-right">Overrides</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {searchResults.map(user => (
                                        <tr key={user.id} className="text-sm group hover:bg-gray-50/50 transition">
                                            <td className="py-4 pr-4">
                                                <div className="font-medium text-gray-900">{user.email}</div>
                                                <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]" title={user.id}>{user.id}</div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${user.role === 'super_user' ? 'bg-amber-100 text-amber-700' :
                                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    user.status === 'banned' ? 'bg-red-100 text-red-700' :
                                                        user.status === 'blocked' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* ROLE ACTIONS */}
                                                    {user.role === 'user' && (
                                                        <button
                                                            onClick={() => handleUpdateRole(user.id, user.email, 'admin')}
                                                            disabled={!!updatingUserId}
                                                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition disabled:opacity-30"
                                                            title="Promote to Admin"
                                                        >
                                                            <ArrowRightCircleIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {user.role === 'admin' && (
                                                        <button
                                                            onClick={() => handleUpdateRole(user.id, user.email, 'user')}
                                                            disabled={!!updatingUserId}
                                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                                                            title="Demote to User"
                                                        >
                                                            <UserMinusIcon className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {/* STATUS ACTIONS */}
                                                    {user.role !== 'super_user' && (
                                                        <>
                                                            {user.status === 'active' ? (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(user.id, user.email, 'blocked')}
                                                                    disabled={!!updatingUserId}
                                                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition disabled:opacity-30"
                                                                    title="Block User"
                                                                >
                                                                    <NoSymbolIcon className="w-5 h-5" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(user.id, user.email, 'active')}
                                                                    disabled={!!updatingUserId}
                                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-30"
                                                                    title="Restore User"
                                                                >
                                                                    <CheckCircleIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleUpdateStatus(user.id, user.email, user.status === 'banned' ? 'active' : 'banned')}
                                                                disabled={!!updatingUserId}
                                                                className={`p-2 rounded-lg transition ${user.status === 'banned' ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50 disabled:opacity-30'}`}
                                                                title={user.status === 'banned' ? 'Restore User' : 'Ban User'}
                                                            >
                                                                {user.status === 'banned' ? <CheckCircleIcon className="w-5 h-5" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {searchResults.length === 0 && hasSearched && !isSearching && searchQuery && (
                        <div className="text-center py-12 text-gray-400">
                            No users found for "{searchQuery}"
                        </div>
                    )}
                </div>

                {/* ADMIN PROMOTION REQUESTS LIST */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <ArrowRightCircleIcon className="w-6 h-6 text-purple-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Admin Promotion Requests</h2>
                    </div>

                    {promotionRequests.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-sm text-gray-400 font-medium">
                                        <th className="pb-4 pr-4">User</th>
                                        <th className="pb-4 px-4 text-center">Role</th>
                                        <th className="pb-4 px-4 text-center">Status</th>
                                        <th className="pb-4 pl-4 text-right">Overrides</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {promotionRequests.map(user => (
                                        <tr key={user.id} className="text-sm group hover:bg-gray-50/50 transition">
                                            <td className="py-4 pr-4">
                                                <div className="font-medium text-gray-900">{user.email}</div>
                                                <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]" title={user.id}>{user.id}</div>
                                                {user.suggestion_reason && (
                                                    <div className="text-xs text-purple-600 italic mt-1">Reason: {user.suggestion_reason}</div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    user.status === 'banned' ? 'bg-red-100 text-red-700' :
                                                        user.status === 'blocked' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleUpdateRole(user.id, user.email, 'admin')}
                                                        disabled={!!updatingUserId}
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition disabled:opacity-30"
                                                        title="Promote to Admin"
                                                    >
                                                        <ArrowRightCircleIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(user.id, user.email, 'blocked')}
                                                        disabled={!!updatingUserId}
                                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition disabled:opacity-30"
                                                        title="Block User"
                                                    >
                                                        <NoSymbolIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(user.id, user.email, 'banned')}
                                                        disabled={!!updatingUserId}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                                                        title="Ban User"
                                                    >
                                                        <ShieldCheckIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            No pending promotion requests.
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmText={confirmConfig.confirmText}
                confirmVariant={confirmConfig.confirmVariant}
            />

            <BlockDurationModal
                isOpen={blockModal.isOpen}
                onClose={() => setBlockModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmBlock}
                userEmail={blockModal.userEmail}
            />
        </div>
    );
}
