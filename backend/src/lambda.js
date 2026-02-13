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

// Wrap the Express app with serverless-http
const serverlessHandler = serverless(app);

// Create the streaming version of the handler
const streamingHandler = awslambda.streamifyResponse(async (event, responseStream, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const result = await serverlessHandler(event, context);
    responseStream.write(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
    responseStream.end();
});

// Export the main entry point
export const handler = async (event, context) => {
    const path = event.rawPath || event.requestContext?.http?.path || "";
    const isChat = path.includes('/api/chat');

    if (isChat && typeof awslambda !== 'undefined' && awslambda.streamifyResponse) {
        return streamingHandler(event, context);
    } else {
        context.callbackWaitsForEmptyEventLoop = false;
        return serverlessHandler(event, context);
    }
};
