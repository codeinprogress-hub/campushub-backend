import { Types } from 'mongoose';
import { HttpError } from '../errors/http-error';
import { ReservationEntity, ReservationModel } from '../models/Reservation.model';
import { Reservation, ReservationStatus } from '../types/reservation';
import { findPublicIdsByObjectIds, findResourceByPublicId } from './resource.service';
import {
  intervalsOverlap,
  isRecord,
  parseDateTime,
  requireNonEmptyString,
} from './validation';

const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

const CREATE_FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'] as const;

const ALLOWED_BODY_FIELDS = new Set<string>([
  'id',
  'resourceId',
  'userId',
  'startTime',
  'endTime',
  'status',
]);

interface StoredReservation extends ReservationEntity {
  _id: Types.ObjectId;
}

async function nextReservationId(): Promise<string> {
  const rows = await ReservationModel.find().select('id').lean<StoredReservation[]>();
  let max = 1000;

  for (const row of rows) {
    const match = /^rsv-(\d+)$/.exec(row.id);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > max) {
      max = value;
    }
  }

  return `rsv-${max + 1}`;
}

export async function createReservation(body: unknown): Promise<Reservation> {
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
    throw new HttpError(400, 'VALIDATION_ERROR', 'endTime must be later than startTime.');
  }

  const resource = await findResourceByPublicId(resourceId);
  if (!resource) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'resourceId does not match a known resource.');
  }

  const existing = await ReservationModel.find({
    resourceId: resource._id,
    status: { $in: ACTIVE_STATUSES },
  }).lean<StoredReservation[]>();

  const conflict = existing.some((row) => {
    const existingStart = Date.parse(row.startTime);
    const existingEnd = Date.parse(row.endTime);
    return intervalsOverlap(start.instant, end.instant, existingStart, existingEnd);
  });

  if (conflict) {
    throw new HttpError(
      409,
      'DOUBLE_BOOKING',
      'Resource is already reserved for this time slot.',
    );
  }

  const id = await nextReservationId();
  await ReservationModel.create({
    id,
    resourceId: resource._id,
    userId,
    startTime: start.iso,
    endTime: end.iso,
    status: 'PENDING',
  });

  return {
    id,
    resourceId,
    userId,
    startTime: start.iso,
    endTime: end.iso,
    status: 'PENDING',
  };
}

export async function listActiveReservationsForUser(userId: unknown): Promise<Reservation[]> {
  const id = requireNonEmptyString(userId, 'userId');
  const rows = await ReservationModel.find({
    userId: id,
    status: { $in: ACTIVE_STATUSES },
  }).lean<StoredReservation[]>();

  const publicIds = await findPublicIdsByObjectIds(rows.map((row) => row.resourceId));
  const reservations: Reservation[] = [];

  for (const row of rows) {
    const publicResourceId = publicIds.get(row.resourceId.toString());
    if (publicResourceId === undefined) {
      continue;
    }
    reservations.push({
      id: row.id,
      resourceId: publicResourceId,
      userId: row.userId,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
    });
  }

  reservations.sort(
    (left, right) => Date.parse(left.startTime) - Date.parse(right.startTime),
  );
  return reservations;
}
