import serverless from 'serverless-http';
import { app } from './src/app.js';

// Wrap the Express app with serverless-http (buffered mode)
const serverlessHandler = serverless(app);

// Single, simple handler for ALL routes (including chat).
// The runtime uses BufferedInvokeProcessor even with RESPONSE_STREAM,
// so streamifyResponse crashes. Buffered mode is 100% reliable here.
export const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
};
