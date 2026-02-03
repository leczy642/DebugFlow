/**
 * lambda.js
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * This is the entry point for AWS Lambda. It wraps the Express app using
 * serverless-http, allowing it to run in a serverless environment.
 *
 * HOW IT WORKS:
 * 1. Imports the configured Express `app` from app.js.
 * 2. Wraps the app with `serverless-http`.
 * 3. Exports the handler function that AWS Lambda calls.
 * -----------------------------------------------------------------------------
 */

import serverless from 'serverless-http';
import { app } from './app.js';

// The handler function that AWS Lambda will invoke.
// It maps the Lambda event to an Express request and vice-versa.
export const handler = serverless(app);
