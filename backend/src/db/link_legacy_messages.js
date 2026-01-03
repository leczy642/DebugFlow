import { pool } from "./postgres_connect.js";

async function linkLegacyMessages() {
    console.log("Starting legacy message linking...");
    const client = await pool.connect();
    try {
        // Get all sessions
        const { rows: sessions } = await client.query("SELECT id FROM sessions");
        console.log(`Found ${sessions.length} sessions.`);

        for (const session of sessions) {
            // Get messages for this session, ordered by time
            const { rows: messages } = await client.query(
                `SELECT id, parent_id FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
                [session.id]
            );

            if (messages.length === 0) continue;

            console.log(`Processing session ${session.id} (${messages.length} messages)...`);

            // Iterate and link
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];

                // Skip if it already has a parent_id (unless we want to force re-link, but better to respect existing trees)
                // However, the issue is that old messages have NULL parent_id.
                // The FIRST message (i=0) should have NULL parent_id.
                // Subsequent messages (i>0) should have parent_id = messages[i-1].id.

                if (i > 0 && !msg.parent_id) {
                    const parent = messages[i - 1];
                    await client.query(
                        `UPDATE messages SET parent_id = $1 WHERE id = $2`,
                        [parent.id, msg.id]
                    );
                    // Update local object so next iteration uses correct structure if needed (though we just use ID)
                    msg.parent_id = parent.id;
                }
            }
        }
        console.log("✅ Legacy messages linked successfully.");
    } catch (err) {
        console.error("❌ Linking failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

linkLegacyMessages();
