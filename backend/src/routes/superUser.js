/**
 * superUser.js
 * 
 * PURPOSE:
 *   API routes for Super User exclusive functionality.
 */

import express from "express";
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
    transferSuperUser
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
    const { role } = req.body;

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
        await logAuditEvent(req.user.uid, id, 'ROLE_CHANGE_DIRECT', { role });

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
    const { status } = req.body;

    if (!['active', 'banned'].includes(status)) {
        return res.status(400).json({ error: "Invalid status for Super User action" });
    }

    try {
        if (id === req.user.uid) {
            return res.status(400).json({ error: "You cannot ban yourself" });
        }

        await updateUserStatus(id, status);
        await logAuditEvent(req.user.uid, id, status === 'banned' ? 'USER_BAN' : 'USER_UNBAN', { status });

        res.json({ success: true, status });
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
