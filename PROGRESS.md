# Progress

## Session 1 (2026-11-10)

### Done
- Research pass on every claim in brief section 7. Results in `RESEARCH_LOG.md`.
- Real NASA data downloaded: `data/osdr/OSD-569_CBC_TRANSFORMED.csv` (Inspiration4 blood counts, pre/post flight).
- App scaffold: Vite + React + TypeScript + Tailwind. `npm run dev`, `npm test`.
- `src/data/sources.ts`: one entry per threshold, each marked verified / partial / demo.
- `src/triage.ts`: Earth rules and space rules as pure functions. 14 unit tests pass.
- `src/data/simulatedCrew.ts`: replaces the old TS file. Old file and the Gemini notes are in `legacy/` (not used by the app).
- Screen 1 (dashboard): crew + cabin cards, mission-day slider, simulated badge, Earth/Space toggle, traffic lights, findings with reason, next step and source, disclaimer.

### Changes from the brief (and why)
- Added a **Cabin** card. CO2 and radiation belong to the cabin, not one person.
- Headline now counts **false alarms and missed concerns**. Earth rules also *miss* things (CO2 headaches), which is a stronger story than "Earth rules panic".
- Neck-vein stagnant flow stays amber in space mode. It is common in flight but 1 of 11 crew got a clot, so calling it "normal" would be wrong.
- Removed the drug list, all dosing text, IJV velocity trigger, ONSD 5.8/6.2 cut-offs, plasma-volume and bone-marker fields. None had a source.
- Radiation is tracked in mSv only (1.8 mSv/day, Curiosity cruise measurement). The old Gy/Sv mix is gone.
- Recharts not installed yet. Nothing on screen 1 needs a chart.

## Session 2 (2026-11-10)

