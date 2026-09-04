export function notFound(req, _res, next) {
  const error = new Error('Route not found');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

export function errorHandler(error, req, res, _next) {
  if (error.code === 'LIMIT_FILE_SIZE') { error.status = 413; error.code = 'CSV_TOO_LARGE'; error.message = 'CSV exceeds the configured size limit'; }
  const body = { error: {
    code: error.code ?? 'INTERNAL_ERROR',
    message: error.status ? error.message : 'An unexpected error occurred',
    requestId: req.requestId
  }};
  if (error.rowErrors) body.error.rowErrors = error.rowErrors;
  res.status(error.status ?? 500).json(body);
}
