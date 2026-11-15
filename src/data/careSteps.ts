// Steps to fix the problem in each live scenario (shown under Crew health).
// A step with a source comes from that published source. A step without one is "demo wording":
// our own wording for the prototype, not medical guidance.

import type { ScenarioId } from '../live.ts'
import { CLOT_CASE } from './emergency.ts'
import { SOURCES } from './sources.ts'

export interface StepSource {
  label: string
  url: string
}

export interface CareStep {
  id: string
  title: string
  detail: string
  source?: StepSource | StepSource[]
  /** A button that does something: give the pill, send to Earth, open the check-in form. */
  action?: 'pill' | 'alert' | 'checkin'
  /** Ticks itself: fever gone, alert delivered to Earth, answer received, or the problem's signals back to normal. */
  auto?: 'fever' | 'delivered' | 'reply' | 'clear'
  /** Shown under a "Mark done" step once it is done. */
  doneNote?: string
}

/** A source from sources.ts, as a link. */
const src = (id: string): StepSource => ({ label: SOURCES[id].title, url: SOURCES[id].url ?? '' })

const MEDS_ISS = {
  label: 'Medication use on the ISS (Wotring, FASEB J 2015, NASA report)',
  url: 'https://ntrs.nasa.gov/api/citations/20140017010/downloads/20140017010.pdf',
}

