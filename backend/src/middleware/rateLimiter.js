import { getUserById, resetUserRequestCount, incrementUserRequestCount, getUserUsage } from '../db/models/user_queries.js';
import { logUsage } from '../db/models/usage_queries.js';

const TIER_LIMITS = {
    'free': 100,
    'basic': 500,
    'pro': 2000,
    'teams': 5000
};

/**
 * rateLimiter Middleware
 * 
 * Enforces per-user rate limits based on their tier.
 * Resets the 24-hour window automatically if expired.
 * Exempts super_users.
 */
export async function rateLimiter(req, res, next) {
    if (!req.user || !req.user.uid) {
        return next();
    }

    const { uid, role, email } = req.user;

    // Super users have unlimited usage
    if (role === 'super_user') {
        return next();
    }

    try {
        // Fetch latest usage data from DB (centralized reset logic)
        let user = await getUserUsage(uid);
        if (!user) {
            return next();
        }

        const now = new Date();
        const resetAt = new Date(user.rate_limit_reset_at);
        const tier = user.tier || 'free';
        const limit = TIER_LIMITS[tier] || TIER_LIMITS['free'];
        const currentCount = user.daily_requests_count || 0;

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount - 1));
        res.setHeader('X-RateLimit-Reset', new Date(resetAt.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (currentCount >= limit) {
            console.warn(`🛑 Rate limit exceeded for user: ${email} (${currentCount}/${limit})`);

            // Calculate hours remaining until reset
            const nextResetAt = new Date(resetAt.getTime() + 24 * 60 * 60 * 1000);
            const msRemaining = nextResetAt.getTime() - now.getTime();
            const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));

            // Log the blocked attempt
            await logUsage(uid, email, req.originalUrl, req.method, 429);

            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: `You have reached your usage limit, please try again after ${hoursRemaining} hours.`,
                tier: tier,
                limit: limit,
                reset_at: nextResetAt.toISOString()
            });
        }

        // Intercept response finish to increment count and log usage
        res.on('finish', async () => {
            try {
                // Only count successful or non-rate-limited requests towards the limit
                if (res.statusCode < 400 || res.statusCode === 404) {
                    await incrementUserRequestCount(uid);
                }

                // Track all usage for monitoring/analytics
                await logUsage(uid, email, req.originalUrl, req.method, res.statusCode);
            } catch (err) {
                console.error("Error updating usage stats:", err);
            }
        });

        next();
    } catch (error) {
        console.error("Rate limiter middleware error:", error);
        next(); // Fail open to not block users if DB is down, but log error
    }
}

export default rateLimiter;
