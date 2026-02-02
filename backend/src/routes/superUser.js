/**
 * superUser.js
 * 
 * PURPOSE:
 *   API routes for Super User exclusive functionality.
 */

import express from "express";
import { pool } from "../db/postgres_connect.js";
import { logger } from "../utils/logger.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
    updateUserStatus,
    updateUserRole,
    logAuditEvent,
    getAdmins,
    getUserById,
    updateGlobalSetting,
    getGlobalSetting,
    transferSuperUser,
    getPromotionRequests
} from "../db/models/user_queries.js";

const router = express.Router();

// All routes here require Super User role
router.use(requireRole('super_user'));

/**
 * GET /api/super-user/admins
 * Returns a list of all current admins and the super user.
 */
router.get("/admins", async (req, res) => {
    try {
        const admins = await getAdmins();
        res.json(admins);
    } catch (err) {
        logger.error("Fetch Admins Failed", { error: err.message });
        res.status(500).json({ error: "Failed to fetch admins" });
    }
});

/**
 * GET /api/super-user/promotion-requests
 * Returns a list of users who have requested an admin role.
 */
router.get("/promotion-requests", async (req, res) => {
    try {
        const requests = await getPromotionRequests();
        res.json(requests);
    } catch (err) {
        logger.error("Fetch Promotion Requests Failed", { error: err.message });
        res.status(500).json({ error: "Failed to fetch promotion requests" });
    }
});

/**
 * GET /api/super-user/users/search/:query
 * Super User version of search (includes banned users and technical details).
 */
router.get("/users/search/:query", async (req, res) => {
    const { query } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT id, email, name, role, status, suggested_role, suggestion_reason, created_at, last_login 
             FROM users 
             WHERE email ILIKE $1 OR id = $2
             LIMIT 10`,
            [`%${query}%`, query]
        );
        res.json(rows);
    } catch (err) {
        logger.error("Super User Search Failed", { error: err.message });
        res.status(500).json({ error: "Failed to search for users" });
    }
});

/**
 * PATCH /api/super-user/user/:id/role
 * Directly changes any user's role.
 */
router.patch("/user/:id/role", async (req, res) => {
    const { id } = req.params;
    const { role, reason } = req.body;

    if (!['super_user', 'admin', 'user'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    try {
        // Only one super user allowed. 
        // If they want to change someone to super_user, they should use the transfer flow.
        if (role === 'super_user') {
            return res.status(400).json({ error: "Use the transfer flow to designate a new Super User" });
        }

        const user = await updateUserRole(id, role);
        await logAuditEvent(req.user.uid, id, 'ROLE_CHANGE_DIRECT', { role, reason });

        res.json({ success: true, user });
    } catch (err) {
        logger.error("Role Change Failed", { error: err.message });
        res.status(500).json({ error: "Failed to change user role" });
    }
});

/**
 * PATCH /api/super-user/user/:id/status
 * Ban or restore a user.
 */
router.patch("/user/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, duration, reason } = req.body;

    if (!['active', 'banned', 'blocked'].includes(status)) {
        return res.status(400).json({ error: "Invalid status for Super User action" });
    }

    try {
        if (id === req.user.uid) {
            return res.status(400).json({ error: "You cannot change your own status" });
        }

        let expiresAt = null;
        if (status === 'blocked' && duration) {
            const now = new Date();
            if (duration === '24h') expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            else if (duration === '1w') expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            else if (duration === '1m') expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            else if (duration === '3m') expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            else return res.status(400).json({ error: "Invalid duration" });
        }

        if (status === 'blocked' || status === 'active') {
            await updateUserBlock(id, status, expiresAt);
        } else {
            // 'banned' or other direct status changes
            await updateUserStatus(id, status);
        }

        await logAuditEvent(req.user.uid, id, `USER_${status.toUpperCase()}`, { status, duration, expiresAt, reason });

        res.json({ success: true, status, expiresAt });
    } catch (err) {
        logger.error("User Status Update Failed", { error: err.message });
        res.status(500).json({ error: "Failed to update user status" });
    }
});

/**
 * GET /api/super-user/global-context
 * Fetches the current platform-wide Super Global Context.
 */
router.get("/global-context", async (req, res) => {
    try {
        const content = await getGlobalSetting('super_global_context');
        res.json({ content: content || "" });
    } catch (err) {
        logger.error("Global Context Fetch Failed", { error: err.message });
        res.status(500).json({ error: "Failed to fetch global context" });
    }
});

/**
 * POST /api/super-user/global-context
 * Updates the platform-wide Super Global Context.
 */
router.post("/global-context", async (req, res) => {
    const { content } = req.body;

    try {
        await updateGlobalSetting('super_global_context', content);
        await logAuditEvent(req.user.uid, 'SYSTEM', 'GLOBAL_CONTEXT_UPDATE', { preview: content.substring(0, 50) });

        res.json({ success: true, content });
    } catch (err) {
        logger.error("Global Context Update Failed", { error: err.message });
        res.status(500).json({ error: "Failed to update global context" });
    }
});

/**
 * POST /api/super-user/transfer/initiate
 * Initiates the transfer of Super User status to an admin.
 */
router.post("/transfer/initiate", async (req, res) => {
    const { targetAdminId } = req.body;

    try {
        const target = await getUserById(targetAdminId);
        if (!target || target.role !== 'admin') {
            return res.status(400).json({ error: "Target must be an existing Admin" });
        }

        // Store pending transfer in global settings
        await updateGlobalSetting('pending_super_user_transfer', targetAdminId);
        await logAuditEvent(req.user.uid, targetAdminId, 'TRANSFER_INITIATED', {});

        res.json({ success: true, message: `Transfer initiated. Admin ${target.email} must now accept the transfer.` });
    } catch (err) {
        logger.error("Transfer Initiation Failed", { error: err.message });
        res.status(500).json({ error: "Failed to initiate transfer" });
    }
});

// Note: Target admin accepts the transfer. This route actually belongs in admin.js 
// or needs special handling since the super-user middleware blocks it.
// Let's create a special endpoint in this file that checks for the pending transfer instead of the role.

export default router;
