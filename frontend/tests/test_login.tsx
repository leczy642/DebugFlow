// app/test-auth/page.tsx
'use client';


import { useState, useEffect } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '@/lib/firebase';

export default function AuthTest() {
    const [token, setToken] = useState<string | null>(null);
    //const handleGoogle = () => signInWithPopup(auth, googleProvider);
    //const handleGithub = () => signInWithPopup(auth, githubProvider);

    const handleGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            // Token will be fetched automatically by useEffect below
        }
        catch (error) {
            console.error('Google sign-in failed:', error);
        }
    };

    const handleGithub = async () => {
        try {
            await signInWithPopup(auth, githubProvider)
        }
        catch (error) {
            console.error('Github sign-in failed:', error);
        }
    };

    const handleSignOut = async () => {
        try {
            localStorage.removeItem('debugflow_token');
            await firebaseSignOut(auth);
            setToken(null);
            console.log("You have been successfully logged out")
        }
        catch (error) {
            console.error('Sign-out failed:', error);
        }
    };


    // Listen for auth state changes and fetch token
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const idToken = await user.getIdToken();
                    setToken(idToken);
                    localStorage.setItem('debugflow_token', idToken);
                    console.log('✅ Token saved to localStorage:', idToken);
                } catch (error) {
                    console.error('Error getting ID token:', error);
                }
            } else {
                setToken(null);
                localStorage.removeItem('debugflow_token');
                console.log('ℹ️ User signed out, token removed');
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Auth Test Page</h1>

            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <button
                    onClick={handleGoogle}
                    disabled={!!token}
                    style={{ padding: '0.5rem 1rem', cursor: token ? 'not-allowed' : 'pointer' }}
                >
                    Test Google Sign-In
                </button>
                <button
                    onClick={handleGithub}
                    disabled={!!token}
                    style={{ padding: '0.5rem 1rem', cursor: token ? 'not-allowed' : 'pointer' }}
                >
                    Test GitHub Sign-In
                </button>
                <button
                    onClick={handleSignOut}
                    disabled={!token}
                    style={{ padding: '0.5rem 1rem', cursor: !token ? 'not-allowed' : 'pointer', backgroundColor: '#fee2e2', border: '1px solid #ef4444' }}
                >
                    Test Sign Out
                </button>
            </div>

            <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                <p><strong>Status:</strong> {token ? '✅ Signed In' : '❌ Not Signed In'}</p>
                {token && (
                    <div style={{ marginTop: '1rem' }}>
                        <p><strong>Firebase ID Token (stored in localStorage):</strong></p>
                        <textarea
                            readOnly
                            value={token}
                            style={{
                                width: '100%',
                                height: '120px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                padding: '0.5rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                )}
            </div>

            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
                Check browser console and "Application" tab for Local Storage details.
            </p>
        </div>
    );
}