import serverless from 'serverless-http';
import { app } from './src/app.js';

// Wrap the Express app with serverless-http
const serverlessHandler = serverless(app);

// Export the handler for AWS Lambda
export const handler = async (event, context) => {
    // CRITICAL: preventative measure for database connections preventing the lambda from finishing
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
};
