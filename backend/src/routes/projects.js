
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
    renameProject
} from "../db/models/project_queries.js";

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

export default router;
