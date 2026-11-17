import {
  listStoredReservations,
  listStoredResources,
  nextReservationId,
  saveReservation,
} from '../data/memory-store';
import { HttpError } from '../errors/http-error';
import {
  Reservation,
  ReservationStatus,
  Resource,
} from '../types/reservation';

const ACTIVE_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  'PENDING',
  'CONFIRMED',
]);

const CREATE_FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'] as const;

const ALLOWED_BODY_FIELDS = new Set<string>([
  'id',
  'resourceId',
  'userId',
  'startTime',
  'endTime',
  'status',
]);

/**
 * ISO 8601 date-time. Requires a time component and a timezone (`Z` or ±hh:mm).
 * Date-only values such as `2026-10-01` are rejected.
 */
const ISO_8601_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${field} must be a non-empty string.`,
    );
  }
  return value.trim();
}

function parseDateTime(value: unknown, field: string): { iso: string; instant: number } {
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
function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA >= endB || startB >= endA;
}

export function listResources(type: unknown, typeWasProvided: boolean): Resource[] {
  if (!typeWasProvided) {
    return listStoredResources();
  }

  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'type must be a non-empty string when provided.',
    );
  }

  const filter = type.trim();
  return listStoredResources().filter((resource) => resource.type === filter);
}

export function createReservation(body: unknown): Reservation {
  if (!isRecord(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(key)) {
      throw new HttpError(400, 'VALIDATION_ERROR', `Unexpected field ${key}.`);
    }
  }

  for (const field of CREATE_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required.`);
    }
  }

  const resourceId = requireNonEmptyString(body.resourceId, 'resourceId');
  const userId = requireNonEmptyString(body.userId, 'userId');
  const start = parseDateTime(body.startTime, 'startTime');
  const end = parseDateTime(body.endTime, 'endTime');

  if (end.instant <= start.instant) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'endTime must be later than startTime.',
    );
  }

  const conflict = listStoredReservations().some((existing) => {
    if (existing.resourceId !== resourceId || !ACTIVE_STATUSES.has(existing.status)) {
      return false;
    }
    const existingStart = Date.parse(existing.startTime);
    const existingEnd = Date.parse(existing.endTime);
    return intervalsOverlap(start.instant, end.instant, existingStart, existingEnd);
  });

  if (conflict) {
    throw new HttpError(
      409,
      'DOUBLE_BOOKING',
      'Resource is already reserved for this time slot.',
    );
  }

  return saveReservation({
    id: nextReservationId(),
    resourceId,
    userId,
    startTime: start.iso,
    endTime: end.iso,
    status: 'PENDING',
  });
}

export function listActiveReservationsForUser(userId: unknown): Reservation[] {
  const id = requireNonEmptyString(userId, 'userId');

  return listStoredReservations()
    .filter((reservation) => reservation.userId === id && ACTIVE_STATUSES.has(reservation.status))
    .sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime));
}
