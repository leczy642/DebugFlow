/**
 * Request logger middleware.
 */
export function requestLogger(logger) {
  return (req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
  };
}
