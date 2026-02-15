import { PassThrough } from 'stream';
import http from 'http';
import serverless from 'serverless-http';
import { app } from './app.js';

const serverlessHandler = serverless(app);

/**
 * MAIN HANDLER — Official AWS streaming pattern.
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
                console.error('[Lambda] Chat streaming failed:', err);
                await handleBuffered(event, responseStream);
            }
        } else {
            await handleBuffered(event, responseStream);
        }
    }
);

async function handleBuffered(event, responseStream) {
    const result = await serverlessHandler(event, {});
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

async function handleChatStreaming(event, responseStream) {
    const method = event.requestContext?.http?.method || 'POST';
    const rawPath = event.rawPath || '/api/chat';
    const qs = event.rawQueryString ? '?' + event.rawQueryString : '';
    const url = rawPath + qs;
    const headers = event.headers || {};
    const bodyStr = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString()
        : (event.body || '');

    const fakeSocket = new PassThrough();
    fakeSocket.remoteAddress = event.requestContext?.http?.sourceIp || '127.0.0.1';

    const req = new http.IncomingMessage(fakeSocket);
    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    if (!req.headers['content-length']) {
        req.headers['content-length'] = String(Buffer.byteLength(bodyStr));
    }
    req.push(bodyStr);
    req.push(null);

    const res = new http.ServerResponse(req);
    res.assignSocket(fakeSocket);

    let preambleSent = false;

    const sendPreamble = () => {
        if (preambleSent) return;
        preambleSent = true;
        const metadata = {
            statusCode: res.statusCode || 200,
            headers: res.getHeaders()
        };
        responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    };

    res.write = function (chunk, encoding, callback) {
        sendPreamble();
        return responseStream.write(chunk, encoding, callback);
    };

    res.end = function (chunk, encoding, callback) {
        sendPreamble();
        if (chunk) responseStream.write(chunk, encoding);
        responseStream.end();
        res.emit('finish');
        if (typeof callback === 'function') callback();
    };

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

    app.handle(req, res);

    await new Promise((resolve) => {
        responseStream.on('finish', resolve);
        responseStream.on('close', resolve);
    });
}
