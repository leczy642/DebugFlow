import serverless from 'serverless-http';
import { app } from './src/app.js';

// Wrap the Express app with serverless-http
const handler = serverless(app);

// Export the handler for AWS Lambda
export { handler };
