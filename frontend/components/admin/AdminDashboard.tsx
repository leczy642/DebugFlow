"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
    UsersIcon,
    SignalIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
    UserMinusIcon,
    UserPlusIcon,
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
                    <ShieldExclamationIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold text-gray-900">Block User</h3>
                </div>

                <p className="text-sm text-gray-500 mb-8">
                    Select a block duration for <span className="font-semibold text-gray-900">{userEmail}</span>. The user will be unable to log in until the time elapses.
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

// --- ROLE ACTION MODAL ---
function RoleActionModal({ isOpen, onClose, onConfirm, targetRole, userEmail, isSuperUser }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    targetRole: string;
    userEmail: string;
    isSuperUser: boolean;
}) {
    const [reason, setReason] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                        {isSuperUser ? 'Change User Role' : 'Suggest Role Change'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500">
                        You are {isSuperUser ? 'updating' : 'suggesting'} the role of <span className="font-semibold text-gray-900">{userEmail}</span> to <span className={`font-semibold capitalize ${targetRole === 'admin' ? 'text-purple-600' : 'text-blue-600'}`}>{targetRole}</span>.
                    </p>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason (Required)</label>
                            <span className={`text-xs font-medium ${reason.trim().split(/\s+/).filter(Boolean).length > 30 ? 'text-red-500' : 'text-gray-400'}`}>
                                {reason.trim().split(/\s+/).filter(Boolean).length}/30 words
                            </span>
                        </div>
                        <textarea
                            autoFocus
                            className={`w-full h-32 bg-gray-50 border rounded-2xl p-4 text-sm focus:ring-2 focus:border-transparent transition ${reason.trim().split(/\s+/).filter(Boolean).length > 30 ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                                }`}
                            placeholder="Provide a rationale for this action (max 30 words)..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            const wordCount = reason.trim().split(/\s+/).filter(Boolean).length;
                            if (wordCount === 0) return alert("Please provide a reason.");
                            if (wordCount > 30) return alert("Reason cannot exceed 30 words.");
                            onConfirm(reason);
                            setReason("");
                        }}
                        className={`flex-1 px-6 py-2.5 rounded-xl font-medium text-white transition shadow-lg ${reason.trim().split(/\s+/).filter(Boolean).length > 30
                            ? 'bg-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                            }`}
                        disabled={reason.trim().split(/\s+/).filter(Boolean).length > 30}
                    >
                        {isSuperUser ? 'Confirm Change' : 'Submit Suggestion'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false); // Fix for UX
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [isFetchingBlocked, setIsFetchingBlocked] = useState(false);
    const [isFetchingUsage, setIsFetchingUsage] = useState(false);
    const [now, setNow] = useState(new Date());

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        userId: string;
        userEmail: string;
        targetRole: string;
    }>({
        isOpen: false,
        userId: "",
        userEmail: "",
        targetRole: ""
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

    const fetchProfile = useCallback(async () => {
        try {
            const data = await api.get('/api/user/profile');
            // The updated backend now returns { user: { ... } }
            setCurrentUser(data.user);
        } catch (err) {
            console.error("Failed to fetch profile", err);
        }
    }, []);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/admin/dashboard');
            setMetrics(data);
        } catch (err) {
            console.error("Failed to fetch admin metrics", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBlockedUsers = useCallback(async () => {
        setIsFetchingBlocked(true);
        try {
            const data = await api.get('/api/admin/users/blocked');
            setBlockedUsers(data);
        } catch (err) {
            console.error("Failed to fetch blocked users", err);
        } finally {
            setIsFetchingBlocked(false);
        }
    }, []);

    const fetchUsageStats = useCallback(async () => {
        setIsFetchingUsage(true);
        try {
            const data = await api.get('/api/admin/usage/stats');
            setUsageStats(data);
        } catch (err) {
            console.error("Failed to fetch usage stats", err);
        } finally {
            setIsFetchingUsage(false);
        }
    }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const results = await api.get(`/api/admin/users/search/${encodeURIComponent(searchQuery)}`);
            setSearchResults(results);
            setHasSearched(true);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleBlockUser = async (userId: string, isBlocked: boolean, userEmail: string) => {
        if (isBlocked) {
            // Restore immediately
            setUpdatingUserId(userId);
            try {
                await api.patch(`/api/admin/user/${userId}/block`, { duration: null });
                setSearchResults((prev: any[]) => prev.map(u => u.id === userId ? { ...u, status: 'active', block_expires_at: null } : u));
                setBlockedUsers((prev: any[]) => prev.filter(u => u.id !== userId));
                alert("User restored successfully.");
            } catch (err) {
                alert("Failed to restore user.");
            } finally {
                setUpdatingUserId(null);
            }
        } else {
            // Open modal to choose duration
            setBlockModal({
                isOpen: true,
                userId,
                userEmail
            });
        }
    };

    const handleConfirmBlock = async (duration: string) => {
        const { userId } = blockModal;
        setUpdatingUserId(userId);
        setBlockModal((prev: any) => ({ ...prev, isOpen: false }));

        try {
            const response = await api.patch(`/api/admin/user/${userId}/block`, { duration });
            setSearchResults((prev: any[]) => prev.map(u => u.id === userId ? { ...u, status: 'blocked', block_expires_at: response.expiresAt } : u));
            fetchBlockedUsers(); // Refresh the list
            alert(`User blocked for ${duration}.`);
        } catch (err) {
            alert("Failed to block user.");
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleRoleAction = async (reason: string) => {
        const { userId, targetRole } = modalConfig;
        setUpdatingUserId(userId);
        setModalConfig(prev => ({ ...prev, isOpen: false }));

        try {
            const response = await api.post('/api/admin/suggest-role', {
                userId,
                suggestedRole: targetRole,
                reason
            });

            const isSuperUser = currentUser?.role === 'super_user';

            if (isSuperUser) {
                // For Super Users, the promotion is immediate
                setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole, suggested_role: null } : u));
                alert(response.message || `User has been promoted to ${targetRole}!`);
            } else {
                // For Admins, it remains a suggestion
                setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, suggested_role: targetRole } : u));
                alert(response.message || "Role suggestion submitted successfully!");
            }
        } catch (err) {
            alert("Failed to process role action");
        } finally {
            setUpdatingUserId(null);
        }
    };

    useEffect(() => {
        fetchMetrics();
        fetchProfile();
        fetchBlockedUsers();
        fetchUsageStats();
    }, [fetchMetrics, fetchProfile, fetchBlockedUsers, fetchUsageStats]);

    // Update real-time clock for countdowns
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getRemainingTime = (expiryDate: string) => {
        const diff = new Date(expiryDate).getTime() - now.getTime();
        if (diff <= 0) return "expired";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

        return parts.join(" ");
    };

    if (loading && !metrics) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <button
                        onClick={() => { fetchMetrics(); fetchBlockedUsers(); fetchUsageStats(); }}
                        className="p-2 text-gray-500 hover:text-blue-600 transition"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading || isFetchingBlocked || isFetchingUsage ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* ... existing metrics grid content ... */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <UsersIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Users</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{metrics?.metrics?.total_users || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                <SignalIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Daily Active</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{metrics?.metrics?.active_users?.daily || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                <ExclamationTriangleIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">System Health</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{metrics?.health?.database === 'healthy' ? 'Good' : 'Warning'}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                <SignalIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">API Traffic (24h)</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{usageStats?.stats?.total_requests_24h || 0}</p>
                        {usageStats?.stats?.blocked_requests_24h > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                                {usageStats.stats.blocked_requests_24h} blocked attempts
                            </p>
                        )}
                    </div>
                </div>

                {/* USER SEARCH & MANAGEMENT */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
                    {/* ... existing search content ... */}
                    <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                        <input
                            type="text"
                            placeholder="Find user by email or ID..."
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {searchResults.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-sm text-gray-400 font-medium">
                                        <th className="pb-4 pr-4">User</th>
                                        <th className="pb-4 px-4 text-center">Role</th>
                                        <th className="pb-4 px-4 text-center">Status</th>
                                        <th className="pb-4 pl-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {searchResults.map(user => (
                                        <tr key={user.id} className="text-sm group hover:bg-gray-50/50">
                                            <td className="py-4 pr-4">
                                                <div className="font-medium text-gray-900">{user.email}</div>
                                                <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]">{user.id}</div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${user.role === 'super_user' ? 'bg-amber-100 text-amber-700' :
                                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                                                        user.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {user.status} {user.status === 'blocked' && user.block_expires_at && `(${getRemainingTime(user.block_expires_at)})`}
                                                    </span>
                                                    {user.suggested_role && (
                                                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                                                            Pending {user.suggested_role}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleBlockUser(user.id, user.status === 'blocked', user.email)}
                                                        disabled={updatingUserId === user.id || (user.role === 'super_user') || (currentUser?.role === 'admin' && user.role === 'admin')}
                                                        className={`p-2 rounded-lg transition ${user.status === 'blocked' ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50 disabled:opacity-30'}`}
                                                        title={user.status === 'blocked' ? 'Restore User' : 'Block User'}
                                                    >
                                                        {user.status === 'blocked' ? <CheckCircleIcon className="w-5 h-5" /> : <ShieldExclamationIcon className="w-5 h-5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setModalConfig({
                                                            isOpen: true,
                                                            userId: user.id,
                                                            userEmail: user.email,
                                                            targetRole: user.role === 'admin' ? 'user' : 'admin'
                                                        })}
                                                        disabled={updatingUserId === user.id || user.role === 'super_user' || !!user.suggested_role}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-30 disabled:grayscale"
                                                        title={user.suggested_role ? `Pending ${user.suggested_role}` : (user.role === 'admin' ? 'Suggest Demote' : 'Suggest Promote')}
                                                    >
                                                        {user.role === 'admin' ? <UserMinusIcon className="w-5 h-5" /> : <UserPlusIcon className="w-5 h-5" />}
                                                    </button>
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

                {/* BLOCKED USERS LIST */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldExclamationIcon className="w-6 h-6 text-red-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Blocked List</h2>
                        </div>
                        {blockedUsers.length > 0 && (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                                {blockedUsers.length} Users
                            </span>
                        )}
                    </div>

                    {isFetchingBlocked && blockedUsers.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                        </div>
                    ) : blockedUsers.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-sm text-gray-400 font-medium">
                                        <th className="pb-4 pr-4">User</th>
                                        <th className="pb-4 px-4 text-center">Role</th>
                                        <th className="pb-4 px-4 text-center">Remaining Time</th>
                                        <th className="pb-4 pl-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {blockedUsers.map(user => (
                                        <tr key={user.id} className="text-sm group hover:bg-gray-50/50">
                                            <td className="py-4 pr-4">
                                                <div className="font-medium text-gray-900">{user.email}</div>
                                                <div className="text-xs text-gray-500 font-mono">{user.id}</div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="text-red-600 font-medium">
                                                    {getRemainingTime(user.block_expires_at)}
                                                </span>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <button
                                                    onClick={() => handleBlockUser(user.id, true, user.email)}
                                                    disabled={updatingUserId === user.id}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-30"
                                                    title="Restore User"
                                                >
                                                    <CheckCircleIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            No blocked users at the moment.
                        </div>
                    )}
                </div>

                {/* USAGE MONITORING SECTION */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <SignalIcon className="w-6 h-6 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Highest Usage (Top 10)</h2>
                        </div>
                        <span className="text-xs text-gray-400 font-medium italic">
                            Updated every refresh
                        </span>
                    </div>

                    {isFetchingUsage && !usageStats ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                    ) : usageStats?.top_users?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-sm text-gray-400 font-medium">
                                        <th className="pb-4 pr-4">User</th>
                                        <th className="pb-4 px-4 text-center">Tier</th>
                                        <th className="pb-4 px-4 text-center">Requests Today</th>
                                        <th className="pb-4 pl-4 text-right">Reset At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {usageStats.top_users.map((user: any) => (
                                        <tr key={user.id} className="text-sm group hover:bg-gray-50/50">
                                            <td className="py-4 pr-4">
                                                <div className="font-medium text-gray-900">{user.email}</div>
                                                <div className="text-xs text-gray-500 font-mono">{user.id}</div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.tier === 'teams' ? 'bg-indigo-100 text-indigo-700' :
                                                    user.tier === 'pro' ? 'bg-purple-100 text-purple-700' :
                                                        user.tier === 'basic' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {user.tier || 'free'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`font-bold ${user.daily_requests_count > 80 ? 'text-red-600' : 'text-gray-900'}`}>
                                                        {user.daily_requests_count}
                                                    </span>
                                                    <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${user.daily_requests_count > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (user.daily_requests_count / 100) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <span className="text-gray-500 text-xs">
                                                    {user.rate_limit_reset_at ? new Date(user.rate_limit_reset_at).toLocaleString() : 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            No usage data recorded yet.
                        </div>
                    )}
                </div>
            </div>

            <RoleActionModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleRoleAction}
                targetRole={modalConfig.targetRole}
                userEmail={modalConfig.userEmail}
                isSuperUser={currentUser?.role === 'super_user'}
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
