import { HttpError } from '../errors/http-error';

/**
 * ISO 8601 date-time. Requires a time component and a timezone (`Z` or ±hh:mm).
 * Date-only values such as `2026-10-01` are rejected.
 */
const ISO_8601_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a non-empty string.`);
  }
  return value.trim();
}

export function parseDateTime(value: unknown, field: string): { iso: string; instant: number } {
  if (typeof value !== 'string' || !ISO_8601_DATE_TIME.test(value.trim())) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${field} must be an ISO 8601 date-time string.`,
    );
  }

  const iso = value.trim();
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${field} must be an ISO 8601 date-time string.`,
    );
  }

  return { iso, instant };
}

/**
 * Half-open intervals overlap when each starts before the other ends.
 * A reservation that starts exactly when another ends does not conflict.
 */
export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}
