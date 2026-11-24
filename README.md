# CampusHub Reservation API

Contract-driven reservation engine for CS 5500 Lab 2. The OpenAPI document in `docs/openapi.yaml` is the source of truth for the resource catalog and time-slotted bookings. Express routes, TypeScript interfaces, and Mongoose models follow that contract.

Runtime storage is in memory, so the API can be exercised locally without MongoDB.

## What the contract covers

| Method | Path | Success | Error cases |
| --- | --- | --- | --- |
| `GET` | `/api/v1/resources` | `200` array of resources. Optional `type` query filters by `ROOM`, `EQUIPMENT`, or `LAB`. | `400` when `type` is present but empty |
| `POST` | `/api/v1/reservations` | `201` reservation. Server assigns `id` and sets `status` to `PENDING`. | `400` invalid body or non-ISO-8601 date-time. `409` when the resource is already reserved for an overlapping interval |
| `GET` | `/api/v1/reservations/user/{userId}` | `200` array of that user's `PENDING` and `CONFIRMED` reservations | `400` when `userId` is blank |

`User`, `Resource`, and `Reservation` are defined under `components/schemas`. Matching Mongoose models live in `src/models/`. They are not connected unless you add a database later. Local requests use `src/data/memory-store.ts`.

Seeded resources:

| id | name | type | location |
| --- | --- | --- | --- |
| `res-101` | Study Room 302 | `ROOM` | Library, Floor 3 |
| `res-102` | 3D Printer A | `EQUIPMENT` | Student Center Makerspace |
| `res-103` | Chemistry Teaching Lab | `LAB` | Science Hall, Room 210 |

Resource types are `ROOM`, `EQUIPMENT`, and `LAB`. A filter such as `type=STUDY_ROOM` is a non-empty string, so it returns `200` and an empty array. Use `type=ROOM` to retrieve Study Room 302.

Overlapping intervals on the same resource conflict. A booking that starts at the previous booking's `endTime` does not.

## Run locally

```bash
npm install
npm run dev
```

The server listens on port `3000` unless `PORT` is set. `npm run dev` reloads TypeScript in place. To produce the `dist/` build:

```bash
npm run build
npm start
```

`npx ts-node src/server.ts` also starts the server.

Lint the TypeScript sources and the OpenAPI contract:

```bash
npm run lint
npm run lint:api
```

Run the test suite:

```bash
npm test
```

The linter reports the file as valid OpenAPI 3.0.3. Its recommended ruleset also prints three warnings that come from the lab itself: the server URL must be `http://localhost:3000/api/v1`, this assignment does not ask for a license, and `User` is a domain schema with no route of its own.

## Manual checks

List resources:

```bash
curl -X GET "http://localhost:3000/api/v1/resources"
```

Filter by type:

```bash
curl -X GET "http://localhost:3000/api/v1/resources?type=ROOM"
curl -X GET "http://localhost:3000/api/v1/resources?type=STUDY_ROOM"
```

Empty filter (expect `400`):

```bash
curl -X GET "http://localhost:3000/api/v1/resources?type="
```

Create a reservation (expect `201`):

```bash
curl -X POST "http://localhost:3000/api/v1/reservations" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "res-101",
    "userId": "user-456",
    "startTime": "2026-10-01T10:00:00Z",
    "endTime": "2026-10-01T11:00:00Z"
  }'
```

Repeat that payload (expect `409`):

```json
{ "code": "DOUBLE_BOOKING", "message": "Resource is already reserved for this time slot." }
```

List the student's active reservations:

```bash
curl -X GET "http://localhost:3000/api/v1/reservations/user/user-456"
```

## Lab 8: auto-healing CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request targeting `main`. The `test` job installs dependencies with `npm ci`, runs `npm run lint`, and runs `npm test`. Jest writes `test-results.log`.

The `auto-fix` job runs only when that Jest step fails (`if: failure()`). It passes the log and the production files under `src/` to `scripts/auto-heal.mjs`. The script asks GitHub Models, OpenAI, or Anthropic — whichever credential the workflow has — to patch the bug without editing tests. If the model is unavailable or its patch still fails Jest, the script repairs the inverted half-open overlap check itself, and only when the log shows both symptoms: a free slot rejected with `409`, and a real overlap accepted. It re-runs Jest and keeps the patch only when the suite passes.

The job then pushes `fix/auto-heal-<run id>` and opens one pull request back into the branch that failed. It does not open a second pull request when one auto-heal request is already open. Review that diff before merging. The pull request body is the audit checklist: production source only, conflict detection repaired rather than removed, and the suite green.

`lab3/` is a separate Lab 3 app and is not part of this workflow.

## End-to-end reservation tests

`client/` is the booking desk. It runs at http://localhost:5173 and proxies `/api` to the Express API on port 3000. `e2e/scenarios/reservation.feature` is the Gherkin for the two journeys: a student books Study Room 302 tomorrow at 10:00 AM, and a second student is blocked from a 2:00 PM hold on 3D Printer A. `e2e/reservation.spec.ts` plays those steps with `getByRole`, `getByLabel`, and `getByText`.

Playwright starts both servers. The API process gets `E2E=1`, which exposes `POST /api/v1/test/reset` so each scenario begins with the seeded catalog and no reservations. That route is not registered otherwise. A reservation lasts one hour. The page reads the clock in UTC, so 10:00 is 10:00 AM and 14:00 is 2:00 PM.

```bash
npm install
npx playwright install --with-deps
npm run test:e2e
```

To click through the desk yourself, start the API and the client in two terminals:

```bash
npm run dev
npm run dev:client
```

To exercise the loop, branch `test/breaking-reservation-change` inverts `intervalsOverlap` so non-overlapping bookings throw `409`. Pushing that branch runs CI. `main` keeps the correct predicate, so the workflow stays green there.

## Repository map

- `docs/openapi.yaml` — OpenAPI 3.0.3 contract
- `.github/workflows/ci.yml` — lint, Jest, and the conditional auto-heal job
- `scripts/auto-heal.mjs` — reads `test-results.log` and patches `src/`
- `src/types/reservation.ts` — TypeScript interfaces for the schemas
- `src/routes/reservation.routes.ts` — Express routes mounted at `/api/v1`
- `src/services/reservation.service.ts` — validation and conflict checks
- `src/services/reservation.service.test.ts` — Jest coverage for those checks
- `src/models/` — Mongoose schemas aligned with the contract
- `client/` — React booking desk (Vite, port 5173)
- `playwright.config.ts` — boots the API and the client, then runs Chromium, Firefox, and WebKit
- `e2e/scenarios/reservation.feature` — Gherkin for the success and conflict journeys
- `e2e/reservation.spec.ts` — Playwright steps for that feature
- `src/app.ts` — application wiring
- `src/server.ts` — process entry point
- `lab3/` — Lab 3 three-tier app, outside this CI workflow
