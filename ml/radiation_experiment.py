"""Evaluate environmental anomaly scores on chronological NASA RadLab telemetry."""
import argparse
from collections import Counter, defaultdict
from itertools import combinations
import json
from math import ceil
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml.ingest import ROOT
from ml.radiation import load_radiation

WINDOWS = [
    ("DosTel1", "2022-04-01", "2022-04-04"),
    ("DosTel1", "2022-04-04", "2022-04-07"),
    ("DosTel1", "2022-04-07", "2022-04-10"),
    ("CRaTER-D1D2", "2022-04-01", "2022-04-22"),
    ("MSL-RAD-Surface", "2024-01-01", "2024-01-22"),
]
PERIOD_SECONDS = {"DosTel1": 92 * 60, "CRaTER-D1D2": 113 * 60, "MSL-RAD-Surface": 88775.244}
TARGET_RATE = .05
MIN_TRAIN = 100
MIN_EVALUATION = 40
SEED = 173
ESTIMATORS = 128


def series_groups(records):
    groups = defaultdict(list)
    for row in records:
        groups[row["instrumentId"], row["measurement"], row["unit"]].append(row)
    return groups


def prepare(rows):
    quality = Counter(row["qualityStatus"] for row in rows)
    frame = pd.DataFrame(rows, columns=["timestamp", "value", "qualityStatus"])
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, format="ISO8601")
    duplicate = frame.timestamp.duplicated(keep=False)
    valid = frame.qualityStatus.eq("accepted") & np.isfinite(frame.value.astype(float))
    clean = frame.loc[valid & ~duplicate].sort_values("timestamp").set_index("timestamp").value.astype(float)
    gaps = clean.index.to_series().diff().dt.total_seconds().dropna()
    cadence = float(gaps.median()) if len(gaps) else None
    coverage = {
        "rawRows": len(rows), "qualityCounts": dict(quality),
        "duplicateTimestampRows": int(duplicate.sum()),
        "usableReadings": len(clean),
        "firstUtc": frame.timestamp.min().isoformat() if len(frame) else None,
        "lastUtc": frame.timestamp.max().isoformat() if len(frame) else None,
        "medianCadenceSeconds": cadence,
        "maxGapSeconds": float(gaps.max()) if len(gaps) else None,
        "gapsOverThreeCadences": int((gaps > 3 * cadence).sum()) if cadence else None,
    }
    return clean, coverage


def robust_scale(values, floor=0.):
    center = float(np.median(values))
    scale = float(1.4826 * np.median(np.abs(values - center)))
    return center, max(scale, floor)


def score(clean, train_end, period_seconds):
    """Fit on the training prefix and use strictly prior rolling features."""
    values = clean.to_numpy()
    gaps = clean.index.to_series().diff().dt.total_seconds()
    cadence = float(gaps.iloc[:train_end].median())
    center, scale = robust_scale(values[:train_end])
    if not np.isfinite(cadence) or cadence <= 0 or scale == 0:
        raise ValueError("Training data have degenerate cadence or median absolute deviation")

    # The periodic phase comes from timestamp alone. Fit coefficients on training only.
    seconds = (clean.index - clean.index[0]).total_seconds().to_numpy()
    phase = 2 * np.pi * seconds / period_seconds
    design = np.column_stack([np.ones(len(clean)), np.sin(phase), np.cos(phase), np.sin(2 * phase), np.cos(2 * phase)])
    coefficients = np.linalg.lstsq(design[:train_end], values[:train_end], rcond=None)[0]
    residual = pd.Series(values - design @ coefficients, index=clean.index)

    # A long gap ends the local history. Use elapsed time and exclude the current reading.
    segment = gaps.gt(3 * cadence).cumsum()
    window = pd.Timedelta(seconds=3 * period_seconds)
    rolling = residual.groupby(segment).transform(lambda samples: samples.rolling(window, closed="left", min_periods=5).median())
    innovation = residual - rolling
    step = residual.groupby(segment).diff()
    features = pd.DataFrame({"residual": residual, "innovation": innovation, "step": step})
    features = features.loc[features.notna().all(axis=1)]
    train_features = features.loc[features.index <= clean.index[train_end - 1]]
    _, innovation_scale = robust_scale(train_features.innovation.to_numpy(), scale * .05) if len(train_features) else (0, scale)
    scores = pd.DataFrame({
        "fixed_mad": np.abs(clean.loc[features.index] - center) / scale,
        "periodic_rolling": features.innovation.abs() / innovation_scale,
    })
    if len(train_features) >= MIN_TRAIN:
        forest = IsolationForest(n_estimators=ESTIMATORS, random_state=SEED, n_jobs=1)
        forest.fit(train_features)
        scores["isolation_forest"] = -forest.score_samples(features)
    return scores, {"trainMedianCadenceSeconds": cadence, "rollingWindowSeconds": window.total_seconds(),
                    "gapResetSeconds": 3 * cadence, "modelTrainingReadings": len(train_features)}


