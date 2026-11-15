# RadLab environmental anomaly experiment

The experiment scores authentic RadLab absorbed dose rate in µGy/hour. Each instrument, quantity and unit is evaluated independently. The existing shorter telemetry snapshots and radiation API are used by the app, while the experiment uses separate cached CSVs and publishes its own report. [NASA RadLab API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/)

## Reproduce on Windows

Run from the repo root with the Python dependencies in ml/requirements.txt installed.

```powershell
python -m ml.ingest --cache data/research/handoff-raw
python -m ml.radiation_experiment
python -m pytest -q
npm test
npm run build
```

The experiment downloads missing CSVs to data/research/radlab-experiment-raw and writes data/research/radiation-experiment.json. The report records exact queries, raw SHA-256 hashes, retrieval times, coverage, scores aggregated by method, and up to five flagged intervals per method. Use a fresh --cache directory for a new download and compare hashes if RadLab has revised its responses. A source failure is written to the report and the CLI exits nonzero.

| Instrument | Query windows | Usable absorbed dose rate | Median interval | Longest gap |
| --- | --- | ---: | ---: | ---: |
| DosTel1 | Apr 1–4, 4–7 and 7–10, 2022 | 10,716 | 88 s | 1,055 s |
| CRaTER-D1D2 | Apr 1–22, 2022 | 500 | 3,601 s | 8,430 s |
| MSL-RAD-Surface | Jan 1–22, 2024 | 1,755 | 1,026 s | 7,275 s |

All windows use the UTC timestamp query parameters. A single three-week DosTel1 query timed out, so the experiment uses the three successful shorter queries. The initial snapshots had 3,556, 71 and 574 usable absorbed dose rate readings respectively. In the extended DosTel1 snapshot, 74 rows shared duplicate timestamps, including duplicates across query boundaries. All copies are excluded from modeling. Dose equivalent had zero usable readings in all three instruments. Its coverage and quality counts remain in the report with an insufficient-history status. [DosTel1 metadata](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/DosTel1) · [CRaTER metadata](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/CRaTER-D1D2) · [Curiosity metadata](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/MSL-RAD-Surface)

## Methods and results

Each series uses the first 50% of elapsed time to fit, the next 25% to calibrate, and the last 25% to test. The fixed median/MAD baseline uses the training distribution and also reports its result with the existing cutoff of six on the common test subset. A second baseline fits two timestamp harmonics on training only and scores deviations from the past-only median of residuals over three nominal periods. The periods are 92 minutes for DosTel1, 113 minutes for CRaTER, and one mean Mars sol for Curiosity. These approximate time features can account for recurring patterns and do not use exact ephemeris. The hourly CRaTER cadence undersamples its nominal orbit, so its phase feature is exploratory. [ISS orbit](https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm) · [LRO orbit](https://science.nasa.gov/wp-content/uploads/2024/01/lola-rdrsis.pdf) · [Mean Mars sol](https://www.giss.nasa.gov/tools/mars24/help/notes.html)

Isolation Forest fits periodic residual, deviation from the trailing median, and change from the previous residual on training only. A gap over three training median cadences resets rolling history. Methods are compared on the same timestamps with at least five prior residuals in the window. Thresholds target approximately 5% flagged validation readings per method with a strict greater-than comparison for ties. The rounded-up validation count can make the realized rate slightly higher.

| Instrument | Test readings scored | Fixed MAD | Periodic rolling | Isolation Forest | Pairwise flag overlap (Jaccard range) |
| --- | ---: | ---: | ---: | ---: | ---: |
| DosTel1 | 2,666 | 4.58% | 4.24% | 3.38% | 0.55–0.93 |
| CRaTER-D1D2 | 114 | 15.79% | 5.26% | 7.89% | 0.04–0.17 |
| MSL-RAD-Surface | 449 | 10.69% | 10.47% | 8.91% | 0.67–0.70 |

These are reading-level flag rates. The authentic snapshots have no verified event labels, so accuracy and false-alarm rates cannot be estimated. No synthetic events were injected. High agreement on unflagged readings can obscure disagreement on the flags, especially for CRaTER. Example first flagged timestamps for the periodic rolling method are 2022-04-08 00:04:53 UTC (DosTel1), 2022-04-17 05:59:59 UTC (CRaTER), and 2024-01-17 01:07:51 UTC (Curiosity). These intervals are candidates for investigation. Sensor quality exclusions are reported separately, and experiment results are kept outside crew alerts.

## Read-only API

Start or restart the Node server after generating the artifact. An authenticated GET /api/analytics/radiation-experiment returns the report. Optional instrumentId and measurement filters select series. An unknown valid filter returns an empty series list, invalid or duplicate filters return 400, and a missing report returns 503. RADIATION_EXPERIMENT_FILE can override the default report path. The existing GET /api/analytics/radiation response remains compatible.
