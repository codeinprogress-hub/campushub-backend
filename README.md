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

Lint the contract:

```bash
npm run lint:api
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

## Repository map

- `docs/openapi.yaml` — OpenAPI 3.0.3 contract
- `src/types/reservation.ts` — TypeScript interfaces for the schemas
- `src/routes/reservation.routes.ts` — Express routes mounted at `/api/v1`
- `src/services/reservation.service.ts` — validation and conflict checks
- `src/models/` — Mongoose schemas aligned with the contract
- `src/app.ts` — application wiring
- `src/server.ts` — process entry point