def examples(mask, values, gap_seconds, limit=5):
    intervals = []
    previous = None
    for stamp, flagged in mask.items():
        if flagged:
            if previous is None or (stamp - previous).total_seconds() > gap_seconds:
                if len(intervals) == limit:
                    break
                intervals.append({"startUtc": stamp.isoformat(), "endUtc": stamp.isoformat(),
                                  "readings": 0, "minValue": float(values[stamp]), "maxValue": float(values[stamp])})
            interval = intervals[-1]
            interval["endUtc"] = stamp.isoformat()
            interval["readings"] += 1
            interval["minValue"] = min(interval["minValue"], float(values[stamp]))
            interval["maxValue"] = max(interval["maxValue"], float(values[stamp]))
        previous = stamp if flagged else None
    return intervals


def evaluate(key, rows, sources):
    sensor, quantity, unit = key
    clean, coverage = prepare(rows)
    result = {"instrumentId": sensor, "measurement": quantity, "unit": unit, "coverage": coverage,
              "sources": sources, "status": "insufficient_history"}
    if len(clean) < MIN_TRAIN + 2 * MIN_EVALUATION:
        return {**result, "reason": "Too few valid readings for independent training, validation, and test windows."}
    duration = clean.index[-1] - clean.index[0]
    validation_start = clean.index[0] + duration / 2
    test_start = clean.index[0] + duration * .75
    train_end = clean.index.searchsorted(validation_start)
    test_begin = clean.index.searchsorted(test_start)
    result["splits"] = dict(zip(("train", "validation", "test"), [
        {"startUtc": subset.index[0].isoformat(), "endUtc": subset.index[-1].isoformat(), "usableReadings": len(subset)}
        if len(subset) else {"usableReadings": 0}
        for subset in (clean.iloc[:train_end], clean.iloc[train_end:test_begin], clean.iloc[test_begin:])
    ]))
    if train_end < MIN_TRAIN or min(test_begin - train_end, len(clean) - test_begin) < MIN_EVALUATION:
        return {**result, "reason": "Too few valid readings in one or more chronological splits."}
    try:
        scores, context = score(clean, train_end, PERIOD_SECONDS[sensor])
    except ValueError as exc:
        return {**result, "reason": str(exc)}
    validation = scores.loc[(scores.index >= validation_start) & (scores.index < test_start)]
    test = scores.loc[scores.index >= test_start]
    if min(len(validation), len(test)) < MIN_EVALUATION:
        return {**result, "reason": "Too few comparable scores after gap and warm-up exclusions."}

    # Strict > with a rank threshold avoids arbitrarily breaking ties.
    rank = len(validation) - ceil(len(validation) * TARGET_RATE) - 1
    thresholds = validation.apply(lambda col: float(np.sort(col)[rank]))
    flagged = test.gt(thresholds)
    methods = {}
    for method in scores:
        mask = flagged[method]
        methods[method] = {
            "threshold": float(thresholds[method]),
            "validationFlagRate": float(validation[method].gt(thresholds[method]).mean()),
            "testFlagRate": float(mask.mean()), "testFlagged": int(mask.sum()),
            "exampleFlaggedIntervals": examples(mask, clean, context["gapResetSeconds"]),
        }
        if method == "fixed_mad":
            methods[method]["legacyCutoff6TestFlagRate"] = float(test[method].gt(6).mean())
    agreement = []
    for left, right in combinations(flagged.columns, 2):
        a, b = flagged[left], flagged[right]
        union = int((a | b).sum())
        agreement.append({"methods": [left, right], "agreement": float(a.eq(b).mean()),
                          "flagJaccard": float((a & b).sum() / union) if union else None})
    return {**result, "status": "evaluated", "context": context,
            "periodSeconds": PERIOD_SECONDS[sensor], "validationScored": len(validation), "testScored": len(test),
            "methods": methods, "agreement": agreement}


def build(cache, output):
    cache.mkdir(parents=True, exist_ok=True)
    sources, rows = load_radiation(cache, WINDOWS, exact_ids=True, legacy_flags=False)
    groups = series_groups(rows)
    results = [evaluate(key, group, [s for s in sources if key[0] in s["instrumentIds"]])
               for key, group in sorted(groups.items())]
    report = {
        "schemaVersion": 1, "sourceType": "NASA_ENVIRONMENT", "labeledEvents": False,
        "targetValidationFlagRate": TARGET_RATE, "sources": sources, "series": results,
        "methodMetadata": {
            "fixed_mad": "Absolute deviation from training median divided by scaled training MAD.",
            "periodic_rolling": "Two training-fitted timestamp harmonics plus a trailing residual median.",
            "isolation_forest": {"features": ["residual", "innovation", "step"], "seed": SEED, "estimators": ESTIMATORS},
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".tmp")
    temp.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(output)
    for result in results:
        print(result["instrumentId"], result["measurement"], result["status"],
              result.get("testScored", result.get("reason", "")))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / "data/research/radlab-experiment-raw")
    parser.add_argument("--output", type=Path, default=ROOT / "data/research/radiation-experiment.json")
    args = parser.parse_args()
    report = build(args.cache, args.output)
    if any(source["status"] != "available" for source in report["sources"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
