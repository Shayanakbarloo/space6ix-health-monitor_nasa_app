import { describe, expect, it } from 'vitest'
import { linkDelay } from './data/missions'
import { GUIDE, NASA_RISK, NASA_STUDY } from './data/signalGuide'
import { SOURCES } from './data/sources'
import { CREW, MISSION_DAYS, cabinOn, readingOn } from './data/simulatedCrew'
import { assessCabin, assessCrew, worstLevel, type CabinReading, type CrewBaseline, type CrewReading } from './triage'

const baseline: CrewBaseline = { hematocritPct: 45, onsdMm: 5.2, hctRefMin: 38.5, hctRefMax: 50, wbcK: 9.5, lymphK: 2.2, vitaminDNgMl: 40, bodyMassKg: 80 }
const normal: CrewReading = {
  hematocritPct: 45,
  onsdMm: 5.2,
  visionChange: false,
  ijvFlow: 'forward',
  ijvClotSeen: false,
  headache: false,
  sleepHours7d: 7,
  spo2Pct: 97,
  restingHrBpm: 60,
  urineLitersDay: 2.4,
  resistanceSessions7d: 6,
  moodAvg7d: 4,
  bodyTempC: 36.7,
  systolicBp: 116,
  diastolicBp: 74,
  glucoseMgDl: 92,
  wbcK: 9.5,
  lymphK: 2.2,
  vitaminDNgMl: 40,
  bodyMassKg: 80,
}
const cabin: CabinReading = { co2MmHg: 2.2, cumulativeDoseMSv: 20, missionDay: 11, doseRateMSvDay: 1.8, setting: 'on the way to Mars', rateSourceId: 'RAD_RATE', doseRateNowMSvH: 0.075 }
const level = (r: Partial<CrewReading>, id: string, c = cabin, b = baseline) => assessCrew({ ...normal, ...r }, b, c).find((f) => f.id === id)?.level

describe('hematocrit', () => {
  it('an 11% in-flight rise is expected in space, so it stays normal', () => {
    expect(level({ hematocritPct: 51 }, 'hematocrit')).toBe('green')
  })
  it('a rise over 20% and a low value are flagged', () => {
    expect(level({ hematocritPct: 55 }, 'hematocrit')).toBe('amber')
    expect(level({ hematocritPct: 36 }, 'hematocrit')).toBe('amber')
  })
})

describe('optic nerve sheath', () => {
  const big: CrewBaseline = { ...baseline, onsdMm: 6.1 }
  it('a large but unchanged diameter is normal for this person', () => {
    expect(level({ onsdMm: 6.15 }, 'onsd', cabin, big)).toBe('green')
  })
  it('growth from baseline or a vision change is flagged', () => {
    expect(level({ onsdMm: 5.8 }, 'onsd')).toBe('amber')
    expect(level({ visionChange: true }, 'onsd')).toBe('amber')
  })
})

describe('neck vein', () => {
  it('stagnant or backward flow is amber, never green', () => {
    expect(level({ ijvFlow: 'stagnant' }, 'ijv')).toBe('amber')
    expect(level({ ijvFlow: 'retrograde' }, 'ijv')).toBe('amber')
  })
  it('a clot is red', () => {
    expect(level({ ijvClotSeen: true }, 'ijv')).toBe('red')
  })
})

describe('cabin CO2 and headache', () => {
  const stuffy = { ...cabin, co2MmHg: 3.3 }
  it('3.3 mmHg is over the NASA limit', () => {
    expect(assessCabin(stuffy).find((f) => f.id === 'co2')?.level).toBe('amber')
    expect(assessCabin(cabin).find((f) => f.id === 'co2')?.level).toBe('green')
  })
  it('a headache is flagged, and linked to CO2 when CO2 is high', () => {
    const f = assessCrew({ ...normal, headache: true }, baseline, stuffy).find((x) => x.id === 'headache')!
    expect(f.level).toBe('amber')
    expect(f.why).toContain('likely cause')
  })
  it('no headache means no headache finding', () => {
    expect(level({}, 'headache')).toBeUndefined()
  })
})

describe('radiation', () => {
  const rad = (dose: number) => assessCabin({ ...cabin, cumulativeDoseMSv: dose }).find((f) => f.id === 'radiation')?.level
  it('a dose far below the career limit is normal', () => {
    expect(rad(108)).toBe('green')
  })
  it('amber at half the career limit and red at the limit', () => {
    expect(rad(300)).toBe('amber')
    expect(rad(600)).toBe('red')
  })
})

describe('kidney stone and bone signals', () => {
  it('urine under the NASA target of 2 L a day is flagged', () => {
    expect(level({ urineLitersDay: 1.6 }, 'urine')).toBe('amber')
    expect(level({ urineLitersDay: 2.2 }, 'urine')).toBe('green')
  })
  it('fewer than 5 resistance sessions a week is flagged', () => {
    expect(level({ resistanceSessions7d: 3 }, 'exercise')).toBe('amber')
    expect(level({ resistanceSessions7d: 5 }, 'exercise')).toBe('green')
  })
})

describe('indicators named by the challenge', () => {
  it('a week of low mood is flagged', () => {
    expect(level({ moodAvg7d: 2.2 }, 'mood')).toBe('amber')
    expect(level({ moodAvg7d: 3.5 }, 'mood')).toBe('green')
  })
  it('fever, high blood pressure and low blood sugar are each flagged', () => {
    expect(level({}, 'basics')).toBe('green')
    expect(level({ bodyTempC: 38.4 }, 'basics')).toBe('amber')
    expect(level({ systolicBp: 150 }, 'basics')).toBe('amber')
    expect(level({ glucoseMgDl: 60 }, 'basics')).toBe('amber')
  })
})

