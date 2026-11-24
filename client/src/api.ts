export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB'

export type Resource = {
  id: string
  name: string
  type: ResourceType
  location: string
  isAvailable: boolean
}

export type Reservation = {
  id: string
  resourceId: string
  userId: string
  startTime: string
  endTime: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
}

export type ApiError = {
  code: string
  message: string
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiError>
    if (typeof body.message === 'string' && typeof body.code === 'string') {
      return { code: body.code, message: body.message }
    }
  } catch {
    // Fall through to a generic message when the body is not JSON.
  }
  return { code: 'REQUEST_FAILED', message: 'The reservation service is unavailable.' }
}

export async function fetchResources(type: ResourceType | 'ALL'): Promise<Resource[]> {
  const query = type === 'ALL' ? '' : `?type=${encodeURIComponent(type)}`
  const response = await fetch(`/api/v1/resources${query}`)
  if (!response.ok) throw await readError(response)
  return (await response.json()) as Resource[]
}

export async function fetchBookings(userId: string): Promise<Reservation[]> {
  const response = await fetch(`/api/v1/reservations/user/${encodeURIComponent(userId)}`)
  if (!response.ok) throw await readError(response)
  return (await response.json()) as Reservation[]
}

export async function createReservation(input: {
  resourceId: string
  userId: string
  startTime: string
  endTime: string
}): Promise<Reservation> {
  const response = await fetch('/api/v1/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await readError(response)
  return (await response.json()) as Reservation
}
