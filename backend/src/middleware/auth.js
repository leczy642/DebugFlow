/**
 * authenticateToken.js – Middleware to authenticate Firebase ID tokens
 * 
 * PURPOSE:
 *   Verifies a Firebase ID token sent in the Authorization header of an HTTP request.
 *   If valid, it attaches a normalized, secure user object to `req.user` containing
 *   verified identity and authentication metadata for use by downstream route handlers.
 *   Rejects requests with missing, malformed, or invalid tokens with a 401 Unauthorized response.
 * 
 * INPUT:
 *   - Express request object (`req`) with an `Authorization` header formatted as:
 *     `Authorization: Bearer <Firebase_ID_Token>`
 *   - Express response object (`res`) for sending error responses
 *   - Express next function (`next`) to pass control to the next middleware/route
 * 
 *  * OUTPUT:
 *   - On success: populates `req.user` with verified user claims and calls `next()`
 *   - On failure: sends a JSON response with status 401 and an error message
 * 
 * DEPENDENCIES:
 *   - Firebase Admin SDK (`firebase-admin`) initialized via `../lib/firebaseAdmin.js`
 *   - Node.js runtime with ES modules support (uses `import`/`export`)
 */


import admin from '../lib/firebaseAdmin.js';
import { getUserById, createUser, updateUserLogin, updateUserRole } from '../db/models/user_queries.js';

const auth = admin.auth();

// Constants for initial setup and recovery
const SUPER_USER_ID = process.env.SUPER_USER_ID;
const SUPER_USER_EMAIL = process.env.SUPER_USER_EMAIL;
const EMERGENCY_OVERRIDE_ID = process.env.EMERGENCY_OVERRIDE_ID;
const EMERGENCY_OVERRIDE_EMAIL = process.env.EMERGENCY_OVERRIDE_EMAIL;

async function authenticateToken(req, res, next) {

  //1. Get the authorization header - tell the server that we are using Bearer token
  //it should look like this Bearer <token>
  const authHeader = req.headers['authorization'];
  let idToken = null;

  // Check if the header is present or starts with 'Bearer '
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.debugflow_token) {
    // Check for token in cookie if header is missing
    idToken = req.cookies.debugflow_token;
  }

  if (!idToken) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header or cookie' });
  }

  //console.log(`authHeader: ${authHeader}`);
  //console.log(`idToken: ${idToken}`);

  try {
    const decodedToken = await auth.verifyIdToken(idToken);

    // 5. Fetch or create user in our local database to get role/status
    let dbUser = await getUserById(decodedToken.uid);

    if (!dbUser) {
      // Automatic bootstrapping if this is the first user or designated super user
      const isInitialSuperUser = decodedToken.uid === SUPER_USER_ID || decodedToken.email === SUPER_USER_EMAIL;

      dbUser = await createUser({
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        email_verified: decodedToken.email_verified,
        auth_provider: decodedToken.firebase?.sign_in_provider || 'email',
        is_oauth_user: !!decodedToken.firebase?.sign_in_provider && decodedToken.firebase.sign_in_provider !== 'password',
        oauth_verified: decodedToken.email_verified
      });

      if (isInitialSuperUser) {
        dbUser = await updateUserRole(decodedToken.uid, 'super_user');
        console.log(`👑 Bootstrapped initial Super User: ${decodedToken.email}`);
      } else if (isOverrideTarget) {
        // Handle emergency override for new users on first login too
        dbUser = await updateUserRole(decodedToken.uid, 'super_user');
        console.warn(`🚨 EMERGENCY OVERRIDE (First Login): User ${decodedToken.email} promoted to Super User.`);
      }
    } else {
      // Emergency Override Logic (Checks both UID and Email)
      const isOverrideTarget =
        (EMERGENCY_OVERRIDE_ID && decodedToken.uid === EMERGENCY_OVERRIDE_ID) ||
        (EMERGENCY_OVERRIDE_EMAIL && decodedToken.email === EMERGENCY_OVERRIDE_EMAIL);

      if (isOverrideTarget && dbUser.role !== 'super_user') {
        dbUser = await updateUserRole(decodedToken.uid, 'super_user');
        console.warn(`🚨 EMERGENCY OVERRIDE: User ${decodedToken.email} promoted to Super User.`);
      }

      // Update last login
      await updateUserLogin(decodedToken.uid);
    }

    // 6. Check account status (Bans are permanent)
    if (dbUser.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been permanently banned.' });
    }

    // 7. Check for automated block lifting
    if (dbUser.status === 'blocked') {
      const now = new Date();
      if (dbUser.block_expires_at && now > new Date(dbUser.block_expires_at)) {
        // Block has expired! Auto-restore
        await updateUserStatus(dbUser.id, 'active');
        dbUser.status = 'active';
        console.log(`🔓 Block automatically lifted for user: ${dbUser.email}`);
      } else {
        // Still blocked - calculate remaining time
        let message = "Your account has been blocked.";
        if (dbUser.block_expires_at) {
          const expires = new Date(dbUser.block_expires_at);
          const diffMs = expires - now;
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

          if (days > 0) {
            message = `Your account has been blocked for ${days} days and ${hours} hours remaining.`;
          } else if (hours > 0) {
            message = `Your account has been blocked for ${hours} hours and ${minutes} minutes remaining.`;
          } else {
            message = `Your account has been blocked for ${minutes} minutes remaining.`;
          }
        }
        return res.status(403).json({ error: message });
      }
    }

    // Attach verified user data and database record to request
    req.user = {
      // Identity & Auth metadata
      uid: decodedToken.uid,
      fullname: decodedToken.name,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      profile_picture: decodedToken.picture,

      // Role & Status from local DB
      role: dbUser.role || 'user',
      status: dbUser.status || 'active',
      permissions: dbUser.permissions || {},

      // Technical metadata
      authentication_time: decodedToken.auth_time,
      token_issued_at: decodedToken.iat,
      token_expires_at: decodedToken.exp,
      issuer: decodedToken.iss,
      audience: decodedToken.aud,
      sign_in_provider: decodedToken.firebase?.sign_in_provider
    };

    next();

  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid ID token' });
  }

}

//module.exports = authenticateToken;
export default authenticateToken;