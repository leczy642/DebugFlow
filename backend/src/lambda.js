import serverless from 'serverless-http';
import { app } from './app.js';

// Wrap the Express app with serverless-http (buffered mode)
const serverlessHandler = serverless(app);

// Single, simple handler for ALL routes (including chat).
export const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
};
