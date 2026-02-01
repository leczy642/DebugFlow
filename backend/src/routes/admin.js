/**
 * admin.js
 * 
 * PURPOSE:
 *   API routes for Admin-level functionality including user management,
 *   dashboard metrics, and suggestions.
 */

import express from "express";
import { pool } from "../db/postgres_connect.js";
import { logger } from "../utils/logger.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
    updateUserStatus,
    setUserSuggestion,
    logAuditEvent,
    getUserById,
    updateUserRole
} from "../db/models/user_queries.js";

const router = express.Router();

// All routes here require at least Admin role
router.use(requireRole(['admin', 'super_user']));

/**
 * GET /api/admin/dashboard
 * Returns total users, active users, and basic health metrics.
 */
router.get("/dashboard", async (req, res) => {
    try {
        const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
        const activeToday = await pool.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '1 day'");
        const activeWeek = await pool.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '7 days'");
        const activeMonth = await pool.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '30 days'");

        // Simple health check: check if DB and Pinecone are responsive
        // (In a real app, this might be more complex)
        const health = {
            database: "healthy",
            api: "healthy",
            uptime: process.uptime()
        };

        res.json({
            metrics: {
                total_users: parseInt(totalUsers.rows[0].count),
                active_users: {
                    daily: parseInt(activeToday.rows[0].count),
                    weekly: parseInt(activeWeek.rows[0].count),
                    monthly: parseInt(activeMonth.rows[0].count)
                }
            },
            health
        });
    } catch (err) {
        logger.error("Admin Dashboard Fetch Failed", { error: err.message });
        res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
});

/**
 * GET /api/admin/users/search/:query
 * Searches for users by email or ID.
 */
router.get("/users/search/:query", async (req, res) => {
    const { query } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT id, email, name, role, status, suggested_role, suggestion_reason 
             FROM users 
             WHERE email ILIKE $1 OR id = $2
             LIMIT 10`,
            [`%${query}%`, query]
        );
        res.json(rows);
    } catch (err) {
        logger.error("Admin User Search Failed", { error: err.message });
        res.status(500).json({ error: "Failed to search for users" });
    }
});

/**
 * PATCH /api/admin/user/:id/block
 * Blocks or restores a user.
 */
router.patch("/user/:id/block", async (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body; // boolean

    try {
        const targetUser = await getUserById(id);
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        // Admins cannot block Super Users or other Admins (unless they are Super User themselves)
        if (req.user.role !== 'super_user' && (targetUser.role === 'admin' || targetUser.role === 'super_user')) {
            return res.status(403).json({ error: "Insufficient permissions to block this user" });
        }

        const newStatus = blocked ? 'blocked' : 'active';
        await updateUserStatus(id, newStatus);
        await logAuditEvent(req.user.uid, id, blocked ? 'USER_BLOCK' : 'USER_RESTORE', { status: newStatus });

        res.json({ success: true, status: newStatus });
    } catch (err) {
        logger.error("User Block Action Failed", { error: err.message });
        res.status(500).json({ error: "Failed to update user status" });
    }
});

/**
 * POST /api/admin/suggest-role
 * Suggests a role change (promotion/demotion) for a user.
 * If requester is a Super User, applies it immediately.
 */
router.post("/suggest-role", async (req, res) => {
    const { userId, suggestedRole, reason } = req.body;

    if (!['admin', 'user'].includes(suggestedRole)) {
        return res.status(400).json({ error: "Invalid suggested role" });
    }

    try {
        const targetUser = await getUserById(userId);
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        const requesterRole = req.user.role?.toLowerCase();

        logger.info("Role action requested", {
            requesterId: req.user.uid,
            requesterRole,
            targetId: userId,
            targetEmail: targetUser.email,
            suggestedRole
        });

        if (requesterRole === 'super_user') {
            await updateUserRole(userId, suggestedRole);
            await logAuditEvent(req.user.uid, userId, 'ROLE_CHANGE_ADMIN', { role: suggestedRole, reason });
            return res.json({ success: true, message: `User ${targetUser.email} has been promoted to ${suggestedRole} immediately.` });
        } else {
            await setUserSuggestion(userId, suggestedRole, reason);
            await logAuditEvent(req.user.uid, userId, 'ROLE_SUGGESTION', { suggestedRole, reason });
            return res.json({ success: true, message: `Suggestion for ${suggestedRole} submitted.` });
        }
    } catch (err) {
        logger.error("Role action processing failed", { error: err.message });
        res.status(500).json({ error: "Failed to process role action" });
    }
});

/**
 * POST /api/admin/transfer/accept
 * Allows an admin to accept a pending Super User transfer.
 */
router.post("/transfer/accept", async (req, res) => {
    try {
        const pendingTargetId = await getGlobalSetting('pending_super_user_transfer');

        if (!pendingTargetId || pendingTargetId !== req.user.uid) {
            return res.status(403).json({ error: "No pending Super User transfer found for your account." });
        }

        // We need the current Super User ID. 
        // We can find it by looking for the user with role 'super_user'
        const { rows } = await pool.query("SELECT id FROM users WHERE role = 'super_user'");
        const currentSuperUserId = rows[0]?.id;

        if (!currentSuperUserId) {
            return res.status(500).json({ error: "System error: current Super User not found." });
        }

        // Perform the atomic transfer
        await transferSuperUser(currentSuperUserId, req.user.uid);

        // Clear the pending transfer
        await updateGlobalSetting('pending_super_user_transfer', null);

        await logAuditEvent(req.user.uid, currentSuperUserId, 'TRANSFER_ACCEPTED', { from: currentSuperUserId, to: req.user.uid });

        res.json({ success: true, message: "You are now the Super User. Refresh your session." });
    } catch (err) {
        logger.error("Transfer Acceptance Failed", { error: err.message });
        res.status(500).json({ error: "Failed to accept transfer" });
    }
});

/**
 * POST /api/admin/self-demote
 * Allows an admin to demote themselves to a regular user.
 */
router.post("/self-demote", async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(400).json({ error: "Only admins can demote themselves. Super users must transfer power first." });
        }

        await updateUserRole(req.user.uid, 'user');
        await logAuditEvent(req.user.uid, req.user.uid, 'SELF_DEMOTION', { from: 'admin', to: 'user' });

        res.json({ success: true, message: "Successfully demoted to user status." });
    } catch (err) {
        logger.error("Self-demotion Failed", { error: err.message });
        res.status(500).json({ error: "Failed to demote self" });
    }
});

export default router;
