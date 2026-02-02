/**
 * roleMiddleware.js
 * 
 * PURPOSE:
 *   Provides helper middlewares to enforce role-based access control (RBAC)
 *   and permission-based access control (PBAC) on Express routes.
 */

/**
 * requireRole(allowedRoles)
 * @param {string|string[]} allowedRoles - Single role or array of roles allowed to access the route.
 */
export function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        next();
    };
}

/**
 * requirePermission(permission)
 * @param {string} permission - The specific permission key to check in req.user.permissions
 */
export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Super users always have all permissions
        if (req.user.role === 'super_user') {
            return next();
        }

        if (!req.user.permissions || !req.user.permissions[permission]) {
            return res.status(403).json({ error: 'Access denied: missing required permission' });
        }

        next();
    };
}

/**
 * requireNotBlocked
 * Ensures the user is not currently 'blocked' from taking an action.
 */
export function requireNotBlocked(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.status === 'blocked') {
        return res.status(403).json({
            error: 'Your account is currently suspended from taking this action. Please contact an administrator.'
        });
    }

    next();
}
/**
 * requireSuperUser
 * Exclusive access for the Super User.
 */
export function requireSuperUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'super_user') {
        return res.status(403).json({ error: 'Access denied: Super User role required' });
    }

    next();
}
