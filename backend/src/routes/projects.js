
/**
 * Project Routes
 *
 * Provides REST API endpoints for managing projects (folders).
 */
import express from "express";
import {
    createProject,
    getProjects,
    deleteProject,
    renameProject,
    getProjectWithContext,
    updateProjectContext,
    setProjectContextEnabled
} from "../db/models/project_queries.js";
import { isSGCContained } from "../services/memoryService.js";

const router = express.Router();

/**
 * GET /projects
 */
router.get("/", async (req, res) => {
    try {
        const { uid } = req.user;
        const projects = await getProjects(uid);
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

/**
 * POST /projects
 * Body: { name }
 */
router.post("/", async (req, res) => {
    try {
        const { uid } = req.user;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });

        const project = await createProject(uid, name);
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create project" });
    }
});

/**
 * DELETE /projects/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const deleted = await deleteProject(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Project not found" });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete project" });
    }
});

/**
 * PATCH /projects/:id
 * Body: { name }
 */
router.patch("/:id", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });

        const updated = await renameProject(req.params.id, name);
        if (!updated) return res.status(404).json({ error: "Project not found" });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update project" });
    }
});

/**
 * GET /projects/:id
 * Get a single project with context fields
 */
router.get("/:id", async (req, res) => {
    try {
        const project = await getProjectWithContext(req.params.id);
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch project" });
    }
});

/**
 * PATCH /projects/:id/context
 * Update project context instructions
 * Body: { context_instructions }
 */
router.patch("/:id/context", async (req, res) => {
    try {
        const { context_instructions } = req.body;
        // Allow empty string to clear instructions
        if (context_instructions === undefined) {
            return res.status(400).json({ error: "context_instructions is required" });
        }

        // Validation: Block explicit attempts to override platform rules
        const forbiddenPatterns = [/ignore.*platform.*rule/i, /override.*super.*global/i, /disregard.*system.*instruction/i];
        if (forbiddenPatterns.some(p => p.test(context_instructions))) {
            return res.status(400).json({ error: "Your instructions contain forbidden attempts to override platform-wide rules." });
        }

        const updated = await updateProjectContext(req.params.id, context_instructions);
        if (!updated) return res.status(404).json({ error: "Project not found" });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update project context" });
    }
});

/**
 * PATCH /projects/:id/context-toggle
 * Toggle project context on/off
 * Body: { context_enabled }
 */
router.patch("/:id/context-toggle", async (req, res) => {
    try {
        const { context_enabled } = req.body;
        if (typeof context_enabled !== "boolean") {
            return res.status(400).json({ error: "context_enabled must be a boolean" });
        }

        const updated = await setProjectContextEnabled(req.params.id, context_enabled);
        if (!updated) return res.status(404).json({ error: "Project not found" });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to toggle project context" });
    }
});

/**
 * GET /projects/:id/summaries
 * Get all session summaries for a project
 */
router.get("/:id/summaries", async (req, res) => {
    try {
        const { pool } = await import("../db/postgres_connect.js");
        const { rows } = await pool.query(
            `SELECT id, title, context_summary, summary_updated_at 
             FROM sessions 
             WHERE project_id = $1 AND context_summary IS NOT NULL
             ORDER BY summary_updated_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch project summaries" });
    }
});

export default router;
