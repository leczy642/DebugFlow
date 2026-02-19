
import { pool } from "../postgres_connect.js";
import { v4 as uuid } from "uuid";

/* -----------------------------
   PROJECTS
----------------------------- */

export async function createProject(userId, name) {
    const id = uuid();
    const { rows } = await pool.query(
        `INSERT INTO projects (id, user_id, name, context_enabled)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, name, created_at, updated_at, context_enabled`,
        [id, userId, name]
    );
    return rows[0];
}

export async function getProjects(userId) {
    const { rows } = await pool.query(
        `SELECT id, name, created_at, updated_at
     FROM projects
     WHERE user_id = $1
     ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

export async function deleteProject(projectId) {
    // First, unset project_id for all sessions in this project (move to root)
    // OR delete them? "Organize similar session histories" implies just grouping.
    // Safest is to move them to root (set project_id = NULL).
    await pool.query(
        `UPDATE sessions SET project_id = NULL WHERE project_id = $1`,
        [projectId]
    );

    const { rows } = await pool.query(
        `DELETE FROM projects WHERE id = $1 RETURNING id`,
        [projectId]
    );
    return rows[0];
}

export async function renameProject(projectId, newName) {
    const { rows } = await pool.query(
        `UPDATE projects SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [projectId, newName]
    );
    return rows[0];
}

/* -----------------------------
   PROJECT CONTEXT
----------------------------- */

export async function getProjectWithContext(projectId) {
    const { rows } = await pool.query(
        `SELECT id, name, context_instructions, context_enabled, created_at, updated_at
         FROM projects WHERE id = $1`,
        [projectId]
    );
    return rows[0];
}

export async function updateProjectContext(projectId, instructions) {
    const { rows } = await pool.query(
        `UPDATE projects 
         SET context_instructions = $2, updated_at = NOW() 
         WHERE id = $1 
         RETURNING id, name, context_instructions, context_enabled, updated_at`,
        [projectId, instructions]
    );
    return rows[0];
}

export async function setProjectContextEnabled(projectId, enabled) {
    const { rows } = await pool.query(
        `UPDATE projects 
         SET context_enabled = $2, updated_at = NOW() 
         WHERE id = $1 
         RETURNING id, name, context_instructions, context_enabled, updated_at`,
        [projectId, enabled]
    );
    return rows[0];
}
