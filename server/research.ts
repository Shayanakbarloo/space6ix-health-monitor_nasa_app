import { readFileSync } from 'node:fs'

import type { ResearchObservation as Observation, ResearchSource as Source } from '../src/data/researchContract.ts'

interface ResearchBundle {
  schemaVersion: number
  studies: (Source & { status: string; count: number })[]
  observations: Observation[]
  summaries: (Pick<Observation, 'studyId' | 'sourceFile' | 'measurement' | 'timepoint' | 'unit'> & { n: number })[]
}

function loadBundle<T>(path: string): T | null {
  try {
    const bundle = JSON.parse(readFileSync(path, 'utf8'))
    if (bundle?.schemaVersion !== 1) throw new Error('Unsupported artifact schema')
    return bundle as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not load research artifact', path, error)
    return null
  }
}

const bundle = loadBundle<ResearchBundle>(process.env.RESEARCH_FILE ?? 'data/research/research.json')
const report = loadBundle<object>(process.env.MODEL_REPORT ?? 'data/research/evaluation.json')
const radiationExperiment = loadBundle<{
  schemaVersion: number
  series: { instrumentId: string; measurement: string }[]
  sources: (Source & { instrumentIds?: string[] })[]
}>(process.env.RADIATION_EXPERIMENT_FILE ?? 'data/research/radiation-experiment.json')
const systems = new Set(['cardiovascular', 'immune', 'metabolic', 'skeletal', 'whole-body'])
const unavailable = { status: 503, body: { status: 'unavailable', error: 'Build the local research artifacts and restart the server.' } }

export function researchResponse(url: URL): { status: number; body: unknown } | null {
  const path = url.pathname
  const system = path.match(/^\/api\/research\/body-systems\/([^/]+)$/)?.[1]
  const experiment = path === '/api/analytics/radiation-experiment'
  const radiation = path === '/api/analytics/radiation'
  const studies = path === '/api/research/studies'
  const observations = path === '/api/research/observations'
  const summaries = path === '/api/research/summaries'
  const model = path === '/api/analytics/model-info'
  if (!experiment && !system && !radiation && !studies && !observations && !summaries && !model) return null

  const query = url.searchParams
  if (experiment) {
    const instrumentId = query.get('instrumentId')
    const measurement = query.get('measurement')
    if ([...query].some(([key, value]) => !['instrumentId', 'measurement'].includes(key)
      || query.getAll(key).length !== 1 || !/^[A-Za-z0-9_-]{1,80}$/.test(value))) {
      return { status: 400, body: { error: 'Invalid radiation experiment query.' } }
    }
    if (!radiationExperiment) {
      return { status: 503, body: { status: 'unavailable', error: 'Run python -m ml.radiation_experiment and restart the server.' } }
    }
    return { status: 200, body: {
      ...radiationExperiment,
      series: radiationExperiment.series.filter((row) => (!instrumentId || row.instrumentId === instrumentId)
        && (!measurement || row.measurement === measurement)),
      sources: radiationExperiment.sources.filter((source) => !instrumentId || source.instrumentIds?.includes(instrumentId)),
    } }
  }
  const allowed = studies || model ? [] : ['limit', 'offset', 'measurement']
  if (observations || summaries) allowed.push('studyId')
  if (observations || system || radiation) allowed.push('phase', 'qualityStatus', 'matchedBaseline')
  if (radiation) allowed.push('instrumentId')
  const measurement = query.get('measurement')
  const phase = query.get('phase')
  const quality = query.get('qualityStatus')
  const matched = query.get('matchedBaseline')
  const instrument = query.get('instrumentId')
  const study = radiation ? 'RADLAB' : query.get('studyId')
  const limit = query.get('limit') ?? '100'
  const offset = query.get('offset') ?? '0'
  if ([...query].some(([key]) => !allowed.includes(key) || query.getAll(key).length !== 1)
      || ((observations || summaries) && (!study || !/^(OSD-\d{1,6}|RADLAB)$/.test(study)))
      || (measurement !== null && !/^[\w .-]{1,120}$/.test(measurement))
      || (phase !== null && !['preflight', 'postflight'].includes(phase))
      || (quality !== null && !['accepted', 'missing', 'invalid', 'unit_unverified'].includes(quality))
      || (matched !== null && !['true', 'false'].includes(matched))
      || (instrument !== null && !/^[A-Za-z0-9_-]{1,80}$/.test(instrument))
      || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 200
      || !/^(0|[1-9]\d{0,7})$/.test(offset)) {
    return { status: 400, body: { error: 'Invalid research query.' } }
  }
  if (system && !systems.has(system)) return { status: 404, body: { error: 'Unknown body system.' } }
  if (model) return report ? { status: 200, body: report } : unavailable
  if (!bundle) return unavailable
  if (studies) return { status: 200, body: { studies: bundle.studies } }
  const sources = bundle.studies.filter((source) => !study || source.studyId === study)
  if (study && !sources.length) return { status: 404, body: { error: 'Unknown study.' } }
  const selectedSources = instrument ? sources.filter((source) => source.instrumentIds?.includes(instrument)) : sources
  if (!system && selectedSources.length && selectedSources.every((source) => source.status === 'unavailable')) {
    return { status: 503, body: { status: 'unavailable', error: 'No data is available from the selected sources.', sources: selectedSources } }
  }
  // Preserve artifact order across requests and filter before taking the page.
  const rows = summaries
    ? bundle.summaries.filter((row) => row.studyId === study && (!measurement || row.measurement === measurement))
    : bundle.observations.filter((row) => {
      const hasBaseline = Boolean(row.comparison?.baselineN && row.comparison.baselineMedian !== null)
      return (system ? row.anatomicalSystem === system : row.studyId === study)
        && (!measurement || row.measurement === measurement)
        && (!phase || row.phase === phase)
        && (!quality || row.qualityStatus === quality)
        && (!instrument || row.instrumentId === instrument)
        && (matched === null || hasBaseline === (matched === 'true'))
    })
  const page = rows.slice(Number(offset), Number(offset) + Number(limit))
  const common = { total: rows.length, nextOffset: Number(offset) + page.length < rows.length ? Number(offset) + page.length : null }
  if (system) {
    return { status: 200, body: {
      ...common, systemId: system, displayStatus: rows.length ? 'research' : 'missing',
      explanation: 'Research and environmental context for this system. Associations do not localize injury.',
      observations: page,
    } }
  }
  return { status: 200, body: { ...common, sources: selectedSources, [summaries ? 'summaries' : 'observations']: page } }
}
