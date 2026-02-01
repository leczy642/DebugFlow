import { pool } from "../src/db/postgres_connect.js";

async function checkUser(email) {
    try {
        const { rows } = await pool.query('SELECT id, email, role, status FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            console.log(`User ${email} not found.`);
        } else {
            console.table(rows);
        }
    } catch (err) {
        console.error("Error querying database:", err);
    } finally {
        await pool.end();
    }
}

const emailToCheck = process.argv[2] || 'irabor.alex55@gmail.com';
checkUser(emailToCheck);
