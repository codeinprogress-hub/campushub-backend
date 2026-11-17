import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractJsonObject,
  isAllowedSourcePath,
  parseJestLog,
  preservesExports,
  repairInvertedOverlap,
} from './auto-heal.mjs';

const FAILURE_LOG = `
FAIL src/services/reservation.service.test.ts
  ● CampusHub reservations › accepts a later non-overlapping booking on the same resource

    Resource is already reserved for this time slot.

      143 |     throw new HttpError(
    > 145 |       409,
          |           ^
      146 |       'DOUBLE_BOOKING',

      at createReservation (src/services/reservation.service.ts:145:11)

  ● CampusHub reservations › accepts a booking that starts when the previous one ends

    HttpError: Resource is already reserved for this time slot.
      409

      at createReservation (src/services/reservation.service.ts:145:11)

  ● CampusHub reservations › rejects an overlapping booking with 409 DOUBLE_BOOKING

    expect(received).toBeInstanceOf(expected)

    Expected constructor: HttpError

    Received value has no prototype
    Received value: undefined

Test Suites: 1 failed, 1 total
`;

test('parses inverted overlap symptoms from a Jest log', () => {
  const diagnosis = parseJestLog(FAILURE_LOG);
  assert.equal(diagnosis.failingTests.length, 3);
  assert.equal(diagnosis.nonOverlapRejected, true);
  assert.equal(diagnosis.overlapAllowed, true);
  assert.deepEqual(diagnosis.stackFiles, ['src/services/reservation.service.ts']);
});

test('restores a De Morgan inversion of the overlap predicate', () => {
  const source = [
    'function intervalsOverlap(startA, endA, startB, endB) {',
    '  return startA >= endB || startB >= endA;',
    '}',
    'export function createReservation() { return null; }',
  ].join('\n');
  const repaired = repairInvertedOverlap(source, {
    nonOverlapRejected: true,
    overlapAllowed: true,
  });
  assert.match(repaired, /return startA < endB && startB < endA;/);
  assert.equal(repaired.includes('startA >= endB'), false);
});

test('restores a negated overlap return', () => {
  const source = 'export function createReservation() {}\n  return !(startA < endB && startB < endA);\n';
  const repaired = repairInvertedOverlap(source, {
    nonOverlapRejected: true,
    overlapAllowed: true,
  });
  assert.match(repaired, /return startA < endB && startB < endA;/);
});

test('does not rewrite overlap logic for an unrelated failure', () => {
  const source = '  return startA >= endB || startB >= endA;\nexport function createReservation() {}\n';
  const repaired = repairInvertedOverlap(source, {
    nonOverlapRejected: false,
    overlapAllowed: false,
  });
  assert.equal(repaired, null);
});

test('refuses test files and paths outside src', () => {
  assert.equal(isAllowedSourcePath('src/services/reservation.service.ts'), true);
  assert.equal(isAllowedSourcePath('src/services/reservation.service.test.ts'), false);
  assert.equal(isAllowedSourcePath('scripts/auto-heal.mjs'), false);
  assert.equal(isAllowedSourcePath('../secrets.ts'), false);
  assert.equal(isAllowedSourcePath('src/../package.json'), false);
});

test('extracts JSON wrapped in a markdown fence', () => {
  const parsed = extractJsonObject('```json\n{"analysis":"fixed","files":[]}\n```');
  assert.equal(parsed.analysis, 'fixed');
});

test('requires exported functions to survive a patch', () => {
  const before = 'export function createReservation() {}\nexport function listResources() {}\n';
  assert.equal(preservesExports(before, before), true);
  assert.equal(preservesExports(before, 'export function createReservation() {}\n'), false);
});
