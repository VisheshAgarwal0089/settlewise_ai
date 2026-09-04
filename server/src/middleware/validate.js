export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = new Error('Request validation failed');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }
    req.validatedBody = result.data;
    next();
  };
}

