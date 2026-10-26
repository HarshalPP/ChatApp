import type { Request } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { badRequest } from '../utils/http-error';

type Source = 'body' | 'params' | 'query';


export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, req: Request, source: Source): T {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    throw badRequest(field ? `${field}: ${issue?.message}` : issue?.message ?? 'Invalid request');
  }
  return result.data;
}
