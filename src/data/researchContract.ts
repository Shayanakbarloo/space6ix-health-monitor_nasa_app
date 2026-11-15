export type SourceType = 'NASA_HUMAN' | 'NASA_ANIMAL' | 'NASA_ENVIRONMENT' | 'SIMULATED' | 'USER_REPORTED'
export type QualityStatus = 'accepted' | 'missing' | 'invalid' | 'unit_unverified'
export type FlightPhase = 'preflight' | 'postflight'

export interface ResearchSource {
  studyId: string
  studyUrl: string
  sourceFile: string
  sourceUrl: string
  sourceType: SourceType
  species: string | null
  sha256: string | null
  retrievedAt: string | null
  instrumentIds?: string[]
}

export interface ResearchObservation extends ResearchSource {
  observationId: string
  subjectId: string | null
  timepoint: string | null
  timestamp: string | null
  measurement: string
  value: number | null
  unit: string | null
  anatomicalSystem: string
  qualityStatus: QualityStatus
  isSynthetic: boolean
  phase?: FlightPhase | null
  instrumentId?: string
  comparison?: {
    baselineN: number
    baselineMedian: number | null
    absoluteChange: number | null
    percentChange: number | null
  } | null
}

export interface ResearchPage {
  total: number
  nextOffset: number | null
  sources: (ResearchSource & { status: string; count: number; reason?: string })[]
  observations: ResearchObservation[]
}

export interface CrewVitals {
  crewId: string
  day: number
  observations: {
    measurement: string
    unit: string
    value: number | null
    sourceType: 'SIMULATED' | 'USER_REPORTED'
  }[]
}

export const hematocritQuery = '/api/research/observations?studyId=OSD-569&measurement=hematocrit&phase=postflight&qualityStatus=accepted&matchedBaseline=true&limit=1'
