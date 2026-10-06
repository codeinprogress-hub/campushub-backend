/**
 * API shapes for the CampusHub reservation contract.
 * Field names and enums match docs/openapi.yaml components/schemas.
 */

export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type UserRole = 'STUDENT' | 'FACULTY' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/**
 * Reservation returned by the API. `id` and `status` are always present
 * on stored records even though clients omit them when creating.
 */
export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

export interface ErrorResponse {
  code: string;
  message: string;
}