describe('immune and nutrition signals', () => {
  it('a 20% in-flight rise in white cells is expected; a bigger change is flagged', () => {
    expect(level({ wbcK: 11.4 }, 'immune')).toBe('green')
    expect(level({ wbcK: 14 }, 'immune')).toBe('amber')
    expect(level({ lymphK: 1.2 }, 'immune')).toBe('amber')
  })
  it('vitamin D under 30 ng/mL is flagged', () => {
    expect(level({ vitaminDNgMl: 26 }, 'vitd')).toBe('amber')
    expect(level({ vitaminDNgMl: 18 }, 'vitd')).toBe('amber')
    expect(level({ vitaminDNgMl: 34 }, 'vitd')).toBe('green')
  })
  it('losing more than 5% of body mass is flagged', () => {
    expect(level({ bodyMassKg: 79 }, 'bodymass')).toBe('green')
    expect(level({ bodyMassKg: 75 }, 'bodymass')).toBe('amber')
  })
})

describe('mission settings', () => {
  it('radiation builds up at the rate for each setting, with its own source', () => {
    expect(cabinOn(60, 'mars').cumulativeDoseMSv).toBe(108)
    expect(cabinOn(60, 'moon').cumulativeDoseMSv).toBeCloseTo(82.2, 1)
    expect(cabinOn(60, 'iss').cumulativeDoseMSv).toBeCloseTo(43.8, 1)
    for (const m of ['iss', 'moon', 'mars'] as const) {
      const f = assessCabin(cabinOn(60, m)).find((x) => x.id === 'radiation')!
      for (const id of f.sourceIds) expect(SOURCES[id], id).toBeDefined()
    }
  })
  it('the Moon setting applies a smaller fluid shift than weightlessness', () => {
    const rivera = CREW.find((c) => c.id === 'C4')!
    const weightless = readingOn(rivera, 60, 'mars').hematocritPct
    const moon = readingOn(rivera, 60, 'moon').hematocritPct
    expect(moon).toBeLessThan(weightless)
    expect(moon).toBeGreaterThan(rivera.baseline.hematocritPct)
    expect(readingOn(rivera, 60, 'iss').hematocritPct).toBe(weightless)
  })
  it('a message to the Moon takes about a second, to Mars many minutes', () => {
    expect(linkDelay('moon', 60).demoMs).toBe(1300)
    expect(linkDelay('mars', 60).minutes).toBe(16)
    expect(linkDelay('iss', 60).minutes).toBeLessThan(0.02)
  })
})

describe('shared rules and helpers', () => {
  it('low oxygen is red', () => {
    expect(level({ spo2Pct: 88 }, 'vitals')).toBe('red')
  })
  it('worstLevel picks the most serious finding, and findings are sorted most serious first', () => {
    const r = { ...normal, hematocritPct: 51, headache: true, ijvClotSeen: true }
    const list = assessCrew(r, baseline, { ...cabin, co2MmHg: 3.3 })
    expect(worstLevel(list)).toBe('red')
    expect(list[0].level).toBe('red')
    expect(worstLevel(assessCrew(normal, baseline, cabin))).toBe('green')
  })
})

describe('hazard signals', () => {
  const rate = (x: number, shelter?: number) => assessCabin({ ...cabin, doseRateNowMSvH: 0.075 * x, shelterMSvH: shelter }).find((f) => f.id === 'doserate')!
  it('radiation now: normal, caution at 5 times, shelter at 20 times the usual rate', () => {
    expect(rate(1).level).toBe('green')
    expect(rate(1).measured).toContain('normal')
    expect(rate(6).level).toBe('amber')
    expect(rate(30).level).toBe('red')
    expect(rate(30).measured).toContain('30 times normal')
    expect(rate(30, 0.56).measured).toContain('In the shelter: 0.56 mSv/h')
  })
  it('dizziness and side pain only show up when reported', () => {
    expect(level({}, 'balance')).toBeUndefined()
    expect(level({ dizzy: true }, 'balance')).toBe('amber')
    expect(level({}, 'pain')).toBeUndefined()
    expect(level({ sidePain: true }, 'pain')).toBe('amber')
  })
})

describe('NASA resources', () => {
  it('every signal has a plain-language guide, and risk links point to nasa.gov', () => {
    const ids = new Set([...assessCabin(cabinOn(60)), ...CREW.flatMap((c) => assessCrew({ ...readingOn(c, 60), headache: true, dizzy: true, sidePain: true }, c.baseline, cabinOn(60)))].map((f) => f.id))
    for (const id of ids) expect(GUIDE[id], id).toBeDefined()
    for (const r of [...Object.values(NASA_RISK), ...Object.values(NASA_STUDY)]) expect(r.url.startsWith('https://www.nasa.gov/reference/')).toBe(true)
  })
})

describe('data hygiene', () => {
  it('every finding on every simulated day cites a known source', () => {
    for (let day = 1; day <= MISSION_DAYS; day++) {
      const all = [...assessCabin(cabinOn(day)), ...CREW.flatMap((c) => assessCrew(readingOn(c, day), c.baseline, cabinOn(day)))]
      for (const f of all) {
        expect(f.sourceIds.length).toBeGreaterThan(0)
        for (const id of f.sourceIds) expect(SOURCES[id], `${f.id} -> ${id}`).toBeDefined()
      }
    }
  })
})
