# CampusHub Reservation API — Lab 3

Three-tier reservation backend for CS 5500 Lab 3. The HTTP contract is still `docs/openapi.yaml` from Lab 2. What changed is the shape of the code: routes, controllers, and services are separated, and Mongoose is the only thing that talks to the database.

Lab 2 answered requests from an in-memory catalog. This lab assumes MongoDB is running and that the three bookable resources exist before those same checks are repeated.

## Layers

| Layer | Path | Responsibility |
| --- | --- | --- |
| Routes | `src/routes/` | Bind Lab 2 paths to controller functions |
| Controllers | `src/controllers/` | Read `req`, call a service, set `200`, `201`, `400`, `409`, or `500` |
| Services | `src/services/` | Validate input, detect overlapping bookings, query Mongoose |
| Models | `src/models/` | `Resource` and `Reservation` schemas, plus `User` for the contract |
| Config | `src/config/` | `PORT` and `MONGODB_URI`, and the database connection |

`Reservation.resourceId` is stored as an ObjectId reference to `Resource`. API responses still use the public ids from the contract (`res-101`, `rsv-1001`). The service translates between the two.

Boundary rules for later edits are in `AGENT.md`.

## What the contract covers

| Method | Path | Success | Error cases |
| --- | --- | --- | --- |
| `GET` | `/api/v1/resources` | `200` array of resources. Optional `type` query filters by `ROOM`, `EQUIPMENT`, or `LAB`. | `400` when `type` is present but empty |
| `POST` | `/api/v1/reservations` | `201` reservation. Server assigns `id` and sets `status` to `PENDING`. | `400` invalid body, unknown resource, or non-ISO-8601 date-time. `409` when the resource is already reserved for an overlapping interval |
| `GET` | `/api/v1/reservations/user/{userId}` | `200` array of that user's `PENDING` and `CONFIRMED` reservations | `400` when `userId` is blank |

Seeded resources (inserted on startup when missing):

| id | name | type | location |
| --- | --- | --- | --- |
| `res-101` | Study Room 302 | `ROOM` | Library, Floor 3 |
| `res-102` | 3D Printer A | `EQUIPMENT` | Student Center Makerspace |
| `res-103` | Chemistry Teaching Lab | `LAB` | Science Hall, Room 210 |

A filter such as `type=STUDY_ROOM` is a non-empty string, so it returns `200` and an empty array. Overlapping intervals on the same resource conflict. A booking that starts at the previous booking's `endTime` does not. `CANCELLED` reservations do not block a slot.

One behavior is tighter than Lab 2. The in-memory store accepted any `resourceId` string. `resourceId` is now a real reference, so an unknown id returns `400` with `resourceId does not match a known resource.` The Lab 2 manual checks use `res-101`, which startup creates.

## Run locally

MongoDB has to be up first. Copy the sample environment file and point it at your server:

```bash
cp .env.example .env
npm install
npm run dev
```

`.env.example` uses `mongodb://127.0.0.1:27017/campushub` and port `3000`. `src/config/index.ts` is the only place those values are read. `src/app.ts` connects with `MONGODB_URI` and then upserts the three resources above if their ids are absent. Reservations start empty.

To produce the `dist/` build:

```bash
npm run build
npm start
```

`npm test` repeats the Lab 2 checks against a temporary MongoDB. It does not replace the manual curls below.

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

- `docs/openapi.yaml` — OpenAPI 3.0.3 contract from Lab 2
- `src/models/Resource.model.ts` — resource schema and exported `ResourceEntity`
- `src/models/Reservation.model.ts` — reservation schema; `resourceId` references `Resource`
- `src/services/resource.service.ts` — catalog queries and startup seed
- `src/services/reservation.service.ts` — create and list, including overlap checks
- `src/controllers/` — HTTP only
- `src/routes/` — Lab 2 paths mapped to those controllers
- `src/config/` — environment variables and the MongoDB connection
- `src/app.ts` — mounts the routes and opens the database
- `AGENT.md` — layer rules for later agent edits
