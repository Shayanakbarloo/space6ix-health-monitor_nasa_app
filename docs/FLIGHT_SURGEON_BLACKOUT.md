# Flight surgeon: planning a blackout

The Flight surgeon page plans a 90-minute blackout, when there is no contact with Earth, together with the flight surgeon. It replaces the Iteration 1 practice drill. It runs in the browser with no API key and no AI, on the Vercel link or with `npm run dev`.

## Try it with two tabs

1. Sign in as **Shayan Akbarloyshabgahi** and pick the **Flagged** scenario. Open **Flight surgeon**. The plan is already made from Live monitor: Roya Alizadeh to watch, the steps, and what to do if something happens. Add a question and press **Send plan to the flight surgeon**.
2. In a second tab of the same browser, sign in as **Flight surgeon**. The plan arrives in Contact home after the signal delay (16 seconds on Mars transit, about a second on the Moon or the space station). Press **Show the full plan** to read it, write any instructions, and press **Approve plan**.
3. Back in the crew tab, the approval arrives after the delay with the instructions. Press **Start the blackout**.
4. The page shows the step to do now. Press **Done** after each one. Add what happens to the log. Try **Open Emergency mode** under "If this happens". Contact home and the report button are paused, and the header shows "No contact · N min left".
5. Press **Skip ahead 15 min** to move on, or **Contact is back** to end early. Then press **Send report to the flight surgeon** and watch it arrive in the Flight surgeon tab.

With one tab only, the plan is approved automatically after the round-trip delay plus a few seconds, and the page says it was an automatic answer.

## How it works

| Part | What happens |
|---|---|
| The plan | Built from what Live monitor shows when the plan is made. Up to four people (and the cabin) with something flagged go on the watch list. Steps at 0, 15, 30, 45, 60 and 80 minutes. A rule for each watched person, then the standard rules |
| Sending | The plan goes through Contact home as a report, with the usual signal delay. Its first line is `BLACKOUT PLAN v1`, then the plan as JSON, then the plan as text for people. It stays under the 4,000-character message limit |
| Approval | The flight surgeon's answer is a message that starts with `BLACKOUT PLAN APPROVED v1`, then `{"planId": ..., "note": ...}` |
| Starting | The crew's last message before the blackout starts with `BLACKOUT STARTED:`. The flight surgeon's tab uses it to show that the crew is in a blackout |
| During | One second plays one minute. The step to do now is the earliest step that is due and not done. Nothing can be sent. Messages from Earth that arrive during the blackout are held until it ends |
| Report | Starts with `BLACKOUT REPORT:` and lists the approval and any instructions, the steps done (with the minute) and not done, and the log |
| Saved | The plan, the time it started and what was done are kept in this browser (`chm.blackout.v1`), so a reload does not lose the blackout |

The code is in `src/data/blackoutPlan.ts` (plan, messages, timing, report) and `src/FlightSurgeon.tsx` (the page). Contact home renders plans, approvals and reports, and has the **Approve plan** form, in `src/EarthLink.tsx`. Tests: `src/data/blackoutPlan.test.ts`.

## Where the rules come from

| Rule | Source |
|---|---|
| Someone collapses: open Emergency mode, do not wait for Earth | [NASA Human Research Program: distance from Earth](https://www.nasa.gov/hrp/hazard-distance-from-earth/) (the crew must act on its own first) |
| Headache: check cabin CO2, above 2.5 mmHg turn up the airflow | [NASA OCHMO technical brief on carbon dioxide](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) |
| Dizzy or faint: lie down with the legs up, water with salt | [NASA: compression garments and fluid loading against fainting after flight](https://ntrs.nasa.gov/citations/20160013631) |
| Radiation alarm: everyone into the storm shelter | [NASA Science: protecting Artemis II astronauts from the Sun](https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/) |
| Fever of 38 C or more, and medicines at the label dose | Ordinary Earth practice, the same limits the app uses for temperature |

Planning with the ground before the crew works on its own follows NASA's work on [Earth-independent medical operations](https://ntrs.nasa.gov/citations/20250000009). The 90 minutes and the step times are demo choices, not a NASA procedure.
