import numpy as np
import pandas as pd

from ml.radiation_experiment import evaluate, prepare, score, series_groups


def test_future_mutation_cannot_change_earlier_scores():
    index = pd.date_range("2024-01-01", periods=500, freq="min", tz="UTC")
    original = pd.Series(10 + np.sin(np.arange(500) / 7), index=index)
    edited = original.copy()
    edited.iloc[375:] += 100
    before, _ = score(original, 250, 20 * 60)
    after, _ = score(edited, 250, 20 * 60)
    pd.testing.assert_frame_equal(before.loc[:index[374]], after.loc[:index[374]])


def test_series_never_mix_instruments_quantities_or_units():
    row = {"instrumentId": "DosTel1", "measurement": "absorbed_dose_rate", "unit": "microgray/hour",
           "timestamp": "2024-01-01T00:00:00", "value": 1, "qualityStatus": "accepted"}
    records = [row, {**row, "instrumentId": "CRaTER-D1D2"},
               {**row, "measurement": "dose_equivalent_rate"}, {**row, "unit": "other"}]
    assert [len(group) for group in series_groups(records).values()] == [1, 1, 1, 1]


def test_missing_invalid_and_cross_window_duplicates_are_excluded():
    row = {"timestamp": "2024-01-01T00:00:00", "value": 1, "qualityStatus": "accepted"}
    rows = [row, {**row, "timestamp": "2024-01-01T00:00:00+00:00"},
            {**row, "timestamp": "2024-01-01T00:01:00", "qualityStatus": "missing", "value": None},
            {**row, "timestamp": "2024-01-01T00:02:00", "qualityStatus": "invalid"},
            {**row, "timestamp": "2024-01-01T00:03:00"}]
    clean, coverage = prepare(rows)
    assert clean.tolist() == [1]
    assert coverage["duplicateTimestampRows"] == 2
    assert coverage["qualityCounts"] == {"accepted": 3, "missing": 1, "invalid": 1}
    assert evaluate(("DosTel1", "absorbed_dose_rate", "microgray/hour"), rows, [])["status"] == "insufficient_history"


def test_gap_resets_trailing_history():
    first = pd.date_range("2024-01-01", periods=180, freq="min", tz="UTC")
    second = pd.date_range("2024-01-02", periods=180, freq="min", tz="UTC")
    clean = pd.Series(10 + np.sin(np.arange(360) / 7), index=first.append(second))
    scores, _ = score(clean, 150, 20 * 60)
    assert not scores.index.isin(second[:5]).any()
    assert second[5] in scores.index
