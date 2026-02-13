import serverless from 'serverless-http';
import { app } from './src/app.js';

// Wrap the Express app with serverless-http
const serverlessHandler = serverless(app);

// Create the streaming version of the handler
const streamingHandler = awslambda.streamifyResponse(async (event, responseStream, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const result = await serverlessHandler(event, context);

    // If this is a streaming response (SSE), we just end the stream with the result
    // Note: For TRUE streaming, we'd need to pipe Express to responseStream.
    // For now, this fixes the "mangling" by writing the body directly.
    responseStream.write(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
    responseStream.end();
});

// Export the main entry point
export const handler = async (event, context) => {
    const path = event.rawPath || event.requestContext?.http?.path || "";
    const isChat = path.includes('/api/chat');

    if (isChat && typeof awslambda !== 'undefined' && awslambda.streamifyResponse) {
        // Redirect to the streaming-aware signature handler
        return streamingHandler(event, context);
    } else {
        // Standard buffered response for everything else (sessions, profile, etc.)
        // This fixes the "T.map" error by returning a clean Lambda object
        context.callbackWaitsForEmptyEventLoop = false;
        return serverlessHandler(event, context);
    }
};
