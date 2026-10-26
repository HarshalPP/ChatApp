import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isHttpError } from '../utils/http-error';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isHttpError(err)) {
    res.status(err.status).json({ error: err.message });
    return;
  }


  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
