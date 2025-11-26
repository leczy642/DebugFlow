export async function retryWithBackoff(fn, retries = 3, baseDelay = 500) {
    let attempt = 0;

    while (attempt <= retries) {
        try {
            return await fn();
        } catch (err) {
            attempt++;

            // Stop retrying after last attempt
            if (attempt > retries) {
                throw err;
            }

            const delay = baseDelay * Math.pow(2, attempt); // exponential backoff

            // Optional: Add jitter to avoid thundering herd problem
            const jitter = Math.random() * 100;

            const sleepTime = delay + jitter;

            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
    }
}
