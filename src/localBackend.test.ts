// The in-browser backend answers the app's calls when there is no server (the Vercel link).
import { beforeEach, describe, expect, it } from 'vitest'
import { CREW, readingOn } from './data/simulatedCrew'
import { localCall } from './localBackend'

// localCall keeps its data in localStorage. Give the tests an in-memory one.
const store = new Map<string, string>()
const memoryStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })

const signIn = (userId: string) => localCall('POST', '/api/login', { userId }, null)
const tokenOf = (userId: string) => (signIn(userId).data as { token: string }).token
const vitals = (userId: string, crewId: string, query = '?day=4&mission=mars') => localCall('GET', `/api/analytics/crew/${crewId}${query}`, undefined, tokenOf(userId))

beforeEach(() => store.clear())

describe('sign-in without a PIN', () => {
  it('choosing a demo person is enough', () => {
    const r = signIn('C1')
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ token: 'local:C1', user: { id: 'C1', name: 'E. Vance' } })
  })
  it('an unknown person is refused', () => {
    expect(signIn('nobody').status).toBe(401)
  })
})

describe('crew readings for the Cardiovascular panel', () => {
  it('works without a server: every crew member sees the whole crew, Earth sees only what is sent', () => {
    const own = vitals('C1', 'C1')
    expect(own.status).toBe(200)
    const body = own.data as { observations: { measurement: string; sourceType: string; value: number }[] }
    expect(body.observations).toHaveLength(6)
    expect(body.observations[0]).toMatchObject({ measurement: 'restingHrBpm', sourceType: 'SIMULATED' })
    expect(vitals('C1', 'C3').status).toBe(200)
    expect(vitals('C2', 'C3').status).toBe(200)
    expect(vitals('FS', 'C1').status).toBe(403)
    expect(vitals('C1', 'C1', '?day=0').status).toBe(400)
  })
  it('shows a crew check-in as user-reported', () => {
    const token = tokenOf('C1')
    const reading = { ...readingOn(CREW.find((c) => c.id === 'C1')!, 4), restingHrBpm: 71 }
    expect(localCall('PUT', '/api/checkins/C1/4', reading as unknown as Record<string, unknown>, token).status).toBe(200)
    const body = vitals('C1', 'C1').data as { observations: { measurement: string; sourceType: string; value: number }[] }
    expect(body.observations.find((o) => o.measurement === 'restingHrBpm')).toMatchObject({ value: 71, sourceType: 'USER_REPORTED' })
  })
})

describe('removed Today page', () => {
  it('has no notes or task routes and no notes or tasks in the state', () => {
    const token = tokenOf('C1')
    expect(localCall('POST', '/api/notes', { day: 1, text: 'hi' }, token).status).toBe(404)
    expect(localCall('POST', '/api/tasks', { day: 1, key: 'log:feel', done: true }, token).status).toBe(404)
    const state = localCall('GET', '/api/state', undefined, token).data
    expect(state).not.toHaveProperty('notes')
    expect(state).not.toHaveProperty('tasksDone')
  })
})
