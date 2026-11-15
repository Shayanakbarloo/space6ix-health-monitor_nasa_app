// Stand-in for the server when there is none (for example a static demo link).
// It follows the same rules as server/index.ts, but keeps everything in this browser.
// Two tabs of the same browser share it, so the crew tab and the Earth tab still talk.
// This is a demo convenience: privacy here is only as strong as the browser, not a server.

import { crewVitalsResponse } from './crewVitals.ts'
import { CREW, MISSION_DAYS } from './data/simulatedCrew.ts'
import { isMission, linkDelay } from './data/missions.ts'
import { USERS, canSee, type User } from './data/users.ts'
import { buildDay, flagged, keyOf, type CheckIns } from './model.ts'
import type { CrewReading } from './triage.ts'
import { validateReading } from './validate.ts'

interface Row {
  [k: string]: unknown
}
interface Db {
  nextId: number
  checkIns: CheckIns
  events: Row[]
  messages: Row[]
  emergencies: Row[]
}

// v2: the live view started fresh, so check-ins from the old day view do not show up in a scenario.
const KEY = 'chm.local.v2'
const empty = (): Db => ({ nextId: 1, checkIns: {}, events: [], messages: [], emergencies: [] })

function load(): Db {
  try {
    return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Db>) }
  } catch {
    return empty()
  }
}
function save(db: Db): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
    return true
  } catch {
    // Storage blocked or full: changes last until the tab reloads.
    return false
  }
}

/** Browser storage holds about 5 MB, so keep only the newest few images. */
const KEEP_IMAGES = 3
function dropImages(db: Db, keep: number) {
  const withImage = Object.entries(db.checkIns)
    .filter(([, r]) => r.attachment)
    .sort((a, b) => String(b[1].attachment!.attachedAt).localeCompare(String(a[1].attachment!.attachedAt)))
  for (const [key, r] of withImage.slice(keep)) db.checkIns[key] = { ...r, attachment: undefined }
}

const nameOf = (id: string) => USERS.find((u) => u.id === id)?.name ?? id
const validDay = (d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= MISSION_DAYS
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : null)

function stateFor(db: Db, user: User) {
  const mySide = user.role === 'surgeon' ? 'earth' : 'ship'
  const now = Date.now()
  const messages = [...db.messages]
    .reverse()
    .slice(0, 40)
    .filter((m) => m.side === mySide || Number(m.deliver_at) <= now)
    .map((m) => ({ ...m, from_name: nameOf(String(m.from_user)), delivered: Number(m.deliver_at) <= now }))
  if (user.role === 'surgeon') return { user, now, messages, checkIns: {}, events: [], emergencies: [] }
  const checkIns: CheckIns = {}
  for (const [key, reading] of Object.entries(db.checkIns)) if (canSee(user, key.split(':')[0])) checkIns[key] = reading
  return {
    user,
    now,
    messages,
    checkIns,
    events: [...db.events].reverse().filter((e) => e.crew_id === null || canSee(user, String(e.crew_id))).slice(0, 6),
    emergencies: [...db.emergencies].reverse().slice(0, 5),
  }
}

function sendMessage(db: Db, user: User, kind: string, body: string, day: number, mission: unknown) {
  const link = linkDelay(isMission(mission) ? mission : 'mars', day)
  const delay = link.minutes
  const sent = Date.now()
  db.messages.push({ id: db.nextId++, from_user: user.id, side: user.role === 'surgeon' ? 'earth' : 'ship', kind, body, day, delay_min: delay, sent_at: sent, deliver_at: sent + link.demoMs })
}
const logEvent = (db: Db, kind: string, detail: string, crewId: string | null) => db.events.push({ id: db.nextId++, at: new Date().toISOString(), kind, detail, crew_id: crewId })

