import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

let mongo: MongoMemoryServer;
let app: Express;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.PORT = '3000';

  const [{ createApp }, models] = await Promise.all([
    import('../src/app'),
    import('../src/models/Reservation.model'),
  ]);
  app = await createApp();

  const { ResourceModel } = await import('../src/models/Resource.model');
  const resource = await ResourceModel.findOne({ id: 'res-101' });
  assert.ok(resource);
  await models.ReservationModel.create({
    id: 'rsv-cancelled-1',
    resourceId: resource._id,
    userId: 'user-cancel',
    startTime: '2026-11-01T10:00:00Z',
    endTime: '2026-11-01T11:00:00Z',
    status: 'CANCELLED',
  });
});

after(async () => {
  const { disconnectDatabase } = await import('../src/config/database');
  await disconnectDatabase();
  if (mongo) {
    await mongo.stop();
  }
});

test('GET /api/v1/resources returns the seeded catalog', async () => {
  const response = await request(app).get('/api/v1/resources');
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((resource: { id: string }) => resource.id),
    ['res-101', 'res-102', 'res-103'],
  );
  assert.equal(response.body[0].name, 'Study Room 302');
  assert.equal(response.body[0].type, 'ROOM');
  assert.equal(response.body[0].isAvailable, true);
});

test('GET /api/v1/resources filters by type and rejects an empty filter', async () => {
  const room = await request(app).get('/api/v1/resources').query({ type: 'ROOM' });
  assert.equal(room.status, 200);
  assert.equal(room.body.length, 1);
  assert.equal(room.body[0].id, 'res-101');

  const unknown = await request(app).get('/api/v1/resources').query({ type: 'STUDY_ROOM' });
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.body, []);

  const empty = await request(app).get('/api/v1/resources').query({ type: '' });
  assert.equal(empty.status, 400);
  assert.deepEqual(empty.body, {
    code: 'VALIDATION_ERROR',
    message: 'type must be a non-empty string when provided.',
  });
});

test('POST /api/v1/reservations creates a pending reservation and blocks overlaps', async () => {
  const payload = {
    resourceId: 'res-101',
    userId: 'user-456',
    startTime: '2026-10-01T10:00:00Z',
    endTime: '2026-10-01T11:00:00Z',
  };

  const created = await request(app).post('/api/v1/reservations').send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.resourceId, 'res-101');
  assert.equal(created.body.userId, 'user-456');
  assert.equal(created.body.startTime, payload.startTime);
  assert.equal(created.body.endTime, payload.endTime);
  assert.equal(created.body.status, 'PENDING');
  assert.match(created.body.id, /^rsv-\d+$/);

  const conflict = await request(app).post('/api/v1/reservations').send(payload);
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.body, {
    code: 'DOUBLE_BOOKING',
    message: 'Resource is already reserved for this time slot.',
  });

  const touching = await request(app).post('/api/v1/reservations').send({
    ...payload,
    startTime: '2026-10-01T11:00:00Z',
    endTime: '2026-10-01T12:00:00Z',
  });
  assert.equal(touching.status, 201);

  const listed = await request(app).get('/api/v1/reservations/user/user-456');
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.body.map((reservation: { startTime: string }) => reservation.startTime),
    ['2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'],
  );
});

test('validation and cancelled reservations keep the Lab 2 rules', async () => {
  const missing = await request(app).post('/api/v1/reservations').send({
    userId: 'user-456',
    startTime: '2026-12-01T10:00:00Z',
    endTime: '2026-12-01T11:00:00Z',
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.message, 'resourceId is required.');

  const badDate = await request(app).post('/api/v1/reservations').send({
    resourceId: 'res-101',
    userId: 'user-456',
    startTime: '2026-12-01',
    endTime: '2026-12-01T11:00:00Z',
  });
  assert.equal(badDate.status, 400);
  assert.equal(badDate.body.message, 'startTime must be an ISO 8601 date-time string.');

  const backwards = await request(app).post('/api/v1/reservations').send({
    resourceId: 'res-102',
    userId: 'user-456',
    startTime: '2026-12-01T11:00:00Z',
    endTime: '2026-12-01T10:00:00Z',
  });
  assert.equal(backwards.status, 400);
  assert.equal(backwards.body.message, 'endTime must be later than startTime.');

  const unknownResource = await request(app).post('/api/v1/reservations').send({
    resourceId: 'res-999',
    userId: 'user-456',
    startTime: '2026-12-01T10:00:00Z',
    endTime: '2026-12-01T11:00:00Z',
  });
  assert.equal(unknownResource.status, 400);
  assert.equal(unknownResource.body.message, 'resourceId does not match a known resource.');

  const reclaimed = await request(app).post('/api/v1/reservations').send({
    resourceId: 'res-101',
    userId: 'user-cancel',
    startTime: '2026-11-01T10:00:00Z',
    endTime: '2026-11-01T11:00:00Z',
  });
  assert.equal(reclaimed.status, 201);

  const unknownUser = await request(app).get('/api/v1/reservations/user/user-missing');
  assert.equal(unknownUser.status, 200);
  assert.deepEqual(unknownUser.body, []);

  const blankUser = await request(app).get('/api/v1/reservations/user/%20');
  assert.equal(blankUser.status, 400);
  assert.equal(blankUser.body.message, 'userId must be a non-empty string.');
});
