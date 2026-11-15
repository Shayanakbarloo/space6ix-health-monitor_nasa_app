# Scope check against the challenge

Challenge: "Create Health Monitoring Software for Astronauts on Space Missions", NASA Space Apps 2026.
Source: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ (read on 2026-11-11). Difficulty: Intermediate.

This is our own summary of what the page asks for, and where the app answers it.

## What the challenge asks for

| The challenge says | Where we answer it | Status |
|---|---|---|
| Software that gathers health indicators and lets astronauts evaluate and act on their health | Live monitor (the first screen after sign-in), check-in form | Covered |
| A visual tool that helps astronauts assess their own health | 3D body, colour-coded signals | Covered |
| Guidance on treatments and health improvements | "Do this next" box on every signal, Steps to fix under Live monitor, Emergency walkthroughs | Covered. For a slight fever the steps say to take a pain reliever from the medical kit at the label dose. We never give doses |
| Input by keyboard, mouse or other means; any data that is a health indicator | Check-in form, simulated device feed, image attached to a check-in | Covered. Images are stored and shown, not analysed |
| Named indicators: blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, mood | All six are signals | Covered. Blood pressure, sugar, temperature and mood use ordinary Earth limits, labelled as demo parameters |
| Which measurements can be performed in space? Why is an exam needed? | "About this measurement" in each signal: what it is, why it matters in space, how to take it | Covered |
| How do spaceflight hazards affect these indicators? | Each signal is tagged with one of NASA's five hazards; each rule explains how spaceflight changes the reading | Covered |
| When might a result warrant attention from the crew or from flight surgeons? | Normal / Check / Urgent levels, Contact home with reports. The Flagged scenario is a problem the crew fixes; the Emergency scenario needs the flight surgeon and ground control. For times with no contact, the Flight surgeon page plans a 90-minute blackout with the flight surgeon beforehand | Covered |
| What actions can prevent a critical condition? | Next steps on every signal, the Steps to fix checklist | Covered |
| Example: a human figure where each body part is clickable and shows its status | The 3D body with clickable markers | Covered |

## Required resources

The challenge's Resources tab lists five pages (two from NASA's Human Research Program beyond the hazards page, and two from the Canadian Space Agency). All five were read on 2026-11-13. The README section "NASA and partner resources used" says where each appears in the app. In short: hazards and NASA risk names are shown on every signal, current NASA studies are named where they match, and two facts (bone loss rate, share of astronauts with eye swelling) come straight from NASA's risk pages.

## Optional considerations

| Consideration | Status |
|---|---|
| Different environments (spacecraft, station, rover, surface base) | Partly: space station, Moon surface and Mars transit. The setting changes the signal delay and the radiation rate, each with a source. On the Moon it also applies a smaller fluid shift (a demo parameter) |
| Prompt astronauts to take measurements as part of the routine | Partly: stale-data warnings, and a "Log a new measurement" button on signals that need one |
| Gamification | Not done, by choice |
| Dynamic charts of indicators over time | Covered: live vitals and signals updating every two seconds, each with its last minute as a line, and a live chart of up to three signals over two minutes |
| Colour coding to read status at a glance | Covered. Colour appears only where attention is needed |
| Do not assume astronauts know how to assess their health | Covered: plain-language explanations, the Ask tab, the Emergency steps |

## Gaps to be honest about

- Images can be attached but are not analysed and not yet sent to Earth.
- Immune and nutrition are covered by three signals (white cells, vitamin D, body mass). Their in-flight action levels are demo parameters.
- No gamification, by choice: points and streaks would reward hiding symptoms to keep a streak.
- The Moon's effect on the body is an assumption: no long stay in Moon gravity has been measured.
