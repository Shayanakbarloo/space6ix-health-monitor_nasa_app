"""Train and evaluate an Isolation Forest on simulated crew-days."""
import argparse
import json
from pathlib import Path
import pickle

import numpy as np
from sklearn.ensemble import IsolationForest

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads(Path(__file__).with_name("model_config.json").read_text())
CENTER = np.array([62, 115, 75, 97.5, 7.2, 36.6])
NOISE = np.array([3.0, 4.0, 3.0, 0.5, 0.45, 0.2])
SHIFTS = {
    "gradual": [9, 11, 8, -1.6, -1.1, 0.45],
    "abrupt": [16, 19, 12, -2.8, -1.4, 0.8],
    "sparse": [0, 0, 0, 0, -1.6, 0],
    "combined": [5, -10, -8, -1, -0.45, 0.55],
    "stable": [0, 0, 0, 0, 0, 0],
}


def scenarios(split):
    rng = np.random.default_rng(CONFIG["seeds"][split])
    patterns = {"train": ["stable"], "validation": ["stable", "gradual", "abrupt", "sparse"],
                "test": list(SHIFTS)}[split]
    for index in range(CONFIG["subjects"][split]):
        name = patterns[index % len(patterns)]
        days = CONFIG["days"]
        signals = rng.normal(size=(days, len(CENTER)))
        for day in range(1, days):
            signals[day] += rng.uniform(0.15, 0.55) * signals[day - 1]
        trend = np.sin(np.arange(days)[:, None] / rng.uniform(3, 18, len(CENTER)) + rng.uniform(0, 6))
        data = CENTER + rng.normal(0, NOISE) + (signals + trend * 0.5) * NOISE
        culprit = np.zeros(days, dtype=bool)
        if name != "stable":
            start = rng.integers(22, 56)
            span = rng.integers(5, 15)
            culprit[start:start + span] = True
            ramp = np.linspace(0.25, 1.1, span) if name == "gradual" else np.ones(span)
            data[culprit] += ramp[:, None] * SHIFTS[name] * rng.uniform(0.7, 1.3)
        yield f"{split}-{index:03}", name, data, culprit


def features(data, corruption="clean", rng=None):
    history = CONFIG["baselineDays"]
    personal = data[:history]
    center = np.median(personal, axis=0)
    mad = np.maximum(np.median(np.abs(personal - center), axis=0) * 1.4826, NOISE * 0.3)
    scale = np.maximum(personal.std(axis=0, ddof=1), NOISE * 0.3)
    values = data.copy()
    values[:, 3] = np.minimum(values[:, 3], 100)
    later = values[history:]
    if corruption == "missing":
        later[rng.random(later.shape) < 0.12] = np.nan
    if corruption == "corrupted":
        later += (rng.random(later.shape) < 0.025) * rng.choice([-1, 1], size=later.shape) * NOISE * 12
    # Bounds catch impossible values and keep missing inputs from acting as model signals.
    low = [0, 0, 0, 0, 0, 0]
    high = [250, 300, 250, 100, 24, 50]

    values[(values < low) | (values > high)] = np.nan
    observed = np.isfinite(later)
    scoreable = observed.sum(axis=1) >= 4
    imputed = np.where(np.isfinite(values), values, center)
    rolling = np.array([np.median(imputed[day - CONFIG["rollingDays"]:day], axis=0)
                        for day in range(history, len(values))])
    personal_dev = (imputed[history:] - center) / mad
    rolling_dev = (imputed[history:] - rolling) / NOISE
    z = (imputed[history:] - personal.mean(axis=0)) / scale
    z[~observed] = 0
    rolling_dev[~observed] = 0
    hr, sys, dia, oxygen, sleep, temp = later.T
    rule = (hr > 100) | (sys >= 140) | (dia >= 90) | (sys < 90) | (oxygen < 94) | (sleep < 6) | (temp >= 38)
    return personal_dev, {
        "rolling_median": np.max(np.abs(rolling_dev), axis=1),
        "personal_mad": np.max(np.abs(personal_dev), axis=1),
        "personal_z": np.max(np.abs(z), axis=1),
        "selected_app_rules": rule.astype(float),
    }, scoreable


def collect(model, split, corruption="clean"):
    batches = []
    rng = np.random.default_rng(CONFIG["seeds"][split] + 1)
    for subject, scenario, data, truth in scenarios(split):
        matrix, scores, scoreable = features(data, corruption, rng)
        scores["isolation_forest"] = -model.score_samples(matrix)
        batches.append((subject, scenario, truth[CONFIG["baselineDays"]:], scores, scoreable))
    return batches


def metrics(batches, name, threshold):
    truth = np.concatenate([entry[2] for entry in batches])
    predicted = np.concatenate([(entry[3][name] > threshold) & entry[4] for entry in batches])
    tp = int(np.sum(predicted & truth))
    fp = int(np.sum(predicted & ~truth))
    fn = int(np.sum(~predicted & truth))
    return {
        "precision": tp / (tp + fp) if tp + fp else 0,
        "recall": tp / (tp + fn) if tp + fn else 0,
        "f1": 2 * tp / (2 * tp + fp + fn) if tp + fp + fn else 0,
        "falseAlarmsPerCrewDay": fp / len(truth),
        "anomalousDays": int(truth.sum()), "crewDays": len(truth),
        "unscoredDays": sum(int((~entry[4]).sum()) for entry in batches),
    }


def train(output):
    train_features = np.concatenate([features(data)[0] for _, _, data, _ in scenarios("train")])
    model = IsolationForest(n_estimators=CONFIG["estimators"], random_state=CONFIG["seeds"]["train"],
                            n_jobs=1).fit(train_features)
    calibration = collect(model, "validation")
    thresholds = {}
    for name in calibration[0][3]:
        if name == "selected_app_rules":
            thresholds[name] = 0.5
            continue
        scores = np.concatenate([entry[3][name] for entry in calibration])
        options = np.quantile(scores, np.linspace(0.65, 0.997, 60))
        thresholds[name] = float(max(options, key=lambda x: (metrics(calibration, name, x)["f1"], x)))
    evaluations = {}
    for condition in ("clean", "missing", "corrupted"):
        batches = collect(model, "test", condition)
        evaluations[condition] = {
            scenario: {name: metrics([e for e in batches if scenario == "all" or e[1] == scenario], name, cutoff)
                       for name, cutoff in thresholds.items()}
            for scenario in ("all", *SHIFTS)
        }
    report = {
        "schemaVersion": 1, "sourceType": "SIMULATED", "isSynthetic": True,
        "purpose": "Experimental detection of injected synthetic shifts",
        "config": CONFIG, "thresholds": thresholds, "evaluation": evaluations,
    }
    output.mkdir(parents=True, exist_ok=True)
    with (output / "isolation-forest.pkl").open("wb") as file:
        pickle.dump({"estimator": model, "threshold": thresholds["isolation_forest"], "config": CONFIG}, file)
    (output / "evaluation.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    for condition, scores in evaluations.items():
        print(condition, {name: round(summary["f1"], 3) for name, summary in scores["all"].items()})
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/research")
    train(parser.parse_args().output)
