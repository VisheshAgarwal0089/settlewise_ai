export function notFound(req, _res, next) {
  const error = new Error('Route not found');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

export function errorHandler(error, req, res, _next) {
  res.status(error.status ?? 500).json({ error: {
    code: error.code ?? 'INTERNAL_ERROR',
    message: error.status ? error.message : 'An unexpected error occurred',
    requestId: req.requestId
  }});
}

