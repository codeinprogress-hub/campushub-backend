# Agent boundaries

CampusHub Lab 3 keeps three layers. Follow these rules when changing the API.

- `src/routes/` only maps an HTTP path to a controller function. No database calls and no business rules.
- `src/controllers/` reads `req`, calls one service function, and sets `res` (`200`, `201`, `400`, `409`, `500`). Do not import Mongoose or the model files.
- `src/services/` owns validation, conflict checks, and every Mongoose call. Do not import Express and do not reference `req` or `res`.
- `src/models/Resource.model.ts` stores `name`, `type` (`ROOM`, `EQUIPMENT`, `LAB`), `location`, and `isAvailable`, plus the public `id`.
- `src/models/Reservation.model.ts` stores `resourceId` as an ObjectId reference to `Resource`, plus `userId`, `startTime`, `endTime`, and `status` (`PENDING`, `CONFIRMED`, `CANCELLED`).
- `PORT` and `MONGODB_URI` are read only in `src/config/`. Do not hardcode a port or a MongoDB URL anywhere else.
- Preserve `docs/openapi.yaml`. Response bodies stay on that contract: public string ids (`res-101`, `rsv-1001`), not raw ObjectIds.
