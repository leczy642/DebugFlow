import { auth } from '@/lib/firebase';

// Fallback to localhost if no environment variable is set
const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Ensure we have a string even if something goes wrong with env vars during build
const safeRawUrl = typeof rawBaseUrl === 'string' ? rawBaseUrl : 'http://localhost:4000';

// Export BASE_URL and ensure it doesn't have a trailing slash for consistency
export const BASE_URL = safeRawUrl.endsWith('/') ? safeRawUrl.slice(0, -1) : safeRawUrl;

// Only log warnings at runtime, not during build
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && BASE_URL.includes('localhost')) {
    console.warn('⚠️ WARNING: API Base URL is still pointing to localhost in production.');
}

const getAuthToken = async () => {
    const user = auth.currentUser;
    if (user) {
        return await user.getIdToken();
    }
    return null;
};

// Export helper for getting authenticated headers (useful for streaming requests)
export const getAuthHeaders = async () => {
    const token = await getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
};

export const api = {
    async request(endpoint: string, options: RequestInit = {}) {
        const token = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const config = {
            ...options,
            headers,
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, config);

        if (response.status === 401) {
            // Redirect to login if unauthorized (token expired or missing)
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || response.statusText);
        }

        return response.json();
    },

    get(endpoint: string, options: RequestInit = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint: string, body: any, options: RequestInit = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    put(endpoint: string, body: any, options: RequestInit = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    patch(endpoint: string, body: any, options: RequestInit = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    },

    delete(endpoint: string, options: RequestInit = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    },
};
