import type { DatabaseSync } from 'node:sqlite'
import type { User } from '../src/data/users.ts'
import { crewVitalsResponse } from '../src/crewVitals.ts'

/** GET /api/analytics/crew/:id, reading the check-in from the database. */
export function crewAnalytics(url: URL, user: User, db: DatabaseSync) {
  return crewVitalsResponse(url, user, (crewId, day) => {
    const entry = db.prepare('SELECT reading, updated_at FROM checkins WHERE crew_id = ? AND day = ?').get(crewId, day)
    return entry ? { reading: JSON.parse(String(entry.reading)), updatedAt: String(entry.updated_at) } : null
  })
}
