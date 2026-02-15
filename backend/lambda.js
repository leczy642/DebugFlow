import { PassThrough } from 'stream';
import http from 'http';
import serverless from 'serverless-http';
import { app } from './src/app.js';

const serverlessHandler = serverless(app);

/**
 * MAIN HANDLER — Following official AWS streaming pattern.
 * https://docs.aws.amazon.com/lambda/latest/dg/response-streaming-tutorial.html
 *
 * The handler IS the streamifyResponse wrapper (not a regular function).
 * This ensures Lambda uses StreamingInvokeProcessor.
 */
export const handler = awslambda.streamifyResponse(
    async (event, responseStream, _context) => {
        const method = event.requestContext?.http?.method;
        const path = event.rawPath || event.requestContext?.http?.path || '';
        const isChatPost = path.includes('/api/chat') && method === 'POST';

        if (isChatPost) {
            try {
                await handleChatStreaming(event, responseStream);
            } catch (err) {
                console.error('[Lambda] Chat streaming failed, falling back:', err);
                await handleBuffered(event, responseStream);
            }
        } else {
            await handleBuffered(event, responseStream);
        }
    }
);

/**
 * BUFFERED PATH — For sessions, profile, projects, admin, etc.
 * Uses serverless-http, writes the complete result to the stream.
 */
async function handleBuffered(event, responseStream) {
    const result = await serverlessHandler(event, {});

    // Use the official HttpResponseStream.from() API for headers
    const metadata = {
        statusCode: result.statusCode || 200,
        headers: result.headers || {}
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    responseStream.write(
        result.isBase64Encoded
            ? Buffer.from(result.body, 'base64')
            : (result.body || '')
    );
    responseStream.end();
    await responseStream.finished();
}

/**
 * STREAMING PATH — For POST /api/chat only.
 * Bypasses serverless-http. Creates Express-compatible req/res objects,
 * then pipes res.write() directly to the Lambda responseStream.
 * All Express middleware (CORS, auth, rate limiter) runs via app.handle().
 */
async function handleChatStreaming(event, responseStream) {
    // 1. Parse Lambda event
    const method = event.requestContext?.http?.method || 'POST';
    const rawPath = event.rawPath || '/api/chat';
    const qs = event.rawQueryString ? '?' + event.rawQueryString : '';
    const url = rawPath + qs;
    const headers = event.headers || {};
    const bodyStr = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString()
        : (event.body || '');

    // 2. Create Express-compatible request (http.IncomingMessage)
    const fakeSocket = new PassThrough();
    fakeSocket.remoteAddress = event.requestContext?.http?.sourceIp || '127.0.0.1';

    const req = new http.IncomingMessage(fakeSocket);
    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    if (!req.headers['content-length']) {
        req.headers['content-length'] = String(Buffer.byteLength(bodyStr));
    }
    // Push body so express.json() can parse it
    req.push(bodyStr);
    req.push(null);

    // 3. Create Express-compatible response (http.ServerResponse)
    const res = new http.ServerResponse(req);
    res.assignSocket(fakeSocket);

    // Track whether we've sent the HTTP preamble via the streaming API
    let preambleSent = false;

    const sendPreamble = () => {
        if (preambleSent) return;
        preambleSent = true;

        // Use the official HttpResponseStream.from() API
        const metadata = {
            statusCode: res.statusCode || 200,
            headers: res.getHeaders()
        };
        responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    };

    // Override write → pipe body directly to Lambda responseStream
    res.write = function (chunk, encoding, callback) {
        sendPreamble();
        return responseStream.write(chunk, encoding, callback);
    };

    // Override end → finalize the Lambda stream
    res.end = function (chunk, encoding, callback) {
        sendPreamble();
        if (chunk) responseStream.write(chunk, encoding);
        responseStream.end();
        res.emit('finish');
        if (typeof callback === 'function') callback();
    };

    // Override writeHead → just update status + headers (skip HTTP/1.1 framing)
    res.writeHead = function (statusCode, reason, hdrs) {
        res.statusCode = statusCode;
        if (typeof reason === 'object') hdrs = reason;
        if (hdrs) {
            for (const [k, v] of Object.entries(hdrs)) {
                res.setHeader(k, v);
            }
        }
        return res;
    };

    // 4. Run Express — CORS, auth, rate limiter all execute normally
    app.handle(req, res);

    // 5. Wait for the stream to finish
    await new Promise((resolve) => {
        responseStream.on('finish', resolve);
        responseStream.on('close', resolve);
    });
}
