from pathlib import Path
import pickle

import numpy as np
import pytest

from ml.ingest import FILES, ROOT, analyze, numeric, parse, verify
from ml.radiation import flags
from ml.train import CONFIG, features, scenarios, train


def test_source_integrity_and_original_units():
    study, name, sha, system = FILES[0]
    path = ROOT / "data/osdr/OSD-569_CBC_TRANSFORMED.csv"
    data = path.read_bytes()
    verify(data, sha)
    with pytest.raises(ValueError, match="SHA-256"):
        verify(data + b" ", sha)
    rows = parse(data, {"studyId": study, "sourceFile": name, "sourceType": "NASA_HUMAN"}, system)
    assert len(rows) == 560
    by_name = {row["measurement"]: row for row in rows if row["sampleId"] == "C001_whole-blood_L-3_cbc"}
    assert by_name["hematocrit"]["unit"] == "percent"
    assert by_name["hematocrit"]["referenceLow"] == 38.5
    assert by_name["hemoglobin"]["qualityStatus"] == "unit_unverified"
    assert by_name["absolute_lymphocytes"]["unit"] == "cells_per_microliter"
    assert by_name["white_blood_cell_count"]["unit"] == "thousand_per_microliter"


@pytest.mark.parametrize(("raw", "status"), [("", "missing"), ("NA", "missing"), ("inf", "invalid"), ("<5", "invalid")])
def test_null_values(raw, status):
    assert numeric(raw) == (None, status)


def test_matched_baseline_and_log_scale():
    row = {"studyId": "OSD-656", "sourceFile": "source", "specimen": "urine", "measurement": "marker",
           "unit": "npq", "subjectId": "C001", "studyGroup": None, "qualityStatus": "accepted"}
    pre = {**row, "value": 12, "phase": "preflight", "timepoint": "L-3"}
    post = {**row, "value": 14, "phase": "postflight", "timepoint": "R+1"}
    other = {**pre, "value": 100, "studyId": "OSD-575"}
    missing = {**pre, "value": None, "qualityStatus": "missing"}
    summaries = analyze([pre, post, other, missing])
    assert post["comparison"] == {"baselineN": 1, "baselineMedian": 12, "absoluteChange": 2, "percentChange": None}
    assert summaries[0]["n"] == 1 and summaries[0]["total"] == 2


def test_mouse_ids_and_environmental_flags():
    data = b"Sample Name,cortical_thickness_millimeter\nRR1_BSL_M1_CorticalFemur,0.2\n"
    source = {"studyId": "OSD-804", "sourceFile": "bone.csv", "sourceType": "NASA_ANIMAL"}
    rows = parse(data, source, "skeletal")
    analyze(rows)
    assert rows[0]["comparison"] is None
    assert rows[0]["subjectId"] == "RR1_BSL_M1"
    samples = [{"timestamp": index, "value": 4 + index % 3, "qualityStatus": "accepted"} for index in range(60)]
    samples[-1]["value"] = 200
    samples[-2].update(value=None, qualityStatus="missing")
    flags(samples)
    assert samples[-1]["environmentalAnomaly"]["flagged"]
    assert "environmentalAnomaly" not in samples[0] and "environmentalAnomaly" not in samples[-2]


def test_temporal_and_subject_splits():
    splits = [list(scenarios(split)) for split in CONFIG["seeds"]]
    ids = [row[0] for split in splits for row in split]
    assert len(ids) == len(set(ids))
    fingerprints = {row[2].tobytes() for split in splits for row in split}
    assert len(fingerprints) == len(ids)
    _, _, sample, labels = splits[-1][1]
    assert not labels[:CONFIG["baselineDays"]].any()
    edited = sample.copy()
    edited[-1] += 10
    before, scores, _ = features(sample)
    after, updated, _ = features(edited)
    np.testing.assert_array_equal(before[:-1], after[:-1])
    np.testing.assert_array_equal(scores["rolling_median"][:-1], updated["rolling_median"][:-1])


def test_training_and_saved_inference(tmp_path: Path):
    a, b = tmp_path / "a", tmp_path / "b"
    assert train(a) == train(b)
    matrix, _, _ = features(next(scenarios("test"))[2])
    with (a / "isolation-forest.pkl").open("rb") as file:
        left = pickle.load(file)
    with (b / "isolation-forest.pkl").open("rb") as file:
        right = pickle.load(file)
    np.testing.assert_array_equal(left["estimator"].score_samples(matrix), right["estimator"].score_samples(matrix))
