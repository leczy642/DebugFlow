/**
 * promote-user.js
 * 
 * PURPOSE:
 *   Emergency recovery script to promote a user to Super User or Admin status.
 *   This script bypasses the web UI and directly updates the database.
 * 
 * USAGE:
 *   node backend/src/scripts/promote-user.js --uid <FIREBASE_UID> --role <super_user|admin|user>
 * 
 * EXAMPLE:
 *   node backend/src/scripts/promote-user.js --uid some-uid-123 --role super_user
 */

import { pool } from '../db/postgres_connect.js';
import { updateUserRole, updateUserStatus, logAuditEvent } from '../db/models/user_queries.js';

async function main() {
    const args = process.argv.slice(2);
    const uidArgIndex = args.indexOf('--uid');
    const roleArgIndex = args.indexOf('--role');

    if (uidArgIndex === -1 || roleArgIndex === -1 || !args[uidArgIndex + 1] || !args[roleArgIndex + 1]) {
        console.error('❌ Missing arguments. Usage: node promote-user.js --uid <UID> --role <ROLE>');
        process.exit(1);
    }

    const uid = args[uidArgIndex + 1];
    const role = args[roleArgIndex + 1];

    const validRoles = ['super_user', 'admin', 'user'];
    if (!validRoles.includes(role)) {
        console.error(`❌ Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
        process.exit(1);
    }

    try {
        console.log(`🚀 Promoting user ${uid} to role ${role}...`);

        // Force status to active just in case they were banned
        await updateUserStatus(uid, 'active');
        const user = await updateUserRole(uid, role);

        if (!user) {
            console.error(`❌ User with UID ${uid} not found in database.`);
            process.exit(1);
        }

        await logAuditEvent('SYSTEM_CLI', uid, 'ROLE_UPGRADE_EMERGENCY', { role });

        console.log(`✅ Success! User ${user.email} is now a ${role}.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to promote user:', err.message);
        process.exit(1);
    }
}

main();
