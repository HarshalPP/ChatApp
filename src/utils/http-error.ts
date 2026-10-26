export interface HttpError extends Error {
  status: number;
}

export function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.name = 'HttpError';
  error.status = status;
  return error;
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && err.name === 'HttpError';
}

export const badRequest = (message: string) => httpError(400, message);
export const forbidden = (message: string) => httpError(403, message);
export const notFound = (message: string) => httpError(404, message);
export const conflict = (message: string) => httpError(409, message);
