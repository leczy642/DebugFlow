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
const auth = admin.auth();

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
    //4. verify the token
    const decodedToken = await auth.verifyIdToken(idToken);
    //console.log(`decodedToken: ${JSON.stringify(decodedToken)}`);

    // Attach verified user data to request so that it can be accessed by downstream code
    req.user = {
      // User identity
      uid: decodedToken.uid,
      fullname: decodedToken.name,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      profile_picture: decodedToken.picture,
      //auth_header: authHeader,
      //decoded_token: decodedToken,

      // Authentication metadata
      authentication_time: decodedToken.auth_time,
      token_issued_at: decodedToken.iat,
      token_expires_at: decodedToken.exp,

      // Security context
      issuer: decodedToken.iss,
      audience: decodedToken.aud,
      sign_in_provider: decodedToken.firebase?.sign_in_provider
    };

    //control to the next middleware function 
    //or route handler in the request-response cycle
    next();

  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid ID token' });
  }

}

//module.exports = authenticateToken;
export default authenticateToken;