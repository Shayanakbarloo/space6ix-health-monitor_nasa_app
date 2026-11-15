import { MISSIONS, type MissionId } from './data/missions'
import type { CrewReading } from './triage'
import { Button } from './ui'

type Props = {
  crewName: string
  mission: MissionId
  /** The person's reading now (live feed, or today's check-in for the values it holds). */
  reading: CrewReading
  /** True when blood pressure comes from today's check-in. */
  manual: boolean
  onCheckIn: () => void
}

/** Heart rate and blood pressure now, from the live feed. */
function CrewReadings({ reading, manual }: Pick<Props, 'reading' | 'manual'>) {
  const rows = [
    { label: 'Resting heart rate', value: `${reading.restingHrBpm} bpm`, from: 'Live' },
    { label: 'Systolic blood pressure', value: `${reading.systolicBp} mmHg`, from: manual ? 'Crew check-in' : 'Live' },
    { label: 'Diastolic blood pressure', value: `${reading.diastolicBp} mmHg`, from: manual ? 'Crew check-in' : 'Live' },
  ]
  return (
    <dl className="mt-2 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt>{row.label}</dt>
          <dd>
            <span className="font-mono text-ink">{row.value}</span>
            {' · '}
            {row.from}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function CardiovascularPanel({ crewName, mission, reading, manual, onCheckIn }: Props) {
  return (
    <section aria-label="Cardiovascular" className="border-b border-line px-5 py-4">
      <h2 className="font-semibold">Cardiovascular</h2>
      <div className="mt-3 text-sm text-muted">
        <h3 className="font-medium text-ink">Crew readings</h3>
        <p className="mb-2 text-xs">{crewName} · {MISSIONS[mission].name} · now</p>
        <CrewReadings reading={reading} manual={manual} />
        <Button className="mt-3" onClick={onCheckIn}>Open check-in</Button>
      </div>
    </section>
  )
}
