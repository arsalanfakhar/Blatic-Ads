import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function failure(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function unauthorized(message = 'Unauthorized') {
  return failure(message, 401);
}

export function forbidden(message = 'Forbidden') {
  return failure(message, 403);
}

export function notFound(message = 'Not found') {
  return failure(message, 404);
}

export function serverError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error(`[API] ${context ?? 'Error'}:`, error);
  return failure(`Internal server error: ${message}`, 500);
}

export function handleZodError(error: ZodError) {
  const first = error.errors[0];
  return failure(first?.message ?? 'Validation failed', 422, error.errors);
}

export async function parseJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
