// Plain-language guide for each signal: what it is, why it matters in space, how it is taken.
// The challenge asks us not to assume astronauts know how to assess their health.
// "hazard" is one of NASA's five hazards of human spaceflight.

export type Hazard = 'Space radiation' | 'Isolation and confinement' | 'Distance from Earth' | 'Gravity changes' | 'Closed environment'

export interface Guide {
  hazard: Hazard
  what: string
  how: string
}

export const GUIDE: Record<string, Guide> = {
  hematocrit: {
    hazard: 'Gravity changes',
    what: 'The share of your blood made up of red cells. In weightlessness fluid moves toward the head and the body sheds plasma, so this share goes up.',
    how: 'A finger-prick or small blood sample in the onboard blood analyser.',
  },
  onsd: {
    hazard: 'Gravity changes',
    what: 'The width of the sleeve around the nerve behind your eye. Fluid moving toward the head can change the eye and vision on long flights. NASA reports that about 70 percent of station astronauts get some swelling at the back of the eye.',
    how: 'An ultrasound probe held gently on the closed eyelid, with gel. A crewmate can help.',
  },
  ijv: {
    hazard: 'Gravity changes',
    what: 'How blood drains from the head through the large vein in the neck. Without gravity pulling blood down, flow can slow or stall.',
    how: 'An ultrasound probe on the left side of the neck.',
  },
  headache: {
    hazard: 'Closed environment',
    what: 'A headache you report yourself. In a sealed cabin, carbon dioxide from breathing can build up and cause it.',
    how: 'Tick it in your daily check-in, or write it in "How do you feel?".',
  },
  sleep: {
    hazard: 'Isolation and confinement',
    what: 'Your average sleep over the last week. Noise, workload and the lack of a normal day and night make sleep harder in space. The station sees 16 sunrises and sunsets a day.',
    how: 'Measured by the wearable sensor. Nothing to do.',
  },
  vitals: {
    hazard: 'Gravity changes',
    what: 'Oxygen level in your blood and your resting heart rate.',
    how: 'Measured by the wearable sensor. Nothing to do.',
  },
  urine: {
    hazard: 'Gravity changes',
    what: 'How much urine you pass in a day. Bones lose calcium in weightlessness, and it leaves through the urine, where it can form kidney stones if the urine is concentrated.',
    how: 'Log the volume from the collection device once a day.',
  },
  exercise: {
    hazard: 'Gravity changes',
    what: 'How often you do resistance exercise. Bones and muscles weaken when they carry no load.',
    how: 'Counted by the exercise device. Nothing to do.',
  },
  mood: {
    hazard: 'Isolation and confinement',
    what: 'How you rate your own mood, averaged over the last week. Months in a small space far from home wear on anyone.',
    how: 'Rate your mood from 1 (very low) to 5 (very good) in the check-in. NASA also suggests keeping a journal, which is what the "How do you feel?" note is for.',
  },
  basics: {
    hazard: 'Distance from Earth',
    what: 'Blood pressure, body temperature and blood sugar: the basic checks a doctor would do first. With no doctor nearby, you do them yourself.',
    how: 'Arm cuff for blood pressure, thermometer for temperature, finger-prick meter for blood sugar.',
  },
  immune: {
    hazard: 'Space radiation',
    what: 'The count of white blood cells, the cells that fight infection, and of lymphocytes, one important type. Radiation, stress, poor sleep and diet can all change the immune system in flight, so crews have reported more rashes and reactivated viruses.',
    how: 'Taken from the same finger-prick or small blood sample as the hematocrit, in the onboard blood analyser.',
  },
  vitd: {
    hazard: 'Closed environment',
    what: 'The level of vitamin D in your blood. Your skin makes it from sunlight, which you do not get in a sealed cabin, so food and supplements are the only source. Bones need it to absorb calcium.',
    how: 'A blood sample. On the ISS these samples go back to Earth for analysis, so the result comes late.',
  },
  bodymass: {
    hazard: 'Distance from Earth',
    what: 'Your body mass compared with before the flight. Food is limited to what was packed, and falling body mass is an early sign of eating too little.',
    how: 'Weigh yourself on the onboard mass device once a week.',
  },
  co2: {
    hazard: 'Closed environment',
    what: 'Carbon dioxide in the cabin air. Everyone breathes it out and machines must remove it.',
    how: 'Measured by the cabin sensors. Nothing to do.',
  },
  doserate: {
    hazard: 'Space radiation',
    what: 'How fast radiation is arriving right now. A solar storm can raise it many times within minutes to hours. Crews take shelter when it passes a set level.',
    how: 'Measured by the cabin radiation monitors and the dosimeter each crew member wears. Nothing to do. On the station, Canadian bubble detectors measured the neutron part, about 30% of the dose.',
  },
  balance: {
    hazard: 'Gravity changes',
    what: 'Feeling dizzy, lightheaded or unsteady. After time in weightlessness, blood pools in the legs when you stand in gravity, and the inner ear has to relearn which way is down.',
    how: 'Tell the medical officer, or write it in "How do you feel?" in the check-in. Heart rate and blood pressure, lying and then standing, show how strong it is.',
  },
  pain: {
    hazard: 'Gravity changes',
    what: 'Sharp pain in the side or back. With little urine it can mean a kidney stone: bones lose calcium in weightlessness and it leaves through the urine.',
    how: 'Tell the medical officer. Note when it started, where it hurts and how strong it is from 0 to 10.',
  },
  radiation: {
    hazard: 'Space radiation',
    what: 'The radiation dose you have received since launch. Outside Earth\'s magnetic shield the dose is much higher. On the station, neutrons make up about 30% of it.',
    how: 'Measured by the cabin dosimeter. Nothing to do.',
  },
}

