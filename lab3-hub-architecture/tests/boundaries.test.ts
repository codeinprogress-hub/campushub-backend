import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '..');

function readTree(directory: string): string {
  const absolute = path.join(root, directory);
  return fs
    .readdirSync(absolute)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => fs.readFileSync(path.join(absolute, name), 'utf8'))
    .join('\n');
}

test('controllers do not call the database', () => {
  const source = readTree('src/controllers');
  assert.doesNotMatch(source, /mongoose/);
  assert.doesNotMatch(source, /ResourceModel|ReservationModel|UserModel/);
  assert.match(source, /res\.status\(/);
});

test('services do not handle HTTP', () => {
  const source = readTree('src/services');
  assert.doesNotMatch(source, /from 'express'/);
  assert.doesNotMatch(source, /res\.status\(/);
  assert.match(source, /ResourceModel|ReservationModel/);
});

test('routes only bind controller handlers', () => {
  const source = readTree('src/routes');
  assert.doesNotMatch(source, /mongoose/);
  assert.doesNotMatch(source, /services\//);
  assert.match(source, /listResourcesHandler/);
  assert.match(source, /createReservationHandler/);
  assert.match(source, /listUserReservationsHandler/);
});

test('connection settings live in config and app opens the database', () => {
  const config = fs.readFileSync(path.join(root, 'src/config/index.ts'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/app.ts'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');

  assert.match(config, /process\.env\.MONGODB_URI/);
  assert.match(config, /process\.env\.PORT/);
  assert.match(app, /connectDatabase\(/);
  assert.doesNotMatch(app, /mongodb:\/\//);
  assert.doesNotMatch(server, /mongodb:\/\//);
  assert.doesNotMatch(server, /3000/);
});
