"""NASA RadLab environmental telemetry and chronological robust comparison."""
import csv
from datetime import datetime, timezone
import hashlib
import io
from statistics import median
from urllib.parse import urlencode

import requests

from ml.ingest import TERMS, numeric

API = "https://visualization.osdr.nasa.gov/radlab/api/"
QUANTITIES = {"absorbed_dose_rate": "microgray/hour", "dose_equivalent_rate": "microsievert/hour"}
WINDOWS = [
    ("DosTel1", "2022-04-01", "2022-04-04"),
    ("CRaTER", "2022-04-01", "2022-04-04"),
    ("MSL-RAD-Surface", "2024-01-01", "2024-01-08"),
]


def flags(rows):
    ordered = sorted(rows, key=lambda row: row["timestamp"])
    split = len(ordered) // 2
    calibration = [row["value"] for row in ordered[:split] if row["qualityStatus"] == "accepted"]
    if len(calibration) < 20:
        return
    center = median(calibration)
    mad = median(abs(value - center) for value in calibration)
    if mad == 0:
        return
    for row in ordered[split:]:
        if row["qualityStatus"] == "accepted":
            score = abs(row["value"] - center) / (1.4826 * mad)
            row["environmentalAnomaly"] = {"robustDeviation": score, "flagged": score > 6,
                                           "calibrationN": len(calibration)}


def load_radiation(cache, windows=WINDOWS, *, exact_ids=False, legacy_flags=True):
    sources, records = [], []
    for instrument, start, end in windows:
        filename = f"radlab-{instrument}-{start}-{end}.csv"
        instrument_field = "instrument_id" if exact_ids or instrument == "MSL-RAD-Surface" else "instrument"
        url = API + "?" + urlencode([
            (instrument_field, instrument), ("timestamp>", start), ("timestamp<", end),
            *[(key, "") for key in (*QUANTITIES, "module", "spacecraft", "trajectory")],
        ])
        source = {
            "studyId": "RADLAB", "studyUrl": "https://visualization.osdr.nasa.gov/radlab/gui/data-api/",
            "sourceFile": filename, "sourceUrl": url, "sourceType": "NASA_ENVIRONMENT", "species": None,
            "sha256": None, "retrievedAt": None, "reuseTermsUrl": TERMS,
            "intendedUse": "instrument-specific environmental context",
            "instrumentIds": ["CRaTER-D1D2" if instrument == "CRaTER" else instrument],
        }
        rows = []
        try:
            file = cache / filename
            if file.is_file():
                data = file.read_bytes()
                source["retrievedAt"] = datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat()
            else:
                response = requests.get(url, timeout=25)
                response.raise_for_status()
                data = response.content
                source["retrievedAt"] = datetime.now(timezone.utc).isoformat()
            source["sha256"] = hashlib.sha256(data).hexdigest()
            reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig"), newline=None))
            required = {"timestamp", "instrument_id", "spacecraft", "trajectory", "module", *QUANTITIES}
            if not required.issubset(reader.fieldnames or []):
                raise ValueError("Unexpected RadLab CSV header")
            groups = {}
            duplicates = {}
            for raw in reader:
                stamp = datetime.fromisoformat(raw["timestamp"])
                sensor = raw["instrument_id"]
                for measure, unit in QUANTITIES.items():
                    value, quality = numeric(raw[measure])
                    if value is not None and value < 0:
                        value, quality = None, "invalid"
                    key = f"RADLAB:{sensor}:{stamp.isoformat()}:{measure}"
                    previous = duplicates.setdefault(key, [])
                    if previous:
                        quality = "invalid"
                        previous[0]["qualityStatus"] = "invalid"
                        previous[0]["qualityNote"] = "Duplicate instrument timestamp"
                    row = {
                        **source, "observationId": f"{key}:{len(previous)}", "instrumentId": sensor,
                        "mission": raw["spacecraft"], "location": raw["module"] or raw["trajectory"],
                        "species": None, "subjectId": None, "timepoint": None, "timestamp": stamp.isoformat(),
                        "measurement": measure, "unit": unit, "value": value, "rawValue": raw[measure],
                        "anatomicalSystem": "whole-body", "qualityStatus": quality, "isSynthetic": False,
                        "environmentalAnomaly": None,
                    }
                    if previous:
                        row["qualityNote"] = "Duplicate instrument timestamp"
                    previous.append(row)
                    rows.append(row)
                    groups.setdefault((sensor, measure), []).append(row)
            if not any(row["qualityStatus"] == "accepted" for row in rows):
                raise ValueError("No measurements in the selected time window")
            source["instrumentIds"] = sorted({sensor for sensor, _ in groups})
            for group in groups.values() if legacy_flags else ():
                flags(group)
            if not file.is_file():
                file.write_bytes(data)
            quality = {status: sum(row["qualityStatus"] == status for row in rows)
                       for status in ("accepted", "missing", "invalid")}
            sources.append({**source, "status": "available", "count": len(rows), "quality": quality})
            records.extend(rows)
        except (requests.RequestException, ValueError, OSError) as exc:
            sources.append({**source, "status": "unavailable", "count": 0, "reason": str(exc)})
    return sources, records
