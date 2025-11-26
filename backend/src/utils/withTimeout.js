export async function withTimeout(promiseFn, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFn(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
}
