// systemSettingsService.js
// -----------------------------------------------------------------------------
// PURPOSE:
// - Manages global system settings (e.g., Search Enabled toggle).
// - Implements in-memory caching to avoid DB overhead on every request.
// - Provides a "TV Remote" style operational control.

import { getGlobalSetting, updateGlobalSetting } from "../db/models/user_queries.js";

const CACHE_TTL_MS = 60000; // 60 seconds
const cache = new Map();

/**
 * Fetch a system setting with in-memory caching.
 * @param {string} key The setting key.
 * @param {any} defaultValue The value to return if not found.
 * @returns {Promise<any>} The setting value.
 */
export async function getCachedSystemSetting(key, defaultValue = null) {
    const cachedItem = cache.get(key);
    const now = Date.now();

    if (cachedItem && (now - cachedItem.timestamp < CACHE_TTL_MS)) {
        return cachedItem.value;
    }

    try {
        const dbValue = await getGlobalSetting(key);
        const value = dbValue !== null ? dbValue : defaultValue;

        cache.set(key, {
            value,
            timestamp: now
        });

        return value;
    } catch (error) {
        console.error(`❌ Failed to fetch system setting ${key}:`, error.message);
        // Fallback to cache even if stale, or default
        return cachedItem ? cachedItem.value : defaultValue;
    }
}

/**
 * Check if the Web Search feature is currently enabled by the admin.
 * @returns {Promise<boolean>}
 */
export async function isWebSearchEnabled() {
    const setting = await getCachedSystemSetting("web_search_enabled", "true");
    return setting === "true";
}

/**
 * Update a system setting and clear its cache.
 * @param {string} key 
 * @param {string} value 
 * @param {string} actorRole 
 */
export async function setSystemSetting(key, value, actorRole = 'super_user') {
    await updateGlobalSetting(key, value, actorRole);
    cache.delete(key); // Force re-fetch on next usage
}
