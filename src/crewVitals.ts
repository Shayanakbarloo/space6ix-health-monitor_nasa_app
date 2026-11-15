// Answers GET /api/analytics/crew/:id (the crew readings in the Cardiovascular panel).
// Shared by the onboard server (server/crewAnalytics.ts) and the in-browser stand-in
// (src/localBackend.ts), so the readings are the same with or without a server.

import { CREW, MISSION_DAYS, cabinOn, readingOn } from './data/simulatedCrew.ts'
import { isMission } from './data/missions.ts'
import { canSee, type User } from './data/users.ts'
import { assessCrew, type CrewReading } from './triage.ts'

const METRICS = {
  restingHrBpm: ['bpm', 'cardiovascular'],
  systolicBp: ['mmHg', 'cardiovascular'],
  diastolicBp: ['mmHg', 'cardiovascular'],
  spo2Pct: ['percent', 'respiratory'],
  sleepHours7d: ['hour', 'behavioral'],
  bodyTempC: ['degree_Celsius', 'whole-body'],
} as const

/** A stored crew check-in for one person and day. */
export interface StoredCheckIn {
  reading: Partial<CrewReading>
  updatedAt: string | null
}

/** Returns null when the URL is not the crew analytics route. */
export function crewVitalsResponse(url: URL, user: User, checkInFor: (crewId: string, day: number) => StoredCheckIn | null) {
  const match = url.pathname.match(/^\/api\/analytics\/crew\/([A-Za-z0-9]+)$/)
  if (!match) return null
  const crew = CREW.find(({ id }) => id === match[1])
  if (!crew) return { status: 404, body: { error: 'Unknown crew member.' } }
  if (!canSee(user, crew.id)) return { status: 403, body: { error: 'Crew data is private.' } }
  const query = url.searchParams
  const dayText = query.get('day') ?? String(MISSION_DAYS)
  const day = Number(dayText)
  const mission = query.get('mission') ?? 'mars'
  if ([...query].some(([key]) => !['day', 'mission'].includes(key) || query.getAll(key).length !== 1)
      || !/^[1-9]\d?$/.test(dayText) || day > MISSION_DAYS || !isMission(mission)) {
    return { status: 400, body: { error: 'Invalid crew analytics query.' } }
  }
  const simulated = readingOn(crew, day, mission)
  const entry = checkInFor(crew.id, day)
  const manual = entry?.reading ?? {}
  const observations = (Object.keys(METRICS) as (keyof typeof METRICS)[]).map((measurement) => {
    const [unit, anatomicalSystem] = METRICS[measurement]
    const value = manual[measurement]
    const reported = typeof value === 'number' && Number.isFinite(value)
    return {
      observationId: reported ? `checkin:${crew.id}:${day}:${measurement}` : `simulation:${mission}:${crew.id}:${day}:${measurement}`,
      subjectId: crew.id, studyId: null, species: 'Homo sapiens',
      measurement, unit, anatomicalSystem, value: reported ? value : simulated[measurement],
      sourceType: reported ? 'USER_REPORTED' : 'SIMULATED', isSynthetic: !reported,
      timestamp: reported ? (entry?.updatedAt ?? null) : null, timepoint: `mission-day-${day}`,
      qualityStatus: reported ? 'self_reported' : 'accepted',
      sourceFile: reported ? null : 'src/data/simulatedCrew.ts', sourceUrl: null,
    }
  })
  return {
    status: 200,
    body: {
      crewId: crew.id, day, mission, observations,
      simulatedFindings: assessCrew(simulated, crew.baseline, cabinOn(day, mission)).map(({ id, level, sourceIds }) => ({ id, level, sourceIds })),
      modelEvaluationUrl: '/api/analytics/model-info',
    },
  }
}
