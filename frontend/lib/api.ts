import { auth } from '@/lib/firebase';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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
