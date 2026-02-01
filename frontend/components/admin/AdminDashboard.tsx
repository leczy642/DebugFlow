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
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Reason (Required)</label>
                        <textarea
                            autoFocus
                            className="w-full h-32 bg-gray-50 border border-gray-300 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Provide a rationale for this action..."
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
                            if (!reason.trim()) return alert("Please provide a reason.");
                            onConfirm(reason);
                            setReason("");
                        }}
                        className="flex-1 px-6 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition shadow-lg shadow-blue-200"
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

    const handleBlockUser = async (userId: string, isBlocked: boolean) => {
        setUpdatingUserId(userId);
        try {
            await api.patch(`/api/admin/user/${userId}/block`, { blocked: !isBlocked });
            setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, status: isBlocked ? 'active' : 'blocked' } : u));
        } catch (err) {
            alert("Failed to update user status");
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
    }, [fetchMetrics, fetchProfile]);

    if (loading && !metrics) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <button
                        onClick={fetchMetrics}
                        className="p-2 text-gray-500 hover:text-blue-600 transition"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                </div>

                {/* USER SEARCH & MANAGEMENT */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>

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
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    user.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="py-4 pl-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleBlockUser(user.id, user.status === 'blocked')}
                                                        disabled={updatingUserId === user.id || user.role === 'super_user'}
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
                                                        disabled={updatingUserId === user.id || user.role === 'super_user'}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-30"
                                                        title={user.role === 'admin' ? 'Suggest Demote' : 'Suggest Promote'}
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
            </div>

            <RoleActionModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleRoleAction}
                targetRole={modalConfig.targetRole}
                userEmail={modalConfig.userEmail}
                isSuperUser={currentUser?.role === 'super_user'}
            />
        </div>
    );
}
