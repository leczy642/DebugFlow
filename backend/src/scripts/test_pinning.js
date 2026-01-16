
import { pool } from '../db/postgres_connect.js';
import { setSessionPinned, getAllSessions } from '../db/models/postgres_session_queries.js';

async function testPinning() {
    try {
        const userId = 'user_2rMm68wqv5v54X1234567890'; // Use a dummy user or fetch from DB if needed. 
        // Actually, I should pick a user ID from the sessions I listed earlier.
        // The previous output showed user_id column exists but I didn't print it.

        // Let's get a session first
        const res = await pool.query('SELECT id, user_id, title FROM sessions LIMIT 1');
        if (res.rows.length === 0) {
            console.log("No sessions found.");
            return;
        }

        const session = res.rows[0];
        console.log(`Testing with session: ${session.title} (ID: ${session.id})`);

        // Pin it
        console.log("Pinning session...");
        await setSessionPinned(session.id, true);

        // Check order
        console.log("Fetching all sessions for user " + session.user_id + "...");
        const sessions = await getAllSessions(session.user_id);

        const firstSession = sessions[0];
        console.log(`First session is now: ${firstSession.title} (Pinned: ${firstSession.pinned})`);

        if (firstSession.id === session.id && firstSession.pinned === true) {
            console.log("SUCCESS: Pinned session is at the top.");
        } else {
            console.log("FAILURE: Pinned session is NOT at the top.");
            console.log("Top session is:", firstSession);
        }

        // Unpin to cleanup
        console.log("Unpinning session...");
        await setSessionPinned(session.id, false);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

testPinning();
