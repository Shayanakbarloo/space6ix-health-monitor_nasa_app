import { describe, expect, it } from 'vitest'
import { ask, suggestions, type AskContext } from './handbook'
import { buildLive, type ScenarioId } from './live'
import type { MissionId } from './data/missions'

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0)
const ctxFor = (scenario: ScenarioId, mission: MissionId = 'mars', meId = 'C2'): AskContext => ({
  subjects: buildLive(scenario, T0, {}, mission, { start: T0 - 5000 }).subjects,
  meId,
  day: 64,
  mission,
  scenario,
})
const topics = (q: string, ctx: AskContext) => ask(q, ctx).map((a) => a.topic)
const first = (q: string, ctx: AskContext) => ask(q, ctx)[0]

describe('Ask: the crew right now', () => {
  it('answers about the whole crew and about one person, by name, role or pronoun', () => {
    const ctx = ctxFor('isolation')
    expect(first('How is the crew?', ctx).topic).toBe('crew')
    expect(first('How is the crew?', ctx).lead).toContain('Khamosh Mehta')
    expect(first('how is mehta', ctx).topic).toBe('person:C4')
    expect(first('how is khamosh', ctx).topic).toBe('person:C4')
    expect(first('is roya ok?', ctx).topic).toBe('person:C3')
    expect(first('how is tulsi gandi', ctx).topic).toBe('person:C1')
    expect(first('how is shayan akbarloyshabgahi', ctxFor('normal', 'mars', 'C3')).topic).toBe('person:C2')
    expect(first('how is the flight engineer doing?', ctx).topic).toBe('person:C4')
    expect(first('how am i', ctx).topic).toBe('person:C2')
    // Follow-up: "him" is the last person asked about.
    const after = ask('what can we do for him', { ...ctx, last: { person: 'C4', topic: 'person:C4' } })[0]
    expect(after.topic).toBe('steps:isolation')
  })

  it('answers about a reading, with the live value, and finds who has a symptom', () => {
    const ctx = ctxFor('co2')
    const mine = first('Is my oxygen normal?', ctx)
    expect(mine.topic).toBe('signal:C2:vitals')
    expect(mine.lead).toMatch(/^Normal for you: SpO2 \d+%/)
    expect(first('who has a headache?', ctx).lead).toContain('Roya Alizadeh')
    expect(first('who has a headache?', ctxFor('normal')).lead).toBe('Nobody has reported a headache right now.')
    expect(first('is the air safe', ctx).topic).toBe('signal:cabin:co2')
  })

  it("prefers the scenario patient's flagged reading over the asker's normal one", () => {
    expect(first('is the fever going down', ctxFor('flagged')).topic).toBe('signal:C3:basics')
  })
})

describe('Ask: what is happening and what to do', () => {
  it('knows the scenario being played and its steps', () => {
    const ctx = ctxFor('radiation')
    expect(first("What's happening right now?", ctx).topic).toBe('situation')
    expect(first("What's happening right now?", ctx).lead).toContain('solar storm')
    expect(first('What should we do now?', ctx).topic).toBe('steps:radiation')
    expect(first('Why does this happen?', ctx).topic).toBe('hazard:Space radiation')
    // "why?" after the steps explains the hazard behind them.
    expect(first('why?', { ...ctx, last: { topic: 'steps:radiation' } }).topic).toBe('hazard:Space radiation')
    expect(first('What should we do now?', ctxFor('normal')).topic).toBe('routine')
  })

  it('gives the steps for any situation by its symptoms', () => {
    const ctx = ctxFor('normal')
    expect(topics('What do I do in a solar storm?', ctx)).toContain('steps:radiation')
    expect(first('what are the steps if someone collapses?', ctx).topic).toBe('emergency:collapse')
    expect(first('can the commander fly the lander', ctxFor('gravity', 'moon')).topic).toBe('steps:gravity')
  })
})

