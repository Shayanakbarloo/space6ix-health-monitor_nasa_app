# Frontend integration

Run from the Crew Health Monitor directory with Node 24 and Python 3.13. Install the Python dependencies once in a virtual environment.

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/requirements.txt
.\.venv\Scripts\python.exe -m ml.ingest
npm run dev
```

The API reads the generated research bundle at startup. Restart the server after rebuilding. Run Python's `-m ml.train` if you also want the optional synthetic evaluation report. The Vite dev server proxies API requests from localhost:5173 to Node on port 8787.

## Authentication and queries

Login with POST /api/login and a demo account (no PIN), then send the returned bearer token on each request. C1 (Tulsi Gandhi) can read their own crew vitals, C2 (medical officer) can read any crew member's vitals, and FS (flight surgeon) has no direct access to crew vitals. Signed-in users can read public study data. Keep NASA pseudonyms such as C001 independent of app accounts such as C1.

```powershell
$api = 'http://localhost:5173/api'
$session = Invoke-RestMethod "$api/login" -Method Post -ContentType 'application/json' -Body '{"userId":"C1"}'
$headers = @{ Authorization = "Bearer $($session.token)" }
$hct = Invoke-RestMethod "$api/research/observations?studyId=OSD-569&measurement=hematocrit&phase=postflight&qualityStatus=accepted&matchedBaseline=true&limit=1" -Headers $headers
$hct.observations[0] | ConvertTo-Json -Depth 5
$vitals = Invoke-RestMethod "$api/analytics/crew/C1?day=60&mission=mars" -Headers $headers
$vitals.observations | Where-Object measurement -in restingHrBpm,systolicBp,diastolicBp
```

| GET endpoint | Filters and response |
| --- | --- |
| /api/research/studies | Manifest for each file or telemetry query, including status, count, checksum and source URL |
| /api/research/observations | Required `studyId`. Optional `measurement`, `phase`, `qualityStatus`, `matchedBaseline` |
| /api/research/summaries | Required `studyId`. Optional `measurement`. Descriptive statistics by assay, specimen, timepoint and unit |
| /api/research/body-systems/:system | Optional `measurement`, `phase`, `qualityStatus`, `matchedBaseline` |
| /api/analytics/radiation | Optional `instrumentId`, `measurement`, `qualityStatus`. Rows include instrument and environmental context |
| /api/analytics/crew/:crewId | Optional `day` (1–90, default 90) and `mission` (default mars). Values and provenance plus separate simulated rule results |
| /api/analytics/model-info | Offline synthetic evaluation and configuration |

Research row routes support `limit` (1–200, default 100) and `offset` (default 0). Apply the filters, then paginate in stable artifact order. Use `nextOffset` until it is null. Restart pagination if the underlying artifact changes. Filters use exact measurement keys, `preflight` or `postflight`, and quality values `accepted`, `missing`, `invalid`, or `unit_unverified`. `matchedBaseline=true` requires a nonempty baseline with a median. `false` returns observations without one. Null observations retain their quality and provenance when no quality filter is applied. The radiation route also accepts phase and matchedBaseline for consistency, but instrument telemetry has no flight-phase comparison.

Invalid or duplicated parameters return 400, missing or expired sessions 401, unauthorized crew requests 403, and unknown study/system/crew IDs 404. A missing bundle or an entirely unavailable selected source returns 503. Empty filters on a loaded source return 200 with an empty list; unavailable files in a partially available study remain visible with their reason. Instrument IDs are exact. Look up available instruments with the manifest and use e.g. `instrumentId=MSL-RAD-Surface&measurement=absorbed_dose_rate&qualityStatus=accepted`.

## 3D panel and data examples

Reuse CardiovascularPanel.tsx, API functions fetchCrewVitals and fetchHematocrit in api.ts, and their typed projections in data/researchContract.ts. BodyScan's optional onSystemChange callback reports system selection. Overview opens the panel on Heart and blood or a hematocrit marker pick, while the existing Blood marker opens its normal signal detail. Query private readings by crew, day, and mission whenever selection or the associated vital check-in changes. Keep the study comparison independent of all three.

Example matched observation, abridged:

```json
{"studyId":"OSD-569","sourceType":"NASA_HUMAN","subjectId":"C001","timepoint":"R+1","phase":"postflight","measurement":"hematocrit","qualityStatus":"accepted","unit":"percent","value":43.6,"comparison":{"baselineN":3,"baselineMedian":44.5,"absoluteChange":-0.9}}
```

Example crew response on Mars transit day 60 with no check-in, abridged:

```json
{"crewId":"C1","day":60,"mission":"mars","observations":[{"measurement":"restingHrBpm","value":66,"unit":"bpm","sourceType":"SIMULATED"},{"measurement":"systolicBp","value":112,"unit":"mmHg","sourceType":"SIMULATED"},{"measurement":"diastolicBp","value":77,"unit":"mmHg","sourceType":"SIMULATED"}]}
```

Show `USER_REPORTED` as a check-in source. The app's crew data is for the demo. Keep research and synthetic model results separate from status rules, organ colors and hotspots.

| Future panel | Query example | Display context |
| --- | --- | --- |
| Immune | /api/research/observations?studyId=OSD-656&measurement=activin_a | Human urine assay, preserve NPQ and sample timing |
| Metabolic | /api/research/observations?studyId=OSD-575&measurement=glucose | Human serum marker and original lab unit |
| Skeletal | /api/research/body-systems/skeletal?measurement=cortical_thickness | Mouse micro-CT, show species and cohort |
| Whole-body radiation | /api/analytics/radiation?instrumentId=MSL-RAD-Surface&measurement=absorbed_dose_rate | Curiosity environmental instrument, show instrument and unit |

## Blackout plans and browser-only mode

The Flight surgeon page keeps its blackout (plan, start time, steps done, log) in the browser under `chm.blackout.v1`. The server has no blackout state: plans, approvals and reports are ordinary messages, with session access and the transmission delay enforced as usual. While a blackout is on, the app sends nothing and holds messages from Earth until it ends. See [the blackout notes](FLIGHT_SURGEON_BLACKOUT.md).

A crew plan is POST /api/messages with `kind: "report"` and a body whose first line is `BLACKOUT PLAN v1`, the second line the plan as JSON, then the plan as text (the separator is a newline):

```json
{"kind":"report","day":62,"mission":"mars","body":"BLACKOUT PLAN v1\n{\"id\":\"bp-1\",\"watch\":[{\"id\":\"C3\",\"name\":\"Roya Alizadeh\",\"issue\":\"headache\"}],\"steps\":[{\"id\":\"s0\",\"at\":0,\"text\":\"Contact is lost.\"}],\"question\":\"\"}\n\nBlackout plan: 90 minutes without contact with Earth."}
```

The flight surgeon approves with `kind: "message"` and the plan's id, sent with the ground session token. It reaches the crew after the return delay:

```json
{"kind":"message","day":62,"mission":"mars","body":"BLACKOUT PLAN APPROVED v1\n{\"planId\":\"bp-1\",\"note\":\"Recheck her temperature at 30 minutes.\"}\n\nBlackout plan approved. Instructions: Recheck her temperature at 30 minutes."}
```

Use readPlan, readApproval, planRules and blackoutReport from src/data/blackoutPlan.ts to read and render them. The crew's last message before the blackout starts with `BLACKOUT STARTED:`, and the report when contact returns with `BLACKOUT REPORT:`.

The browser-only demo retains 3D signals, check-ins, and local Contact home between tabs. Server-backed crew analytics show an unavailable state; the check-in action remains usable. The separate Ask feature has its existing local handbook path.

## RadLab experiment

After running python -m ml.radiation_experiment and restarting the server, use the usual bearer token to read GET /api/analytics/radiation-experiment?instrumentId=DosTel1&measurement=absorbed_dose_rate. The report includes provenance, data quality, chronological split coverage, per-method flag rates, agreement, and example intervals. The legacy telemetry endpoint remains available for observation-level queries. See [the RadLab experiment guide](RADIATION_EXPERIMENT.md).