export function localCall(method: string, target: string, body: Record<string, unknown> | undefined, token: string | null): { status: number; data: unknown } {
  const fail = (status: number, error: string) => ({ status, data: { error } })
  const url = new URL(target, 'http://local')
  const path = url.pathname
  if (method === 'GET' && path === '/api/users') return { status: 200, data: { users: USERS } }
  if (method === 'POST' && path === '/api/login') {
    // No PIN: choosing a demo person is enough.
    const user = USERS.find((u) => u.id === body?.userId)
    if (!user) return fail(401, 'Choose one of the demo accounts.')
    return { status: 200, data: { token: `local:${user.id}`, user } }
  }
  const user = USERS.find((u) => token === `local:${u.id}`)
  if (!user) return fail(401, 'Please sign in.')
  if (method === 'POST' && path === '/api/logout') return { status: 200, data: { ok: true } }

  const db = load()
  const done = () => {
    save(db)
    return { status: 200, data: stateFor(db, user) }
  }
  if (method === 'GET' && path === '/api/state') return { status: 200, data: stateFor(db, user) }
  if (method === 'GET') {
    const vitals = crewVitalsResponse(url, user, (crewId, day) => {
      const reading = db.checkIns[keyOf(crewId, day)]
      return reading ? { reading, updatedAt: null } : null
    })
    if (vitals) return { status: vitals.status, data: vitals.body }
  }

  if (method === 'POST' && path === '/api/messages') {
    const msg = text(body?.body, 4000)
    if (!msg || !validDay(body?.day)) return fail(400, 'Write a message first.')
    sendMessage(db, user, body?.kind === 'report' ? 'report' : 'message', msg, body.day, body?.mission)
    return done()
  }
  if (user.role === 'surgeon') return fail(403, 'Earth can only read what the crew sent, and reply.')

  const m = path.match(/^\/api\/checkins\/([A-Za-z0-9]+)\/(\d+)$/)
  if (method === 'PUT' && m) {
    const crew = CREW.find((c) => c.id === m[1])
    const day = Number(m[2])
    if (!crew) return fail(404, 'Unknown crew member.')
    if (!canSee(user, crew.id)) return fail(403, 'Only the crew can log check-ins.')
    if (!validDay(day)) return fail(400, `Day must be 1 to ${MISSION_DAYS}.`)
    const v = validateReading(body)
    if (!v.ok) return fail(400, v.error)
    db.checkIns[keyOf(crew.id, day)] = v.reading as CrewReading
    dropImages(db, KEEP_IMAGES)
    const subject = buildDay(day, db.checkIns).find((s) => s.id === crew.id)!
    const urgent = subject.findings.some((f) => f.level === 'red')
    logEvent(db, 'checkin', `${crew.name}: check-in by ${user.name}. ${urgent ? 'URGENT finding' : `${flagged(subject.findings)} flagged`}`, crew.id)
    if (!save(db) && v.reading.attachment) {
      // Storage is full: keep the check-in, drop every image, and say so.
      dropImages(db, 0)
      save(db)
      return fail(413, 'Browser storage is full, so the check-in was saved without its image.')
    }
    return done()
  }
  if (method === 'DELETE' && path === '/api/checkins') {
    if (user.role !== 'cmo') return fail(403, 'Only the medical officer can clear check-ins.')
    db.checkIns = {}
    logEvent(db, 'clear', `All crew check-ins removed by ${user.name}`, null)
    return done()
  }
  if (method === 'POST' && path === '/api/emergencies') {
    const scenario = text(body?.scenario, 120)
    const patient = CREW.find((c) => c.id === body?.patient)
    const steps = Array.isArray(body?.steps) ? (body.steps as Row[]).slice(0, 30) : null
    if (!scenario || !patient || !steps || !validDay(body?.day)) return fail(400, 'Incomplete record.')
    const clean = steps.map((s) => ({ title: String(s.title ?? '').slice(0, 120), atSeconds: Number(s.atSeconds) || 0 }))
    db.emergencies.push({ id: db.nextId++, scenario, patient: patient.id, by_user: user.id, day: body.day, started_at: String(body?.startedAt ?? ''), steps: clean })
    logEvent(db, 'emergency', `Emergency record: ${scenario}, patient ${patient.name}`, null)
    const lines = clean.map((s) => `  +${Math.floor(s.atSeconds / 60)}:${String(Math.round(s.atSeconds % 60)).padStart(2, '0')}  ${s.title}`)
    sendMessage(db, user, 'emergency', `EMERGENCY RECORD (practice)\n${scenario}\nPatient: ${patient.name}. Run by: ${user.name}. Mission day ${body.day}.\nSteps done:\n${lines.join('\n')}`, body.day, body?.mission)
    return done()
  }
  return fail(404, 'Not found.')
}
