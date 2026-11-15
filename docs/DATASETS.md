# NASA datasets

Data courtesy of NASA Open Science Data Repository. See the citation panel on each study page for the study citation. [NASA OSDR reuse terms](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/).

| Source | Processed scope | Observation rows |
| --- | --- | ---: |
| [OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) | CBC, 28 samples from four Inspiration4 participants | 560 |
| [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | CMP and EvePanel cardiovascular serum concentrations, including glucose, calcium, alkaline phosphatase and CRP | 784 |
| [OSD-656](https://osdr.nasa.gov/bio/repo/data/studies/OSD-656) | Urine AlamarPanel NPQ, 22 samples. Percentage change is suppressed for NPQ | 8,888 |
| [OSD-804](https://osdr.nasa.gov/bio/repo/data/studies/OSD-804) | Mouse cortical thickness, trabecular number, separation and thickness by cohort and specimen | 680 |
| [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | DosTel1 aboard ISS and CRaTER in lunar orbit (April 1–4, 2022). MSL-RAD-Surface aboard Curiosity (January 1–8, 2024) | 8,454 |

Counts include missing and invalid rows. RadLab returned absorbed dose rates in the selected windows. The parallel dose equivalent fields are retained as missing. The April 2014 window returned no Curiosity rows. The verified January 2024 window returned 574 absorbed dose rate measurements in µGy/hour and 574 missing dose equivalent values. Additional OSD-575 immune panels and optional OSD-435, OSD-489 and OSD-654 remain outside the current analytical scope.

The export records per-file NASA URLs, pinned SHA-256 hashes for OSD files, retrieval time where known, upstream file update time when available, and quality counts. The repository's existing CBC copy matches the exact published file bytes. Its original retrieval time is unknown. RadLab query responses are cached locally with a content checksum in the export. To refresh, use a new cache directory and compare checksums.

Human observations retain the original pseudonymous sample ID, specimen, assay, header unit tokens, lab reference limits, and launch-relative or return-relative time. The CBC header labels hemoglobin with a percent unit. This is preserved as published and excluded from statistics pending verification. Missing and nonnumeric results remain null with the source token retained. The pipeline performs no unit conversions.

Postflight changes use the median of available accepted preflight observations for the same study, file, participant, measurement, specimen and unit. Summaries include total and valid observations, unique subjects, range and sample standard deviation. It is descriptive analysis with small cohorts, uneven timing and no in-flight daily vital-sign measurements. These observations cannot establish intervention thresholds or support supervised disease prediction.

RadLab robust deviations compare each instrument and quantity to the first chronological half of its selected window. Flags use six scaled median absolute deviations with at least 20 valid calibration values. Duplicate timestamp records are marked invalid and excluded from scoring. Natural orbital structure and instrument changes can cause flags. The data are environmental telemetry and contain no personal dosimetry.

The NASA and CSA challenge resources provide scientific context. Source observations come from the files and telemetry above. Synthetic test trajectories and the app's simulated crew feed are generated separately.


## Verified rebuild snapshot

The manifest also records the full source URLs and per-file quality counts. This snapshot was built with a fresh download cache. The CBC uses the pinned local copy.

| Source file | Rows | SHA-256 |
| --- | ---: | --- |
| LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv | 560 | 32e4f9c97d3b636b5d5c2e72dab8c4d3319dee64c437508b092dad04603b2b8f |
| LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv | 532 | 5eb1e7f025dd8443a9e70111e62bc32afae3432753024489c5c013e401d709d9 |
| LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv | 252 | fdba6c3ce45401c12ca9b699fa375303793959aa0391e2f3c722f354d9cfc75c |
| LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv | 8,888 | f81b6dff9c34accab6dffe7a0b2970854f2f0b8d2712e92cfd0e91e6bb59c94a |
| LSDS-130_microCT_Cahill_microCT_TRANSFORMED.csv | 680 | 499541f23b4c3afcd39762456d98cb3046e1f56467fdf8ec5987f684534ccf0c |
| radlab-DosTel1-2022-04-01-2022-04-04.csv | 7,164 | ce8078fb0e371acb865a25fb71580edcdc6c787314f8590f7e1f8d54701570b4 |
| radlab-CRaTER-2022-04-01-2022-04-04.csv | 142 | d1a5776058c6dbbc26dfd37a5f907827c8f43342a0f6f0a431db69c3dd5006ba |
| radlab-MSL-RAD-Surface-2024-01-01-2024-01-08.csv | 1,148 | a90a44a8d517d3813076b0798633a74eaca120839a83ca5b390f4c02bf519937 |

Curiosity data returned under the exact instrument ID MSL-RAD-Surface. The result includes Curiosity spacecraft and Mars surface trajectory, and retains absorbed dose rate separately from dose equivalent rate. RadLab response checksums describe this snapshot and can change if the upstream service revises data. [Instrument documentation](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/MSL-RAD-Surface) · [Exact successful query](https://visualization.osdr.nasa.gov/radlab/api/?instrument_id=MSL-RAD-Surface&timestamp%3E=2024-01-01&timestamp%3C=2024-01-08&absorbed_dose_rate=&dose_equivalent_rate=&module=&spacecraft=&trajectory=) · [Empty April 2014 query](https://visualization.osdr.nasa.gov/radlab/api/?instrument_id=MSL-RAD-Surface&timestamp%3E=2014-04-01&timestamp%3C=2014-04-12&absorbed_dose_rate=&dose_equivalent_rate=&module=&spacecraft=&trajectory=)
