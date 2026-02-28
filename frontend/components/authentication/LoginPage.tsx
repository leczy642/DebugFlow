"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
import { FaGoogle, FaGithub, FaEnvelope } from "react-icons/fa";
import { Button } from "../ui/Button";
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '@/lib/firebase';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import SimpleApiTest from '../simpleApiTest/SimpleApiTest';

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // DEBUG: Fetch server-side env vars
    const [debugInfo, setDebugInfo] = useState<any>(null);
    useEffect(() => {
        fetch('/api/debug-env')
            .then(res => res.json())
            .then(data => setDebugInfo(data))
            .catch(err => setDebugInfo({ error: err.message }));
    }, []);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace('/');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || isAuthenticated) {
        return (
            <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const handleGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            if (user) {
                const idToken = await user.getIdToken();
                console.log('Sending Google token to backend...');

                // Store token in cookie for 7 days
                Cookies.set('debugflow_token', idToken, { expires: 7 });
                localStorage.setItem('debugflow_token', idToken); // Keep local storage for existing logic if any

                await api.get('/protected');
                console.log('Backend verified token.');
                // Redirect to home page after successful authentication
                router.push('/');
            }
        }
        catch (error) {
            console.error('Google sign-in failed:', error);
            setError('Google sign-in failed. Please try again.');
        }
    };

    const handleGithub = async () => {
        try {
            const result = await signInWithPopup(auth, githubProvider);
            const user = result.user;
            if (user) {
                const idToken = await user.getIdToken();
                console.log('Sending GitHub token to backend...');

                // Store token in cookie for 7 days
                Cookies.set('debugflow_token', idToken, { expires: 7 });
                localStorage.setItem('debugflow_token', idToken);

                await api.get('/protected');
                console.log('Backend verified token.');
                // Redirect to home page after successful authentication
                router.push('/');
            }
        }
        catch (error: any) {
            console.error('Github sign-in failed:', error);

            // Handle account linking case
            if (error.code === 'auth/account-exists-with-different-credential') {
                try {
                    const { OAuthProvider, fetchSignInMethodsForEmail, linkWithCredential, GoogleAuthProvider, EmailAuthProvider } = await import('firebase/auth');

                    const pendingCred = OAuthProvider.credentialFromError(error);
                    const email = error.customData?.email || error.email;

                    if (!pendingCred || !email) {
                        console.error("Could not retrieve pending credential or email");
                        setError("Account linking failed: missing credentials.");
                        return;
                    }

                    // Determine the existing provider
                    const methods = await fetchSignInMethodsForEmail(auth, email);
                    console.log("Existing methods for email:", methods);

                    let providerToUse: any = null;
                    if (methods.includes('google.com')) {
                        providerToUse = googleProvider;
                    } else if (methods.includes('password')) {
                        // We might need to handle password sign-in differently (prompt for password)
                        // For now, let's focus on Google as per requirements
                        console.warn("User has password account, complex flow needed.");
                        setError("This email is registered with a password. Please sign in with email/password first, then link GitHub.");
                        return;
                    }

                    if (!providerToUse) {
                        // Default to trying Google if we can't determine (or simply just ask user)
                        // But for now, if 'google.com' isn't in list, we might be stuck or it's another provider.
                        // Let's fallback to assuming Google if requirement said so, or better, show error.
                        // If methods is empty, it's weird because error says account exists.
                        // Let's assume Google if the user explicitly asked for this case.
                        providerToUse = googleProvider;
                    }

                    // Pause flow and ask user
                    const confirmLink = window.confirm(
                        `This email (${email}) is already registered with an existing account. Do you want to link your GitHub account?`
                    );

                    if (confirmLink) {
                        // Sign in with the existing provider
                        const result = await signInWithPopup(auth, providerToUse);
                        const user = result.user;

                        if (user) {
                            // Link the pending GitHub credential
                            await linkWithCredential(user, pendingCred);

                            console.log("Accounts successfully linked!");

                            // Proceed with backend sync
                            const idToken = await user.getIdToken();

                            // Store token in cookie for 7 days
                            Cookies.set('debugflow_token', idToken, { expires: 7 });
                            localStorage.setItem('debugflow_token', idToken);

                            await api.get('/protected');
                            router.push('/');
                        }
                    } else {
                        console.log("User cancelled account linking");
                    }
                } catch (linkError) {
                    console.error("Account linking failed completely:", linkError);
                    setError("Failed to link accounts. Please try again.");
                }
            } else {
                setError('Github sign-in failed. Please try again.');
            }
        }
    };

    const handleSignOut = async () => {
        try {
            Cookies.remove('debugflow_token');
            localStorage.removeItem('debugflow_token');
            await firebaseSignOut(auth);
            setToken(null);
            console.log("You have been successfully logged out");
            router.push('/login');
        }
        catch (error) {
            console.error('Sign-out failed:', error);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);
        try {
            const { sendSignInLinkToEmail } = await import('firebase/auth');

            const actionCodeSettings = {
                // URL you want to redirect back to. The domain (www.example.com) for this
                // URL must be in the authorized domains list in the Firebase Console.
                url: `${window.location.origin}/confirm-login`,
                // This must be true.
                handleCodeInApp: true,
            };

            await sendSignInLinkToEmail(auth, email, actionCodeSettings);

            // The user will be redirected back here, so we save the email in local storage
            // so they don't have to re-enter it.
            window.localStorage.setItem('emailForSignIn', email);

            setSuccess(true);
            setEmail("");
        } catch (err: any) {
            console.error("Error sending magic link:", err);
            setError(err.message || "Failed to send sign-in link. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    //debugging only
    //console.log('API_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);

    return (
        <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md">
                <div className="bg-white py-10 px-6 shadow-2xl rounded-3xl relative overflow-hidden">
                    {/* Subtle gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700" />

                    {/* Branding inside the card */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            DebugFlow
                        </h1>
                        <p className="mt-2 text-sm text-gray-500 font-medium">
                            Sign in to your account
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Social Sign-in Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleGoogle}
                                type="button"
                                className="w-full inline-flex items-center justify-center py-3 px-4 border border-gray-200 rounded-2xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200 group"
                            >
                                <FaGoogle className="w-5 h-5 text-black mr-3 transition-transform group-hover:scale-110" />
                                <span>Continue with Google</span>
                            </button>

                            <button
                                onClick={handleGithub}
                                type="button"
                                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-2xl shadow-md bg-gray-900 text-sm font-semibold text-white hover:bg-black transition-all duration-200 group"
                            >
                                <div className="bg-gray-800 p-1 rounded-md mr-3">
                                    <FaGithub className="w-5 h-5 text-white transition-transform group-hover:scale-110" />
                                </div>
                                <span>Continue with GitHub</span>
                            </button>
                        </div>

                        {/* Visual Divider */}
                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-100"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest">
                                <span className="px-3 bg-white text-gray-400 font-bold">or</span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailSubmit} className="space-y-5">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <FaEnvelope className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="appearance-none block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-bold text-gray-900"
                                />
                            </div>

                            {error && (
                                <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="px-4 py-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                                    Success! Check your email or spam folder for a magic link.
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl font-bold shadow-lg flex justify-center items-center gap-2 transform active:scale-95 transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Sending magic link...
                                    </>
                                ) : (
                                    "Send sign-in link"
                                )}
                            </Button>

                            <p className="text-center text-[10px] text-gray-400 mt-6 leading-relaxed px-4">
                                By continuing, you agree to our{" "}
                                <a href="#" className="text-gray-600 underline hover:text-blue-600 transition-colors">Terms of Service</a>{" "}
                                and{" "}
                                <a href="#" className="text-gray-600 underline hover:text-blue-600 transition-colors">Privacy Policy</a>.
                            </p>
                        </form>
                    </div>
                </div>
            </div>

            {/* DEBUG PANEL - TEMPORARY */}
            {/* <div className="fixed bottom-0 left-0 w-full bg-yellow-50 border-t border-yellow-200 p-4 text-[10px] font-mono overflow-auto max-h-40 z-50">
                <h3 className="font-bold text-yellow-800">🕵️ DEBUGGER</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <strong className="block text-yellow-700">Client-Side (Browser):</strong>
                        <div>NEXT_PUBLIC_BACKEND_URL: {process.env.NEXT_PUBLIC_BACKEND_URL || 'undefined'}</div>
                        <div>API BASE_URL (Computed): {api.BASE_URL || 'undefined'}</div>
                        {/* Note: we need to expose BASE_URL property on api object or import it * /}
                        <div><p>SimpleApiTest:</p><SimpleApiTest /></div>
                    </div>
                    <div>
                        <strong className="block text-yellow-700">Server-Side (Next.js):</strong>
                        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                </div>
            </div> */}

        </div>
    );
}
