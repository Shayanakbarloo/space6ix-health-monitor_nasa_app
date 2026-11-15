import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { afterAll, beforeAll, expect, test } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'crew-research-'))
const source = { studyId: 'OSD-569', sourceType: 'NASA_HUMAN', sourceFile: 'fixture.csv', status: 'available', count: 1 }
const hematocrit = { ...source, anatomicalSystem: 'cardiovascular', unit: 'percent', isSynthetic: false, measurement: 'hematocrit' }
const matched = { ...hematocrit, phase: 'postflight', qualityStatus: 'accepted', comparison: { baselineN: 3, baselineMedian: 44.5, absoluteChange: -0.9 } }
let server: ChildProcess
let base: string
let token: string

beforeAll(async () => {
  const path = join(dir, 'research.json')
  writeFileSync(path, JSON.stringify({
    schemaVersion: 1, studies: [source], summaries: [],
    observations: [{ ...hematocrit, observationId: 'pre', phase: 'preflight' }, { ...matched, observationId: 'post-1' }, { ...matched, observationId: 'post-2' }, { ...matched, observationId: 'no-baseline', comparison: null }],
  }))
  const experimentPath = join(dir, 'radiation-experiment.json')
  writeFileSync(experimentPath, JSON.stringify({
    schemaVersion: 1,
    series: [{ instrumentId: 'DosTel1', measurement: 'absorbed_dose_rate' }, { instrumentId: 'CRaTER-D1D2', measurement: 'absorbed_dose_rate' }],
    sources: [{ instrumentIds: ['DosTel1'] }, { instrumentIds: ['CRaTER-D1D2'] }],
  }))
  server = spawn(process.execPath, ['server/index.ts'], {
    env: { ...process.env, API_PORT: '0', DB_FILE: ':memory:', RESEARCH_FILE: path, RADIATION_EXPERIMENT_FILE: experimentPath, MODEL_REPORT: join(dir, 'missing.json') },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const [output] = await once(server.stdout!, 'data')
  base = String(output).trim().split(' ').at(-1)!
  const response = await fetch(base + '/api/login', {
    method: 'POST', body: JSON.stringify({ userId: 'C1' }),
  })
  token = (await response.json()).token
})

afterAll(async () => {
  if (server && server.exitCode == null && server.signalCode == null) {
    const closed = once(server, 'close')
    server.kill()
    await closed
  }
  rmSync(dir, { force: true, recursive: true })
})

const read = (path: string) => fetch(base + path, { headers: { Authorization: 'Bearer ' + token } })

test('sign-in needs only a demo person, no PIN', async () => {
  const signIn = (body: unknown) => fetch(base + '/api/login', { method: 'POST', body: JSON.stringify(body) })
  const ok = await signIn({ userId: 'C2' })
  expect(ok.status).toBe(200)
  expect(await ok.json()).toMatchObject({ user: { id: 'C2', role: 'cmo' } })
  expect((await signIn({ userId: 'nobody' })).status).toBe(401)
  expect(typeof token).toBe('string')
})

test('the removed Today page routes are gone', async () => {
  const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
  expect((await post('/api/notes', { day: 1, text: 'hi' })).status).toBe(404)
  expect((await post('/api/tasks', { day: 1, key: 'log:feel', done: true })).status).toBe(404)
  const state = await (await read('/api/state')).json()
  expect(state).not.toHaveProperty('notes')
  expect(state).not.toHaveProperty('tasksDone')
})

test('research routes use the existing session gate', async () => {
  expect((await fetch(base + '/api/research/studies')).status).toBe(401)
  expect((await read('/api/research/studies')).status).toBe(200)
  expect((await read('/api/state')).status).toBe(200)
  expect((await read('/api/analytics/model-info')).status).toBe(503)
})

test('research observations and system responses preserve provenance', async () => {
  const response = await read('/api/research/observations?studyId=OSD-569&limit=1')
  expect(await response.json()).toMatchObject({ total: 4, nextOffset: 1, observations: [{ sourceType: 'NASA_HUMAN', unit: 'percent' }] })
  const system = await read('/api/research/body-systems/cardiovascular?limit=1')
  expect(await system.json()).toMatchObject({ displayStatus: 'research', observations: [{ isSynthetic: false }] })
  expect((await read('/api/research/observations?studyId=OSD-569&limit=1&limit=2')).status).toBe(400)
  expect((await read('/api/research/observations?studyId=OSD-999')).status).toBe(404)
})


test('crew analytics: every crew member sees the whole crew, the surgeon on Earth does not', async () => {
  async function login(userId: string) {
    const response = await fetch(base + '/api/login', {
      method: 'POST', body: JSON.stringify({ userId }),
    })
    return { Authorization: 'Bearer ' + (await response.json()).token }
  }
  const own = await read('/api/analytics/crew/C1?day=4')
  const ownBody = await own.json()
  expect(ownBody.observations).toHaveLength(6)
  expect(ownBody.observations[0]).toMatchObject({ isSynthetic: true, unit: 'bpm' })
  expect((await read('/api/analytics/crew/C3')).status).toBe(200)
  expect((await read('/api/analytics/crew/C1?day=0')).status).toBe(400)
  expect((await fetch(base + '/api/analytics/crew/C3', { headers: await login('C2') })).status).toBe(200)
  expect((await fetch(base + '/api/analytics/crew/C3', { headers: await login('FS') })).status).toBe(403)
})

test('research filters matched comparisons before applying stable pagination', async () => {
  const query = '/api/research/observations?studyId=OSD-569&measurement=hematocrit&phase=postflight&qualityStatus=accepted&matchedBaseline=true&limit=1'
  expect(await (await read(query)).json()).toMatchObject({
    total: 2, nextOffset: 1, observations: [{ observationId: 'post-1', comparison: { baselineN: 3 } }],
  })
  expect(await (await read(query + '&offset=1')).json()).toMatchObject({
    total: 2, nextOffset: null, observations: [{ observationId: 'post-2' }],
  })
  expect((await read(query.replace('postflight', 'invalid-phase'))).status).toBe(400)
  expect((await read(query.replace('matchedBaseline=true', 'matchedBaseline=1'))).status).toBe(400)
  const empty = await read(query.replace('measurement=hematocrit', 'measurement=glucose'))
  expect(await empty.json()).toMatchObject({ total: 0, nextOffset: null, observations: [] })
})

test('radiation experiment is authenticated and filters without changing the telemetry route', async () => {
  const path = '/api/analytics/radiation-experiment'
  expect((await fetch(base + path)).status).toBe(401)
  expect(await (await read(path + '?instrumentId=DosTel1')).json()).toMatchObject({
    series: [{ instrumentId: 'DosTel1' }], sources: [{ instrumentIds: ['DosTel1'] }],
  })
  expect((await read(path + '?instrumentId=DosTel1&instrumentId=CRaTER-D1D2')).status).toBe(400)
  expect((await read('/api/analytics/radiation')).status).toBe(404)
})
