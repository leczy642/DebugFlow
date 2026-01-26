"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    isSignInWithEmailLink,
    signInWithEmailLink
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Cookies from 'js-cookie';
import { api } from '@/lib/api';

export default function ConfirmLogin() {
    const router = useRouter();
    const [status, setStatus] = useState("Verifying your link...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const confirmSignIn = async () => {
            if (isSignInWithEmailLink(auth, window.location.href)) {
                let email = window.localStorage.getItem('emailForSignIn');

                if (!email) {
                    // This can happen if the user completes the flow on a different device
                    email = window.prompt('Please provide your email for confirmation');
                }

                if (email) {
                    try {
                        const result = await signInWithEmailLink(auth, email, window.location.href);
                        const user = result.user;

                        if (user) {
                            const idToken = await user.getIdToken();

                            // Store token in cookie for 7 days
                            Cookies.set('debugflow_token', idToken, { expires: 7 });
                            localStorage.setItem('debugflow_token', idToken);

                            // Verify with backend
                            await api.get('/protected');

                            // Clear email from storage
                            window.localStorage.removeItem('emailForSignIn');

                            setStatus("Login successful! Redirecting...");
                            router.push('/');
                        }
                    } catch (err: any) {
                        console.error("Error signing in with magic link:", err);
                        setError(err.message || "Failed to sign in. The link may have expired or already been used.");
                    }
                } else {
                    setError("Email is required to complete sign-in.");
                }
            } else {
                setStatus("Invalid or expired link.");
            }
        };

        confirmSignIn();
    }, [router]);

    return (
        <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-4">Sign in</h1>
                {!error ? (
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600 font-medium">{status}</p>
                    </div>
                ) : (
                    <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold">
                        {error}
                        <button
                            onClick={() => router.push('/login')}
                            className="block w-full mt-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
