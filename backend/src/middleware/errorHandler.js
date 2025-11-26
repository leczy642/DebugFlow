/**
 * Centralized error handler middleware.
 */
export function errorHandler(logger) {
  return (err, req, res, _next) => {
    logger.error({ err }, 'Unhandled error');
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  };
}