### Done
- Full redesign of the dashboard (design mockup: https://claude.ai/artifact/EkFJhPvHUjkpnKuadr1fvE).
- Every signal now shows the Earth verdict and the space verdict side by side, a 30-day trend, and an expandable reason / next step / source.
- Mission timeline: flagged signals per day under both rule sets.
- `src/model.ts`: data layer. Crew check-ins are saved in the browser and re-checked by both rule sets.
- "Log a check-in" form, "Copy report for Earth" button.
- Emergency mode (`src/Emergency.tsx`): 7 steps, Space to advance, timer. Steps tagged "from guideline" or "demo only".

### Decisions made for the team (no specialist needed)
The earlier open questions are closed this way: any number we could not confirm in a paper is shown in the app as
"Demo parameter" or "exact number still to be re-checked". Nothing unconfirmed is presented as fact. If a mentor
or judge with a medical background offers a better number, change it in `THRESHOLDS` in `src/triage.ts`.

## Session 3 (2026-11-10)

### Done
- **Backend** (`server/index.ts`): API + SQLite database file (`data/crew-health.sqlite`). Stores check-ins, validates them,
  re-checks with both rule sets, keeps an activity log, serves a text report. Uses only what ships with Node 24, and imports
  the same `src/triage.ts` the screens use, so there is one copy of the rules. If the server is down the app saves on the device.
- **3D body view** (`src/BodyScan.tsx`, `src/body/sdf.ts`): male and female body built from 24,000 points, drag to turn.
  The region of each flagged signal glows amber or red (eyes, head, neck vein, heart and lungs, blood). Markers open the signal.
  It is a body-shaped guide, not an anatomical model with organs.
- **Redesign**: neutral interface where colour appears only when something needs attention. Own logo mark, Geist type,
  Phosphor icons, press feedback on every button, animated numbers, sliding selection, expanding rows, toast after saving,
  step transitions in Emergency. All motion switches off for people who ask for reduced motion.
- Cabin view: ring gauges for CO2 and radiation dose.

- **Real organs** (`public/anatomy/`, `src/body/anatomy.ts`): 16 organ meshes and the skin from BodyParts3D
  ((c) The Database Center for Life Science, CC BY 4.0, credit shown on screen). One adult male. Male crew use the real
  skin and organs. Female crew keep the generated body with the same organs fitted inside (approximate, labelled).
  The left neck vein is the right one mirrored, because the dataset has no left one. No spleen in the dataset.

- **Session 4:** body is now a smooth surface, no dots. Female crew use a real female body and organs (HRA 3D Reference
  Organs, Visible Human female, HuBMAP, CC BY 4.0); male crew use BodyParts3D. Credits show under the body. The female set
  has no neck vein mesh, so that marker sits on the neck without an organ. Body panel no longer moves when a signal opens.
  Database status label removed.
- **Known gaps before this is more than a demo** (see chat of 2026-11-10): no sign-in or roles, no device data feed,
  no label saying where each reading came from, no daily task view, emergency covers one scenario only.

## Session 5 (2026-11-11)

### Done
- **Sign-in and roles**, enforced on the server (`server/index.ts`, `src/data/users.ts`): crew see their own data, the medical
  officer sees everyone, the flight surgeon sees only what was sent to Earth. Demo accounts share PIN 2026.
- **Simulated device feed** (`src/model.ts`, `FEEDS`): wearable values arrive daily, ultrasound every 14 days, blood every 30.
  Every signal shows its source and age, and warns when it is getting old. The check-in form is now the manual fallback.
- **Today tab**: tasks worked out from the feed and the space rules, a free-text "how do you feel" note, messages from Earth,
  and a crew overview for the medical officer.
- **Earth link tab**: messages and health reports travel with the signal delay for the mission day (played 60x faster),
  with a countdown. Sign in as the flight surgeon in a second browser tab to answer from Earth.
- **Emergency**: three scenarios, a patient picker, a "sensors point here" hint, timed steps, and a saved record that is
  sent to Earth automatically.
- Layout: the three Crew health columns share one fixed height and scroll inside, so the body no longer slides over the timeline.
- Male body surface rebuilt with smooth shading (no speckle).

### Still not real
No real devices, no real identity system, no encryption, schedules and stale limits are demo values, emergency steps
marked "demo only" are our wording. The database keeps test messages from development; delete `data/crew-health.sqlite` to reset.

### How to run
`npm run dev` starts the API (port 8787) and the web app (port 5173) together. `npm test` runs the rule tests.

### Next
1. Paste the challenge page text into `CHALLENGE.md` and check scope against it.
2. Optional: find a licensed female anatomical model.
3. Deploy a demo link and rehearse the 3-minute demo.

## Session 6 (2026-11-11)
- Body view: wheel and pinch zoom, zoom buttons, Head / Chest / Body presets, system layers (heart and blood; brain, eyes, spine; organs). Opening a signal moves the camera to it.
- Spinal cord added for the female body and the spine for the male body. Neither free dataset has the small peripheral nerves.
- Signals panel: flagged signals first with a "Do this next" box and action buttons; normal signals compact.
- Earth link: fixed-height thread, long reports collapsed to a summary.
- Not taken from the outside suggestion list, because no source exists: kidney-stone and bone-loss numbers, shock index, jugular velocity cut-off, Muller maneuver.

## Session 7 (2026-11-11)
- Blood vessel trees on both bodies (male to wrists and ankles, female trunk only). No peripheral nerves exist in either free dataset.
- Two new signals with sources: urine output (kidney stone risk) and resistance exercise (bone loss). 16 rule tests.
- Ask tab: offline assistant with no AI model, answers only from readings, rules and emergency steps (`src/handbook.ts`).
- Browser fallback backend (`src/localBackend.ts`) so the app runs with no server.
- README rewritten with screenshots in `docs/`.
- Deployed: https://crew-health-monitor.vercel.app (static, uses the browser fallback).

## Session 8 (2026-11-11)
- Challenge page finally read. Scope check is in CHALLENGE.md.
- Added the indicators the challenge names: mood, blood pressure, temperature, blood sugar (ordinary Earth limits, labelled demo parameters). 18 rule tests.
- Each signal now explains the measurement and names its NASA hazard (`src/data/signalGuide.ts`).
- Demo link shows a banner saying it has no server. Sign-in screen states that everything is simulated.
- First load split: 3D view loads only when Crew health opens (main file 485 kB, was about 1 MB).
- 3D performance fixes, optional Gemini rewording (`api/reword.js`, off without a key).
- DEMO_SCRIPT.md added.

## Session 9 (2026-11-11)
- Reviewed outside feedback (Sonnet, Gemini). Applied Sonnet's patch: white cells, vitamin D and body mass signals, and image attachment on check-ins.
- Replaced guessed white cell ranges with the real lab ranges and pre-flight values from NASA OSD-569.
- Added body markers, Ask words and tests for the new signals (21 rule tests).
- Trend chart: up to three signals since launch, under the crew health screen.
- Verdict chips now say Earth or Space on each chip. Normal body markers are easier to see. Roles no longer cut off.
- 3D body shows a loading message and a failure message. Rewording endpoint is rate limited.
- Not done: mission selector (ISS / Moon / Mars), images sent to Earth.
- ADNI brain scans (Alzheimer's study) were offered as data. Not used: wrong population, and its licence does not allow republishing.

## Session 10 (2026-11-11)
- Mission setting: space station, Moon surface, Mars transit (`src/data/missions.ts`, `src/MissionMenu.tsx`). Changes the Earth link delay and the radiation rate, each with a source. 23 rule tests.
- Custom setting menu instead of the browser dropdown. Header kept to one row.

## Session 11 (2026-11-11)
- Station radiation rate now rests on three peer-reviewed measurements; the Moon rate is confirmed as the only surface measurement. Station delay sourced to NASA.
- Moon gravity: the simulation applies 60% of the weightless fluid shift (demo parameter from a partial-gravity study), and gravity-related signals carry a note on the Moon. 24 rule tests.

## Session 12 (2026-11-13)
- Read the challenge's required resources (NASA hazards, risks, ongoing research; two Canadian Space Agency pages).
- Every signal now links to its official NASA risk, and names the matching current NASA study where one exists (`NASA_RISK`, `NASA_STUDY` in `src/data/signalGuide.ts`).
- Bone loss source upgraded to NASA's own page. Four facts from the resources added to the explanations. 25 rule tests.

## Session 13 (2026-11-14)
- Sign-in has no PIN: choosing a person signs in. Server, browser fallback, tests and docs updated.
- Today tab removed (screen, notes and task routes, `tasksFor`). Crew health is the first screen after sign-in, on the signed-in person; after a check-in it shows the person the check-in was for.
- Earth-standard rule set removed: no rule-set toggle or counts, one verdict per signal, one bar per day on the mission timeline, one count per person. Earth-only sources removed. Rule tests rewritten for the space-adapted rules.
- Fixed the OSD-569 checksum failure: the repo copy had lost the file's original Windows line endings. Restored them (the file now matches the pinned SHA-256) and added `.gitattributes` so git keeps them. All 13 Python tests pass.
- The Cardiovascular panel now works on the live link: crew readings come from `src/crewVitals.ts` (shared by the server and the browser fallback) and the NASA hematocrit comparison from `public/research/hematocrit.json` (`npm run research:snapshot`).
- Added `vercel.json`. Deployed: https://space6ix-health-monitor.vercel.app (Vercel project linked to this GitHub repository; pushes to `main` deploy).

## Session 14 (2026-11-14)
- Crew health is live: a LIVE clock replaces "Day 60 / 90", the mission timeline and the day slider are gone, and vitals move every two seconds (`src/live.ts`, a pure function of the clock). Readings say "live", "today" or "this week" instead of day numbers.
- Scenario menu in the header: Normal (everyone normal), Flagged (S. Jenkins: slight fever and headache, a pill fixes it) and Emergency (A. Rivera: possible neck vein clot, flight surgeon and ground control needed). Each scenario keeps its own check-ins.
- Crew names are in a dropdown with each person's status. New Live vitals card. Trends now cover the last two minutes (`src/TrendChart.tsx`).
- Steps to fix under Crew health (`src/data/careSteps.ts`, `src/CareSteps.tsx`): the pill step makes the fever fall; the alert goes through the Earth link with the signal delay; ground control and the second opinion tick themselves; a real reply from the flight surgeon tab replaces the simulated answer.
- 51 tests pass (10 new for the scenarios).

## Session 15 (2026-11-14)
- Light design: light blue-white background, white rounded cards with soft shadows, pill-shaped navigation and buttons, black round icon badges on card titles, pastel status colours, and a white "porcelain" 3D body with a soft blue halo. The organs inside are dark slate blue and drawn over the see-through skin so they stay easy to see. Colours live in the `@theme` tokens in `src/index.css`.
- Layout, screens and features are unchanged. Live vitals and trend lines now have a soft fill under the line, and values use the regular font instead of monospace.
- Screenshots in `docs/` retaken. 51 tests and the live walkthrough pass.
- Removed from the screen (2026-11-14, Stephen's request): the demo banner under the header, the "Reading / Rule" source lines under each signal, and the NASA research hematocrit box in the Cardiovascular panel. The sources stay in `src/data/sources.ts`, the Ask answers and this README; the OSD-569 pipeline in `ml/` is unchanged.

## Session 16 (2026-11-15)
- One live scenario for each of NASA's five hazards (Stephen's request: use the challenge's NASA HRP and CSA pages to simulate situations and respond to them). The Scenario menu now has two groups: Crew health (Normal, Flagged, Emergency) and NASA's five space hazards.
  - Solar storm (space radiation): new "Radiation now" cabin signal; urgent at 20 times normal (demo). Taking shelter cuts the crew's dose rate to a quarter (Artemis I) and the storm passes; the all-clear ticks itself.
  - Isolation (isolation and confinement): A. Rivera's mood and sleep low all week; steps for a private call, light and sleep schedule, journal.
  - Earth out of reach (distance from Earth): Mars solar conjunction, no contact for about two weeks; the Earth link and reports are paused. S. Jenkins has side pain and low urine; the pain reliever eases the pain.
  - Landing day (gravity fields): the setting switches to the Moon; E. Vance is dizzy with a fast pulse and low blood pressure until she lies down.
  - Cabin CO2 (hostile and closed environments): failing scrubber, CO2 climbs past 3 mmHg, two crew with headaches; the backup brings it down.
- New signals: Radiation now (cabin), Dizziness and balance, Side pain. The last two only show when reported.
- Each hazard scenario has a "Why this happens" box and a banner link to NASA's hazard page. New sources in `src/data/sources.ts` (HRP hazard and risk pages, CSA, Artemis II and I shelter, SRAG, Mars conjunction, orthostatic intolerance, piloting study).
- The header now stays above the page at every screen width, so its menus are never hidden behind the content.
- 60 tests pass (16 new); every scenario checked in the browser, including the privacy view for other crew members.

## Session 17 (2026-11-15)
- Pages renamed (Stephen's request): Crew health → **Live monitor**, Earth link → **Contact home**, Flight surgeon drill → **Flight surgeon**. Every text that points to them follows.
- "Simulated" labels removed from the screens: the SIMULATED DATA badge in the header, "Simulated" under live vitals and in the Cardiovascular panel, "(SIMULATED DATA)" in messages to Earth. Kept on purpose: one line at the bottom of Live monitor ("Educational prototype using simulated data. Not a medical device."), the README, and an honest answer in Ask if someone asks whether the data is real.
- Every crew member can now pick anyone in the Crew dropdown and see the whole crew (`canSee` in `src/data/users.ts`); crew can log check-ins for each other. The flight surgeon on Earth still only sees what the crew sends.
- Ask rebuilt (`src/handbook.ts`, `src/Ask.tsx`): no "demo wording" labels; answers about the crew and each person live, who has a symptom, the scenario being played and its steps, NASA's five hazards, 17 risks and current studies, facts from the HRP and CSA pages and the rule sources, and the app itself. Direct answer first, follow-ups ("what should she do?", "why?"), spelling mistakes, "I don't have that" with the closest topics instead of guessing. Still no AI model and no internet needed. No Gemini key is set on Vercel, so the optional rewording stays off.
- A saved scenario that happens in one place (Landing day) now opens in that setting.
- 71 tests pass (11 new for Ask); 28-check browser walkthrough passes.


## Session 18 (2026-11-15)
- Header (Stephen's request): the page menu (Live monitor, Contact home, Ask, Flight surgeon) is centered at the top, with the logo on the left and the signed-in person on the right. The setting, scenario, clock and buttons sit centered under it. Below 1140 px wide the menu gets its own centered row. Contact home and Ask resize to the new header height.
- Flight surgeon is now a planner for a 90-minute blackout with no contact with Earth (Stephen's request: plan the next steps with the flight surgeon before the blackout, simple to use). Three steps, one at a time:
  - Plan: made from Live monitor (who to watch, steps at 0, 15, 30, 45, 60 and 80 minutes, rules for what to do if something happens), with a question for the flight surgeon. Sent through Contact home with the signal delay. On Earth, the flight surgeon approves it in the thread with optional instructions; with no one on Earth, an automatic approval arrives after the round trip, labelled as automatic.
  - Blackout: countdown (one second plays one minute), the one step to do now with Done, the flight surgeon's instructions, the rules with Open Emergency mode for the urgent one, and a log. Nothing is sent or received: Contact home and the report button pause, a chip in the header shows the time left, and messages from Earth wait until contact returns. Earth sees the crew's last message and a "the crew is in a planned blackout" notice.
  - Report: steps done and not done, the log and the approval, sent to the flight surgeon when contact returns.
- The plan is kept in the browser (`chm.blackout.v1`). Logic in `src/data/blackoutPlan.ts`; page in `src/FlightSurgeon.tsx`; plans, approvals and reports in `src/EarthLink.tsx`. The old practice drill (`src/data/surgeonDrill.ts`) is removed; `docs/FLIGHT_SURGEON_DRILL.md` became `docs/FLIGHT_SURGEON_BLACKOUT.md`.
- Ask explains how to plan a blackout ("what do we do during a blackout?").
- All README screenshots retaken with the new header, plus three of the Flight surgeon page.
- 78 tests pass (11 new); a 40-check browser walkthrough of the blackout passes: two tabs with a real approval, one tab with the automatic one, Mars behind the Sun, and a phone-sized screen.

## Session 19 (2026-11-15)
- Crew renamed (Stephen's request), keeping each person's role, body and pronouns: Shayan Akbarloyshabgahi (crew medical officer, was M. Chen), Khamosh Mehta (flight engineer, was A. Rivera), Tulsi Gandhi (commander, was E. Vance), Roya Alizadeh (science specialist, was S. Jenkins). Code, tests, README and docs updated; Ask finds people by first or last name.
- Header: the signed-in person is on the left, the logo on the right; the page menu stays centered.
- Live monitor: each signal row is a box filled with its status colour (green Normal, yellow Check, red Urgent), with a white status chip and a white "Do this next" box so they still stand out. The Crew dropdown box takes the chosen person's status colour.
- Sign-in: crew accounts now say "Sees the whole crew's health" (crew view has been open since Session 17).
- All README screenshots retaken.

## Session 20 (2026-11-15)
- New logo from Stephen's logo sheet (a planet with an orbit ring and a pin), traced to a vector path so it stays sharp at any size: in the header with the name "Crew Health Monitor", on the sign-in page, as the browser tab icon (white on a dark rounded square, `public/favicon.svg`), as the phone home-screen icon (`public/apple-touch-icon.png`) and at the top of the README (`docs/logo.svg`). The path is `LOGO_PATH` in `src/ui.tsx`.
- Sign-in: every crew account says "Sees the whole crew's health".
- README screenshots retaken with the new logo.

## Session 21 (2026-11-15)
- Ask has a microphone button (Stephen's request): tap it and say the question; the words show in the box while you speak and the question is asked when you stop (tap the red stop button to finish early). Uses the browser's own speech recognition (`src/speech.ts`): Chrome, Edge and Safari; in Chrome it needs internet, and the app tells you when the microphone is blocked, missing, offline or not supported. No audio is recorded or kept by the app. Tested with a stand-in recognizer: speaking, stopping early, blocked microphone, unsupported browser, phone width.

## Session 22 (2026-11-15)
- The app is now called **SOMA: Spaceflight Organ Monitoring Application** (Stephen's request): browser tab title, header (SOMA with the full name under it), sign-in page, logo label, README and docs. Ask answers "what does SOMA stand for?". The npm package name is `soma`.
- README screenshots retaken with the new name.

## Session 23 (2026-11-15)
- SOMA installs on a phone like an app, the same way as Stephen's My Accountant app: `public/manifest.webmanifest` (name, icon, full-screen), phone icons (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`), iPhone tags in `index.html`, and a service worker (`public/sw.js`, network first with a saved copy as fallback, `/api/` never saved) registered in `src/main.tsx` for the built app only. After the first visit it starts offline.
- Safe areas: the page keeps clear of the notch and the home bar. Text boxes are 16 px on phones so iPhone does not zoom in when you tap one.
- Ask explains how to put SOMA on a phone. README has the steps.
- Tested in Chrome: the manifest and icons load, the service worker runs, Chrome reports no install problems, and with the website switched off the app still opens and Ask still answers.