export const CARE_STEPS: Record<ScenarioId, CareStep[]> = {
  normal: [],
  flagged: [
    { id: 'recheck', title: 'Check the temperature again after 10 minutes of rest', detail: 'Make sure it is a real fever and not a reading taken right after exercise. This app counts 38 C or more as a fever (demo limit).' },
    {
      id: 'pill',
      title: 'Give a fever and pain reliever from the medical kit',
      detail: 'For example acetaminophen (paracetamol), at the dose on the kit label. The medical officer checks allergies and other medicines first. Pain relievers are among the medicines ISS crews use most.',
      source: MEDS_ISS,
      action: 'pill',
    },
    { id: 'fluids', title: 'Water and rest', detail: 'Drink water through the day and rest for about an hour. No exercise today.' },
    { id: 'fever', title: 'Check that the fever comes down', detail: 'The temperature should be normal within about an hour (about a minute in this demo). This step ticks itself below 37.5 C.', auto: 'fever' },
    { id: 'log', title: 'Log a check-in', detail: "So the medical officer sees today's values. Tell the flight surgeon at the next contact if the fever comes back or gets worse.", action: 'checkin' },
  ],
  emergency: [
    { id: 'rest', title: 'Stop exercise and keep him resting', detail: 'No hard exercise and no spacewalk preparation until the flight surgeon answers.' },
    { id: 'scan', title: 'Repeat the neck ultrasound', detail: 'Scan both sides of the neck. Save still images and a short clip of the vein.' },
    { id: 'symptoms', title: 'Check for symptoms', detail: 'Ask about neck or face swelling, headache and pain. Write down what you find.' },
    { id: 'alert', title: 'Alert the flight surgeon', detail: 'Sends the finding, the live vitals and the steps done so far to Earth through Contact home.', action: 'alert' },
    { id: 'ground', title: 'Ground control is told', detail: 'Ticks itself when the alert reaches Earth. The flight surgeon briefs mission control.', auto: 'delivered' },
    { id: 'second', title: 'Get a second opinion', detail: "Earth's medical team reviews the alert with a specialist and answers. Ticks itself when the answer arrives.", auto: 'reply' },
    { id: 'nomeds', title: 'Do not start medicine on your own', detail: 'In the one known case, doctors on Earth chose the treatment and adjusted it over weeks. Wait for their plan.', source: CLOT_CASE },
  ],

  // --- NASA space hazards ---
  radiation: [
    {
      id: 'shelter',
      title: 'Everyone into the storm shelter',
      detail: 'Pull the stowage bags out of the storage bays and strap them along the least shielded wall, then stay inside the shelter. On Artemis I the best-shielded spot got about a quarter of the dose of the least shielded one.',
      source: [src('ARTEMIS_SHELTER'), src('ARTEMIS1_SHELTER')],
      doneNote: 'Crew in the shelter. Their dose rate is now about a quarter of the open cabin.',
    },
    { id: 'inside', title: 'No spacewalks, stay away from thin walls', detail: 'Stop or postpone any work outside. Stay in the shelter area, away from windows and lightly shielded modules.' },
    {
      id: 'dosimeter',
      title: 'Check your dosimeter',
      detail: "Each crew member wears a personal dosimeter that alarms when radiation rises. Write down everyone's reading so Earth can work out each dose. Canadian instruments measure the neutron part, about 30% of the dose on the station.",
      source: [src('ARTEMIS_SHELTER'), src('CSA_RADIATION')],
    },
    {
      id: 'alert',
      title: "Tell Earth's radiation team",
      detail: "Sends the dose rate, who is in the shelter and the steps done so far. NASA's Space Radiation Analysis Group watches the Sun around the clock and advises the crew.",
      source: src('SRAG'),
      action: 'alert',
    },
    { id: 'second', title: 'Earth answers', detail: 'The radiation team says how long the storm should last and when it is safe to come out. Ticks itself when the answer arrives.', auto: 'reply' },
    {
      id: 'clear',
      title: 'Stay in the shelter until the all-clear',
      detail: 'Come out when the dose rate is back under the caution level. In this demo the storm passes about a minute after you take shelter; real storms can last hours to days.',
      auto: 'clear',
    },
  ],
  isolation: [
    { id: 'talk', title: 'Check in with A. Rivera in private', detail: 'The medical officer, or a crewmate he trusts, asks how he is doing somewhere private. Listen first.' },
    {
      id: 'alert',
      title: 'Book a private call with Earth',
      detail: "Asks for a private session with Earth's behavioral health team and a call with his family. Crews can talk with family and medical professionals for support. On the way to Mars the delay turns calls into recorded messages.",
      source: src('BEHAVIOR_RISK'),
      action: 'alert',
    },
    { id: 'second', title: 'Earth confirms the call', detail: 'Ticks itself when the answer arrives.', auto: 'reply' },
    {
      id: 'light',
      title: 'Reset his sleep rhythm with light and a fixed schedule',
      detail: 'Bright blue-white light after waking, dim warm light in the hour before bed, the same sleep time every night and set time off each day. NASA uses light to align the body clock, and station LEDs copy Earth\'s day and night.',
      source: [src('HRP_ISOLATION'), src('SLEEP_RISK')],
    },
    {
      id: 'journal',
      title: 'Keep a journal',
      detail: 'A few lines a day in "How do you feel?" in the check-in. NASA encourages a regular journal, and behavioral scientists use journals to follow mood in isolation.',
      source: [src('BEHAVIOR_RISK'), src('HRP_ISOLATION')],
    },
    { id: 'home', title: 'Make time for something that feels like home', detail: 'Time at the window, tending the plants, music or a film with the crew. Windows and growing plants help against monotony and the feeling of being shut in.', source: src('BEHAVIOR_RISK') },
    {
      id: 'log',
      title: 'Log a check-in now, and again next week',
      detail: "Mood and sleep are 7-day averages, so they change over days, not minutes. If his mood keeps falling, or you are worried about his safety, contact Earth's medical team at once.",
      action: 'checkin',
    },
  ],
  distance: [
    {
      id: 'lead',
      title: 'The medical officer takes the lead',
      detail: 'Earth cannot help for about two weeks, so the crew decides. Use these steps and the Ask tab: both work without Earth. NASA pauses commands to its Mars spacecraft for the same reason every two years.',
      source: [src('MARS_CONJUNCTION'), src('HRP_DISTANCE')],
    },
    { id: 'danger', title: 'Check for danger signs', detail: 'Fever or chills, vomiting, or no urine at all can mean the kidney is blocked or infected. If any of these appear, open Emergency mode.' },
    {
      id: 'pill',
      title: 'Give a pain reliever from the medical kit',
      detail: 'At the dose on the kit label. The medical officer checks allergies and other medicines first. Pain relievers are among the medicines ISS crews use most.',
      source: MEDS_ISS,
      action: 'pill',
    },
    { id: 'fluids', title: 'Drink water through the day', detail: 'Aim for at least 2 litres of urine a day, the NASA target that keeps stone-forming salts diluted. Log the volume.', source: src('URINE_TARGET') },
    { id: 'scan', title: 'Scan the kidneys with the ultrasound', detail: 'Image both kidneys and save the pictures, so Earth can review them when contact returns.' },
    {
      id: 'report',
      title: 'Write the report for Earth',
      detail: 'What happened, what you gave and when. It waits on board and goes out when contact returns, with everything else that is pending.',
      source: src('MARS_CONJUNCTION'),
      doneNote: 'Saved on board. It goes out when contact returns.',
    },
    { id: 'log', title: 'Log a check-in', detail: 'So the pain, urine and vitals are on record for the report.', action: 'checkin' },
  ],
  gravity: [
    {
      id: 'liedown',
      title: 'Sit or lie down right away',
      detail: 'Lie down with the legs raised until the dizziness passes, and do not stand up alone. In this demo it passes about a minute after lying down; in real life it can take hours or days.',
      doneNote: 'Lying down. Heart rate and blood pressure should settle.',
    },
    { id: 'fluids', title: 'Drink water with salt', detail: 'Water with salt helps refill blood volume. Fluid loading before landing is one of NASA\'s countermeasures for this.', source: [src('ORTHO_COUNTER'), src('ORTHO_NASA')] },
    { id: 'garment', title: 'Put on the compression garment', detail: 'It keeps blood from pooling in the legs. NASA crews wear one during landing and for up to several days after.', source: src('ORTHO_COUNTER') },
    { id: 'move', title: 'Move slowly, with a crewmate close by', detail: 'Stand up in stages, avoid quick head turns, and have someone walk beside her for the first hours. Gravity changes affect balance, orientation and coordination.', source: [src('HRP_GRAVITY'), src('SENSORIMOTOR')] },
    { id: 'nopilot', title: 'No piloting, driving or moonwalk today', detail: 'The commander hands over flying and rover driving until the dizziness is gone. NASA is studying how gravity changes affect piloting after landing.', source: src('PILOTING') },
    { id: 'clear', title: 'Check that heart rate and blood pressure come back', detail: 'Ticks itself when both are back to normal and the dizziness has passed.', auto: 'clear' },
    { id: 'log', title: 'Log a check-in', detail: 'Record the values lying down and standing for the flight surgeon.', action: 'checkin' },
  ],
  co2: [
    {
      id: 'scrubber',
      title: 'Switch on the backup CO2 removal',
      detail: 'On the station, the backups to the main scrubber are a second system and lithium hydroxide canisters. A failing scrubber lets CO2 rise over days.',
      source: src('CO2_LIMIT'),
      doneNote: 'Backup on. CO2 should start to fall.',
    },
    {
      id: 'alert',
      title: 'Tell flight controllers',
      detail: 'Sends the CO2 level, how many have symptoms and what you did. Flight controllers repair failing scrubbers or start backup units.',
      source: src('CO2_LIMIT'),
      action: 'alert',
    },
    { id: 'second', title: 'Earth sends the repair plan', detail: 'Ticks itself when the answer arrives.', auto: 'reply' },
    { id: 'exercise', title: 'Pause hard exercise', detail: 'Hard exercise makes a person breathe out several times more CO2. Wait until CO2 is back under the limit.', source: src('CO2_LIMIT') },
    { id: 'fans', title: 'Keep air moving, most of all where crew sleep', detail: 'Run the fans and keep vents clear. Without airflow, CO2 collects in pockets around a sleeping person.', source: src('CO2_LIMIT') },
    { id: 'symptoms', title: 'Ask everyone about headaches and tiredness', detail: 'Headaches, tiredness and poor sleep get worse as CO2 rises. Two crew members have headaches now.', source: src('CO2_LIMIT') },
    { id: 'clear', title: 'Watch CO2 come back under the limit', detail: "Ticks itself below 3 mmHg, NASA's limit for the daily average. In this demo it takes about a minute after the backup is on.", source: src('CO2_LIMIT'), auto: 'clear' },
  ],
}

