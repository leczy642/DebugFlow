"use client";

import React, { useState } from "react";
import { FaGoogle, FaGithub } from "react-icons/fa";
import { Button } from "../ui/Button";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setSuccess(true);
            setEmail("");
        } catch (err) {
            setError("Failed to send sign-in link. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                    DebugFlow
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Sign in to your account
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 relative overflow-hidden">
                    {/* Subtle gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

                    <div className="space-y-4">
                        {/* Social Sign-in Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                            >
                                <FaGoogle className="w-5 h-5 text-[#DB4437] mr-2" />
                                <span>Google</span>
                            </button>
                            <button
                                type="button"
                                className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                            >
                                <FaGithub className="w-5 h-5 text-[#333] mr-2" />
                                <span>GitHub</span>
                            </button>
                        </div>

                        {/* Visual Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">or</span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="sr-only">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                    Check your email for a sign-in link!
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl font-semibold shadow-sm flex justify-center items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    "Send sign-in link"
                                )}
                            </Button>

                            <p className="text-center text-xs text-gray-500 mt-4 leading-relaxed">
                                By continuing, you agree to our{" "}
                                <a href="#" className="underline hover:text-gray-700">Terms</a>{" "}
                                and{" "}
                                <a href="#" className="underline hover:text-gray-700">Privacy Policy</a>.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
