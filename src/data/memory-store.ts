import { Reservation, Resource } from '../types/reservation';

const seedResources: Resource[] = [
  {
    id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
  },
  {
    id: 'res-102',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Student Center Makerspace',
    isAvailable: true,
  },
  {
    id: 'res-103',
    name: 'Chemistry Teaching Lab',
    type: 'LAB',
    location: 'Science Hall, Room 210',
    isAvailable: true,
  },
];

let resources: Resource[] = seedResources.map((resource) => ({ ...resource }));
let reservations: Reservation[] = [];
let sequence = 1000;

export function listStoredResources(): Resource[] {
  return resources.map((resource) => ({ ...resource }));
}

export function listStoredReservations(): Reservation[] {
  return reservations.map((reservation) => ({ ...reservation }));
}

export function nextReservationId(): string {
  sequence += 1;
  return `rsv-${sequence}`;
}

export function saveReservation(reservation: Reservation): Reservation {
  const stored = { ...reservation };
  reservations.push(stored);
  return { ...stored };
}

/** Restores the catalog and clears reservations. Used by local tests. */
export function resetMemoryStore(): void {
  resources = seedResources.map((resource) => ({ ...resource }));
  reservations = [];
  sequence = 1000;
}
