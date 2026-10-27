import type { Context } from 'hono';
import type { z } from 'zod';
import { ApiError } from './env';

const MAX_BODY_BYTES = 2_000_000;

export async function readJson<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<z.infer<S>> {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'That request is too large.');
  }

  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'That request is too large.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body must be valid JSON.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 8).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ApiError(422, 'VALIDATION', 'Some of that data did not look right.', details);
  }

  return parsed.data;
}

export function apiErrorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
}
