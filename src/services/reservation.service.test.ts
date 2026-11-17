import { resetMemoryStore, saveReservation } from '../data/memory-store';
import { HttpError } from '../errors/http-error';
import {
  createReservation,
  listActiveReservationsForUser,
  listResources,
} from './reservation.service';

interface SlotInput {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

function slot(
  resourceId: string,
  userId: string,
  startTime: string,
  endTime: string,
): SlotInput {
  return { resourceId, userId, startTime, endTime };
}

describe('CampusHub reservations', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('lists seeded resources', () => {
    const resources = listResources(undefined, false);
    expect(resources.map((resource) => resource.id)).toEqual([
      'res-101',
      'res-102',
      'res-103',
    ]);
  });

  it('filters resources by type', () => {
    const rooms = listResources('ROOM', true);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ id: 'res-101', type: 'ROOM' });
  });

  it('rejects an empty type filter', () => {
    expect(() => listResources('', true)).toThrow(HttpError);
    let caught: unknown;
    try {
      listResources('   ', true);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'type must be a non-empty string when provided.',
    });
  });

  it('rejects a reservation that is missing a required field', () => {
    expect(() =>
      createReservation({
        userId: 'user-456',
        startTime: '2026-10-01T10:00:00Z',
        endTime: '2026-10-01T11:00:00Z',
      }),
    ).toThrow(HttpError);
  });

  it('rejects a date that is not ISO 8601', () => {
    expect(() =>
      createReservation(
        slot('res-101', 'user-456', '2026-10-01', '2026-10-01T11:00:00Z'),
      ),
    ).toThrow(HttpError);
  });

  it('rejects an end time that is not after the start time', () => {
    expect(() =>
      createReservation(
        slot('res-101', 'user-456', '2026-10-01T11:00:00Z', '2026-10-01T10:00:00Z'),
      ),
    ).toThrow(HttpError);
  });

  it('accepts a later non-overlapping booking on the same resource', () => {
    createReservation(
      slot('res-101', 'user-1', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );
    const created = createReservation(
      slot('res-101', 'user-2', '2026-10-01T12:00:00Z', '2026-10-01T13:00:00Z'),
    );

    expect(created).toMatchObject({
      resourceId: 'res-101',
      userId: 'user-2',
      startTime: '2026-10-01T12:00:00Z',
      endTime: '2026-10-01T13:00:00Z',
      status: 'PENDING',
    });
  });

  it('accepts a booking that starts when the previous one ends', () => {
    createReservation(
      slot('res-101', 'user-1', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );
    const created = createReservation(
      slot('res-101', 'user-2', '2026-10-01T11:00:00Z', '2026-10-01T12:00:00Z'),
    );

    expect(created.status).toBe('PENDING');
    expect(created.resourceId).toBe('res-101');
  });

  it('rejects an overlapping booking with 409 DOUBLE_BOOKING', () => {
    createReservation(
      slot('res-101', 'user-1', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );

    let caught: unknown;
    try {
      createReservation(
        slot('res-101', 'user-2', '2026-10-01T10:30:00Z', '2026-10-01T11:30:00Z'),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({
      status: 409,
      code: 'DOUBLE_BOOKING',
      message: 'Resource is already reserved for this time slot.',
    });
  });

  it('accepts the same time span on a different resource', () => {
    createReservation(
      slot('res-101', 'user-1', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );
    const created = createReservation(
      slot('res-102', 'user-2', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );

    expect(created.resourceId).toBe('res-102');
    expect(created.status).toBe('PENDING');
  });

  it('ignores cancelled reservations when checking conflicts', () => {
    saveReservation({
      id: 'rsv-cancelled',
      resourceId: 'res-101',
      userId: 'user-9',
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z',
      status: 'CANCELLED',
    });

    const created = createReservation(
      slot('res-101', 'user-2', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
    );
    expect(created.status).toBe('PENDING');
  });

  it('returns active reservations for a user in start-time order', () => {
    createReservation(
      slot('res-102', 'user-456', '2026-10-01T13:00:00Z', '2026-10-01T14:00:00Z'),
    );
    createReservation(
      slot('res-101', 'user-456', '2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z'),
    );
    createReservation(
      slot('res-103', 'user-999', '2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z'),
    );

    const rows = listActiveReservationsForUser('user-456');
    expect(rows.map((row) => row.resourceId)).toEqual(['res-101', 'res-102']);
    expect(rows.every((row) => row.status === 'PENDING')).toBe(true);
  });
});
