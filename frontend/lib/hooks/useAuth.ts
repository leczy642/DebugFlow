import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

export interface UserProfile {
    role: 'super_user' | 'admin' | 'user';
    status: 'active' | 'blocked' | 'banned';
    permissions: Record<string, boolean>;
    global_instructions?: string;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                try {
                    // Fetch extended profile info (role, status, etc) from our backend
                    const data = await api.get('/api/user/profile/full');
                    setProfile(data);
                } catch (err) {
                    console.error("Failed to fetch user profile:", err);
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return {
        user,
        profile,
        role: profile?.role || 'user',
        status: profile?.status || 'active',
        loading,
        isAuthenticated: !!user,
        isAdmin: profile?.role === 'admin' || profile?.role === 'super_user',
        isSuperUser: profile?.role === 'super_user'
    };
}