/** The label on the button that sends to Earth, per scenario. */
export const ALERT_BUTTON: Partial<Record<ScenarioId, string>> = {
  emergency: 'Send alert to Earth',
  radiation: 'Tell Earth',
  isolation: 'Ask for the call',
  co2: 'Tell Earth',
}

/** Why the problem happens: the NASA hazard behind a hazard scenario, and where to read more (ids in sources.ts). */
export const SCENARIO_CONTEXT: Partial<Record<ScenarioId, string[]>> = {
  radiation: ['HRP_RADIATION', 'CSA_RADIATION', 'ARTEMIS_SHELTER', 'SRAG'],
  isolation: ['HRP_ISOLATION', 'BEHAVIOR_RISK', 'SLEEP_RISK', 'ARCHER'],
  distance: ['HRP_DISTANCE', 'CSA_WHY', 'MARS_CONJUNCTION'],
  gravity: ['HRP_GRAVITY', 'SENSORIMOTOR', 'ORTHO_NASA', 'PILOTING'],
  co2: ['HRP_CLOSED', 'CO2_LIMIT'],
}

/** Routine reminders shown when nothing needs fixing. They match the space rules. */
export const ROUTINE = ['A check-in for each crew member every day.', 'Five or more resistance exercise sessions a week.', 'At least 2 litres of urine a day: drink through the day.']

/** How long Earth's team takes to answer in the demo, on top of the signal delay both ways. */
export const REVIEW_MS = 8000

/** The answer shown when no real reply has come back from the flight surgeon tab. */
export const SIMULATED_REPLY: Partial<Record<ScenarioId, string>> = {
  emergency:
    'The flight surgeon and a vascular specialist reviewed the alert. They agree it looks like a clot in the left neck vein. Keep A. Rivera resting, send the saved ultrasound images, and do not start any medicine until the flight surgeon sends the treatment plan.',
  radiation:
    'Space radiation team: the solar storm is past its peak. Stay in the shelter until the dose rate is under the caution level, keep your dosimeters on, and no spacewalks for the next day. We will send the all-clear.',
  isolation:
    'Behavioral health team: a private session for A. Rivera is booked for the next communication window, and a family call the day after. Keep the light and sleep plan going and keep the journal.',
  co2: 'Flight controllers: keep the backup CO2 removal running. A repair procedure for the main scrubber is on its way. Keep the fans on in the crew quarters and pause hard exercise until CO2 is under 3 mmHg.',
}
export const SIMULATED_SECOND_OPINION = SIMULATED_REPLY.emergency ?? ''
