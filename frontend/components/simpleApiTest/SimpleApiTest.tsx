// components/SimpleApiTest.tsx
"use client";

import { useState } from 'react';

// Import your BASE_URL from your API client
// If it's not exported, we'll use it directly
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Simple debugCode function that matches yours exactly
async function debugCode(code: string, language: string) {
    console.log('🔧 debugCode called with:', { code, language });
    console.log('🌐 Calling endpoint:', `${BASE_URL}/debug`);

    const response = await fetch(`${BASE_URL}/debug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
    });

    console.log('📡 Response status:', response.status);
    return response.json();
}

export default function SimpleApiTest() {
    // State for the test
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');
    const [error, setError] = useState<string>('');

    // Test button handler
    const handleTest = async () => {
        console.log('🔄 Starting API test...');

        // Reset states
        setLoading(true);
        setResult('');
        setError('');

        try {
            // Test with simple code
            const testCode = 'console.log("Hello from debugFlow!");';
            const testLanguage = 'javascript';

            console.log('📤 Sending:', { testCode, testLanguage, BASE_URL });

            // Call your debugCode function
            const data = await debugCode(testCode, testLanguage);

            console.log('✅ Success! Received:', data);

            // Display result BELOW the button as requested
            setResult(JSON.stringify(data, null, 2));

        } catch (err: any) {
            console.error('❌ Test failed:', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-blue-800 mb-4">
                🔧 API Connection Test
            </h3>

            <p className="text-sm text-gray-600 mb-4">
                Testing: Frontend (Vercel) → Backend (Lambda)
            </p>

            <div className="mb-2 text-xs font-mono bg-blue-100 p-2 rounded">
                <strong>BASE_URL:</strong> {BASE_URL || 'Not set'}
            </div>

            {/* THE BUTTON */}
            <button
                onClick={handleTest}
                disabled={loading || !BASE_URL}
                className={`w-full py-3 px-4 rounded-lg font-medium ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : BASE_URL
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    } text-white transition-colors mb-4`}
            >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Testing Connection...
                    </span>
                ) : (
                    '🔗 Test API Connection'
                )}
            </button>

            {/* RESPONSE DISPLAYED BELOW THE BUTTON */}
            <div className="mt-4 space-y-3">
                {error && (
                    <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded">
                        <div className="flex items-center">
                            <span className="text-red-500 mr-2">❌</span>
                            <div>
                                <p className="font-medium text-red-800">Error</p>
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="p-3 bg-green-100 border-l-4 border-green-500 rounded">
                        <div className="flex items-center mb-2">
                            <span className="text-green-500 mr-2">✅</span>
                            <p className="font-medium text-green-800">Success! Response:</p>
                        </div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                            {result}
                        </pre>
                        <p className="text-xs text-gray-600 mt-2">
                            Check browser console (F12) for detailed logs
                        </p>
                    </div>
                )}
            </div>

            {/* Debug info */}
            <div className="mt-4 text-xs text-gray-500">
                <p>Open DevTools (F12) → Console to see detailed logs</p>
                <p>Network tab shows the actual request/response</p>
            </div>
        </div>
    );
}