/**
 * The official NASA Human Research Program risk each signal belongs to, from
 * https://www.nasa.gov/hrp/risks/ (a required resource for the challenge).
 * Kidney stones are not on that list, so the urine signal has no entry.
 */
export const NASA_RISK: Record<string, { name: string; url: string }> = {
  onsd: { name: 'Spaceflight Associated Neuro-ocular Syndrome (SANS)', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/' },
  ijv: { name: 'Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  hematocrit: { name: 'Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  vitals: { name: 'Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  basics: { name: 'Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  exercise: { name: 'Spaceflight-Induced Bone Changes', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
  vitd: { name: 'Inadequate Food and Nutrition', url: 'https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition/' },
  bodymass: { name: 'Inadequate Food and Nutrition', url: 'https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition/' },
  immune: { name: 'Altered Immune System Responses', url: 'https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/' },
  sleep: { name: 'Inadequate Sleep and Irregular Schedules', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  mood: { name: 'Behavioral Changes and Psychiatric Disorders', url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  radiation: { name: 'Radiation-Induced Cancers', url: 'https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/' },
  doserate: { name: 'Radiation-Induced Cancers', url: 'https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/' },
  balance: { name: 'Altered Sensorimotor and Vestibular Function', url: 'https://www.nasa.gov/reference/risk-of-altered-sensorimotor-and-vestibular-function/' },
}

/** A current NASA study on the same question, from https://www.nasa.gov/hrp/ongoing-hrp-research/. */
export const NASA_STUDY: Record<string, { name: string; about: string; url: string }> = {
  ijv: { name: 'Venous Haemostasis', about: 'blood flow and clotting changes in space', url: 'https://www.nasa.gov/reference/venous-haemostasis/' },
  onsd: { name: 'Thigh Cuff', about: 'whether tight thigh cuffs keep fluid in the legs and protect the eyes', url: 'https://www.nasa.gov/reference/thigh-cuff/' },
  sleep: { name: 'ARCHeR', about: 'a wrist device tracking activity, sleep and light on Artemis II', url: 'https://www.nasa.gov/reference/archer/' },
  immune: { name: 'Immune Biomarkers', about: 'blood and saliva samples to see how deep space changes immunity', url: 'https://www.nasa.gov/reference/immune-biomarkers/' },
  exercise: { name: 'Zero T2', about: 'how exercising without a treadmill affects health', url: 'https://www.nasa.gov/reference/zero-t2/' },
  balance: { name: 'Simulating Manual Piloting for Moon Landings', about: 'how gravity changes affect piloting and balance after landing', url: 'https://www.nasa.gov/reference/simulating-manual-piloting-for-moon-landings/' },
  mood: { name: 'ARCHeR', about: 'tracking well-being, activity and sleep on Artemis II', url: 'https://www.nasa.gov/reference/archer/' },
}

/** Work by partner space agencies on the same question (shown under "About this measurement"). */
export const PARTNER_WORK: Record<string, { agency: string; name: string; about: string; url: string }> = {
  doserate: {
    agency: 'Canadian Space Agency',
    name: 'Monitoring radiation for astronaut health',
    about: 'CANS, a compact neutron spectrometer that measures on its own, after bubble detectors on the ISS',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  radiation: {
    agency: 'Canadian Space Agency',
    name: 'Monitoring radiation for astronaut health',
    about: 'neutrons are about 30% of the dose on the ISS',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
}

/** NASA's page for each of the five hazards, from https://www.nasa.gov/hrp/hazards/, with one line in plain words. */
export const HAZARD_INFO: Record<Hazard, { nasaName: string; url: string; line: string }> = {
  'Space radiation': {
    nasaName: 'Space radiation',
    url: 'https://www.nasa.gov/hrp/hazard-space-radiation/',
    line: "Outside Earth's magnetic field, radiation from the Sun and from deep space reaches the crew. NASA counts it among the most dangerous parts of spaceflight.",
  },
  'Isolation and confinement': {
    nasaName: 'Isolation and confinement',
    url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/',
    line: 'A small crew lives in a small space, far from home, for months. Sleep loss, a shifted body clock and overwork can wear down health and performance.',
  },
  'Distance from Earth': {
    nasaName: 'Distance from Earth',
    url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/',
    line: 'The farther the crew travels, the harder it is to get instructions, supplies and medical help from Earth. Messages to Mars take up to 20 minutes each way, so the crew must be self-sufficient.',
  },
  'Gravity changes': {
    nasaName: 'Gravity fields',
    url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/',
    line: 'The body adapts to weightlessness, then has to readapt to the Moon, Mars or Earth. Moving into gravity can cause lightheadedness, fainting and balance problems.',
  },
  'Closed environment': {
    nasaName: 'Hostile and closed environments',
    url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/',
    line: 'The spacecraft is both home and machine. Its air, temperature, noise and microbes have to be kept safe for the crew living inside it.',
  },
}
