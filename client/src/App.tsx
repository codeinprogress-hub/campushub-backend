import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createReservation,
  fetchBookings,
  fetchResources,
  type Reservation,
  type Resource,
  type ResourceType,
} from './api'
import { formatUtcDate, formatUtcTime, slotRange, tomorrowUtcDate } from './schedule'

type Notice =
  | { tone: 'success'; text: string }
  | { tone: 'conflict'; text: string }
  | { tone: 'error'; text: string }

const CONFLICT_TEXT = 'Resource unavailable for selected time'
const CONFIRMED_TEXT = 'Reservation Confirmed'

const TYPE_OPTIONS: Array<ResourceType | 'ALL'> = ['ALL', 'ROOM', 'EQUIPMENT', 'LAB']

export default function App() {
  const [studentId, setStudentId] = useState('user-456')
  const [type, setType] = useState<ResourceType | 'ALL'>('ALL')
  const [resources, setResources] = useState<Resource[]>([])
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({})
  const [resourcesStatus, setResourcesStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [date, setDate] = useState(tomorrowUtcDate)
  const [startTime, setStartTime] = useState('10:00')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookings, setBookings] = useState<Reservation[]>([])
  const [bookingsStatus, setBookingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    setResourcesStatus('loading')
    fetchResources(type)
      .then((next) => {
        if (controller.signal.aborted) return
        setResources(next)
        setResourceNames((current) => {
          const names = { ...current }
          for (const resource of next) names[resource.id] = resource.name
          return names
        })
        setResourcesStatus('ready')
        setSelectedId((current) => (next.some((resource) => resource.id === current) ? current : null))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setResources([])
        setResourcesStatus('error')
      })
    return () => controller.abort()
  }, [type])

  useEffect(() => {
    const userId = studentId.trim()
    if (!userId) {
      setBookings([])
      setBookingsStatus('ready')
      return
    }
    const controller = new AbortController()
    setBookingsStatus('loading')
    fetchBookings(userId)
      .then((next) => {
        if (controller.signal.aborted) return
        setBookings(next)
        setBookingsStatus('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setBookings([])
        setBookingsStatus('error')
      })
    return () => controller.abort()
  }, [studentId])

  const selected = resources.find((resource) => resource.id === selectedId) ?? null
  const preview = startTime ? slotRange(date, startTime) : null
  const resourceName = (resourceId: string) => resourceNames[resourceId] ?? resourceId

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || submitting) return
    const userId = studentId.trim()
    if (!userId) {
      setNotice({ tone: 'error', text: 'Student ID is required.' })
      return
    }

    setSubmitting(true)
    setNotice(null)
    const range = slotRange(date, startTime)
    try {
      await createReservation({
        resourceId: selected.id,
        userId,
        startTime: range.startTime,
        endTime: range.endTime,
      })
      setNotice({ tone: 'success', text: CONFIRMED_TEXT })
      const nextBookings = await fetchBookings(userId)
      setBookings(nextBookings)
      setBookingsStatus('ready')
    } catch (error) {
      const apiError = error as { code?: string; message?: string }
      if (apiError.code === 'DOUBLE_BOOKING') {
        setNotice({ tone: 'conflict', text: CONFLICT_TEXT })
      } else {
        setNotice({
          tone: 'error',
          text: apiError.message ?? 'The reservation service is unavailable.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">Campus resource desk</p>
        <h1>CampusHub</h1>
        <p className="lede">
          Filter the catalog, pick a room or piece of equipment, and hold a one-hour block.
          Times are stored in UTC.
        </p>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="catalog-heading">
          <div className="panel-heading">
            <h2 id="catalog-heading">Find a resource</h2>
          </div>

          <div className="fields">
            <label htmlFor="student-id">
              Student ID
              <input
                id="student-id"
                name="studentId"
                value={studentId}
                autoComplete="username"
                onChange={(event) => setStudentId(event.target.value)}
              />
            </label>
            <label htmlFor="resource-type">
              Resource type
              <select
                id="resource-type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as ResourceType | 'ALL')}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All types' : option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {resourcesStatus === 'loading' ? <p className="muted">Loading resources</p> : null}
          {resourcesStatus === 'error' ? (
            <p role="alert">The reservation service is unavailable.</p>
          ) : null}
          {resourcesStatus === 'ready' && resources.length === 0 ? (
            <p className="muted">No resources match this type.</p>
          ) : null}

          <ul className="catalog">
            {resources.map((resource) => {
              const pressed = resource.id === selectedId
              return (
                <li key={resource.id}>
                  <button
                    type="button"
                    className={pressed ? 'resource is-selected' : 'resource'}
                    aria-pressed={pressed}
                    aria-label={resource.name}
                    onClick={() => {
                      setSelectedId(resource.id)
                      setNotice(null)
                    }}
                  >
                    <span className="resource-name">{resource.name}</span>
                    <span className="resource-meta">
                      {resource.type} · {resource.location}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="reserve-heading">
            <div className="panel-heading">
              <h2 id="reserve-heading">Reserve</h2>
            </div>
            {selected ? (
              <form onSubmit={onSubmit} aria-label="Reservation details">
                <p className="selection">
                  Holding <strong>{selected.name}</strong>
                </p>
                <div className="fields">
                  <label htmlFor="reservation-date">
                    Date
                    <input
                      id="reservation-date"
                      name="date"
                      type="date"
                      value={date}
                      required
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  <label htmlFor="start-time">
                    Start time
                    <input
                      id="start-time"
                      name="startTime"
                      type="time"
                      value={startTime}
                      step={60}
                      required
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                  </label>
                </div>
                {preview ? (
                  <p className="muted">
                    Selected block: {formatUtcTime(preview.startTime)} – {formatUtcTime(preview.endTime)}
                  </p>
                ) : null}
                <button type="submit" className="submit" disabled={submitting}>
                  {submitting ? 'Reserving…' : 'Reserve'}
                </button>
              </form>
            ) : (
              <p className="muted">Select a resource to choose a time.</p>
            )}
            {notice?.tone === 'success' ? <p role="status">{notice.text}</p> : null}
            {notice && notice.tone !== 'success' ? <p role="alert">{notice.text}</p> : null}
          </section>

          <section className="panel" aria-labelledby="bookings-heading">
            <div className="panel-heading">
              <h2 id="bookings-heading">My Bookings</h2>
            </div>
            {bookingsStatus === 'loading' ? <p className="muted">Loading bookings</p> : null}
            {bookingsStatus === 'error' ? (
              <p role="alert">Bookings could not be loaded.</p>
            ) : null}
            {bookingsStatus === 'ready' && bookings.length === 0 ? (
              <p className="muted">No bookings yet.</p>
            ) : null}
            {bookings.length > 0 ? (
              <ul className="bookings">
                {bookings.map((booking) => (
                  <li key={booking.id}>
                    <span className="resource-name">{resourceName(booking.resourceId)}</span>
                    <span className="resource-meta">
                      {formatUtcDate(booking.startTime)} · {formatUtcTime(booking.startTime)} –{' '}
                      {formatUtcTime(booking.endTime)} · {booking.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  )
}