describe('Ask: knowledge from NASA and CSA', () => {
  it("explains NASA's hazards, risks and research, with links to NASA", () => {
    const ctx = ctxFor('normal')
    const hazards = first("What are NASA's five space hazards?", ctx)
    expect(hazards.topic).toBe('hazards')
    expect(hazards.sources[0].url).toBe('https://www.nasa.gov/hrp/hazards/')
    expect(first('what is space radiation', ctx).topic).toBe('hazard:Space radiation')
    expect(first('what are nasa risks', ctx).topic).toBe('risks')
    expect(first('what is SANS', ctx).topic).toBe('fact:sans')
    expect(first('what is a conjunction', ctx).topic).toBe('fact:conjunction')
    expect(first('tell me about the canadian space agency', ctx).topic).toBe('fact:neutron')
    expect(first('Why do astronauts get dizzy after landing?', ctx).topic).toBe('fact:orthostatic')
    expect(first('my head hurts', ctx).topic).toBe('fact:headache')
  })

  it('copes with spelling mistakes', () => {
    const ctx = ctxFor('normal')
    expect(first('what is space radation', ctx).topic).toBe('hazard:Space radiation')
    expect(first('what is hematocrite', ctx).topic).toBe('signal:C2:hematocrit')
    expect(first('how is alizade', ctx).topic).toBe('person:C3')
  })

  it('answers about the app and Contact home, including the blackout', () => {
    expect(first('How long until Earth answers?', ctxFor('normal')).lead).toContain('17 minutes')
    expect(first('how do i send a message to earth', ctxFor('distance')).lead).toContain('no contact with Earth')
    expect(first('what pages are there', ctxFor('normal')).lead).toContain('Live monitor, Contact home, Ask and Flight surgeon')
    expect(first('who can see my data', ctxFor('normal')).lead).toContain('whole crew')
  })

  it('says what SOMA stands for', () => {
    expect(first('what does SOMA stand for?', ctxFor('normal')).lead).toBe('SOMA stands for Spaceflight Organ Monitoring Application.')
    expect(first('how does ask work offline', ctxFor('normal')).topic).toBe('app:about')
  })

  it('explains how to plan a 90-minute blackout with the flight surgeon', () => {
    for (const q of ['what do we do during a blackout', 'how do we pre-plan with the flight surgeon', 'what happens during loss of signal']) {
      const a = first(q, ctxFor('normal'))
      expect(a.topic).toBe('app:blackout')
      expect(a.lead).toContain('90 minutes')
    }
    expect(first('what is solar conjunction', ctxFor('normal')).topic).toBe('fact:conjunction')
  })
})

describe('Ask: honest and plain', () => {
  it('says so when it does not know, and suggests close topics', () => {
    const a = first('what is the capital of france', ctxFor('normal'))
    expect(a.topic).toBe('unknown')
    const mars = first('what is the weather on mars', ctxFor('normal'))
    expect(mars.topic).toBe('unknown')
    expect(mars.lines[0]).toContain('Did you mean')
  })

  it('never shows "demo wording" or demo labels, and only links real sources', () => {
    const questions = ['What are the steps if someone collapses?', 'Possible clot in a neck vein steps', 'why does this happen?', 'how is rivera', 'what should we do now?', 'is my sleep ok']
    for (const scenario of ['normal', 'flagged', 'emergency', 'radiation', 'isolation', 'distance', 'gravity', 'co2'] as const) {
      const ctx = ctxFor(scenario, scenario === 'gravity' ? 'moon' : 'mars')
      for (const q of questions) {
        for (const a of ask(q, ctx)) {
          const text = [a.lead, ...a.lines, ...a.sources.map((s) => s.label)].join(' ')
          expect(text, `${scenario}: ${q}`).not.toMatch(/demo wording|\(demo\)|demo parameter/i)
          for (const s of a.sources) expect(s.url ?? '', s.label).toMatch(/^https:\/\//)
        }
      }
    }
  })

  it('greets, thanks and suggests questions that fit the situation', () => {
    expect(first('hi', ctxFor('normal')).topic).toBe('greet')
    expect(first('thanks!', ctxFor('normal')).topic).toBe('thanks')
    expect(suggestions(ctxFor('gravity', 'moon'))).toContain('How is Tulsi Gandhi?')
    expect(suggestions(ctxFor('normal'))[0]).toBe('How is the crew?')
  })
})
