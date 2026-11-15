# Experimental physiological anomaly detector

Isolation Forest scores six features already represented in the app (heart rate, systolic and diastolic pressure, SpO₂, seven-day sleep duration and temperature). The experiment generates independent spatiotemporal signals for fictitious subjects. All observations and anomaly labels are synthetic. The trained model has no clinical validation or deployment role.

Training uses 90 stable subjects. A separate 60-subject validation set sets cutoffs by F1. The held-out test set has 90 subjects, 5,940 scored or eligible crew-days and 714 injected anomaly days. The combined shift scenario appears only in test. The first 14 days of each subject provide a pre-event baseline. Rolling comparisons use exclusively prior days. Split counts, seeds and window lengths are recorded in model_config.json. The experiment uses injected shifts with random onset, duration and magnitude and simulated drifting autocorrelated signals.

| Held-out method | Clean F1 |
| --- | ---: |
| Isolation Forest | 0.604 |
| Personal standardized deviation | 0.588 |
| Selected app rules | 0.532 |
| Personal MAD deviation | 0.518 |
| Rolling median | 0.434 |

Isolation Forest clean precision was 0.788 and recall 0.490, with 0.0158 false alarms per simulated crew-day. With 12% of input readings independently masked, F1 was 0.557 and 155 crew-days were unscored. With large additive errors injected into 2.5% of readings, F1 was 0.534 and false alarms rose to 0.0549 per crew-day. When fewer than four readings are usable, the detector abstains. Evaluation counts abstentions on anomaly days as missed detections. Remaining missing values use the subject's baseline median for scoring.

The rule comparator mirrors the app's shared vital-sign cutoffs for these inputs. Day-level metrics reflect the generated anomaly prevalence and perturbations. The experiment does not model devices, clinical outcomes, astronaut baselines, or all plausible data failures. The full evaluation JSON includes every scenario, input condition, comparator and cutoff. The model is fitted offline and the API serves the evaluation report. Human NASA data are analyzed descriptively and never used for model training.
