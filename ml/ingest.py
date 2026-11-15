"""Build the local research bundle from pinned NASA OSDR releases."""
import argparse
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
import re
from statistics import mean, median, stdev
from urllib.parse import urlencode

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://osdr.nasa.gov"
TERMS = "https://science.nasa.gov/reference/osdr-help-terms-and-conditions/"
FILES = [
    ("OSD-569", "LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv",
     "32e4f9c97d3b636b5d5c2e72dab8c4d3319dee64c437508b092dad04603b2b8f", "cardiovascular"),
    ("OSD-575", "LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv",
     "5eb1e7f025dd8443a9e70111e62bc32afae3432753024489c5c013e401d709d9", "metabolic"),
    ("OSD-575", "LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv",
     "fdba6c3ce45401c12ca9b699fa375303793959aa0391e2f3c722f354d9cfc75c", "cardiovascular"),
    ("OSD-656", "LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv",
     "f81b6dff9c34accab6dffe7a0b2970854f2f0b8d2712e92cfd0e91e6bb59c94a", "immune"),
    ("OSD-804", "LSDS-130_microCT_Cahill_microCT_TRANSFORMED.csv",
     "499541f23b4c3afcd39762456d98cb3046e1f56467fdf8ec5987f684534ccf0c", "skeletal"),
]
BONE_COLUMNS = {
    "cortical_thickness_millimeter": ("cortical_thickness", "millimeter"),
    "trabecular_number_per_millimeter": ("trabecular_number", "per_millimeter"),
    "trabecular_separation_millimeter": ("trabecular_separation", "millimeter"),
    "trabecular_thickness_millimeter": ("trabecular_thickness", "millimeter"),
}


def verify(data, expected):
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("SHA-256 mismatch")


def numeric(raw):
    if raw.strip().lower() in {"", "na", "n/a", "nan"}:
        return None, "missing"
    try:
        value = float(raw)
    except ValueError:
        return None, "invalid"
    return (value, "accepted") if math.isfinite(value) else (None, "invalid")


def columns(frame, animal):
    for column in frame.columns:
        if animal:
            if column in BONE_COLUMNS:
                yield column, *BONE_COLUMNS[column], None, None
            continue
        match = re.fullmatch(r"(.+?)_(value|concentration)(?:_(.+))?", column)
        if match:
            measure, _, unit = match.groups()
            suffix = "_" + unit if unit else ""
            upper = f"{measure}_range_max{suffix}"
            if measure == "alt":
                upper = "alt_max_units_per_liter"
            yield column, measure, unit, f"{measure}_range_min{suffix}", upper


def parse(data, source, default_system):
    frame = pd.read_csv(BytesIO(data), dtype=str, keep_default_na=False, encoding="utf-8-sig")
    animal = source["sourceType"] == "NASA_ANIMAL"
    fields = list(columns(frame, animal))
    if not fields or "Sample Name" not in frame:
        raise ValueError("Unrecognized assay columns")
    records = []
    seen = set()
    for row in frame.to_dict("records"):
        sample = row["Sample Name"]
        if sample in seen:
            raise ValueError(f"Duplicate sample ID: {sample}")
        seen.add(sample)
        if animal:
            experiment, group, subject, specimen = sample.split("_", 3)
            point, phase, day = None, None, None
            subject = f"{experiment}_{group}_{subject}"
        else:
            match = re.fullmatch(r"(C\d+)_([^_]+)_(L-\d+|R\+\d+)(?:_cbc)?", sample)
            if not match:
                raise ValueError(f"Unrecognized sample ID: {sample}")
            subject, specimen, point = match.groups()
            phase = "preflight" if point.startswith("L") else "postflight"
            day = int(point[1:])
            group = None
        for column, measurement, unit, low, high in fields:
            value, quality = numeric(row[column])
            note = None
            if measurement == "hemoglobin":
                note = "NASA transformed header labels hemoglobin as percent. Unit requires verification."
                if quality == "accepted":
                    quality = "unit_unverified"
            system = default_system
            if default_system == "cardiovascular" and any(
                cell in measurement for cell in
                ("white_blood_cell", "lymphocyte", "basophil", "eosinophil", "neutrophil", "monocyte")
            ):
                system = "immune"
            records.append({
                "observationId": f"{source['studyId']}:{source['sourceFile']}:{sample}:{column}",
                **source, "sampleId": sample, "subjectId": subject, "specimen": specimen,
                "studyGroup": group, "measurement": measurement, "sourceColumn": column,
                "value": value, "unit": unit, "timepoint": point, "phase": phase,
                "relativeDay": day, "timestamp": None, "anatomicalSystem": system,
                "qualityStatus": quality, "qualityNote": note, "rawValue": row[column],
                "referenceLow": numeric(row.get(low, ""))[0],
                "referenceHigh": numeric(row.get(high, ""))[0],
                "isSynthetic": False,
            })
    return records


def analyze(records):
    baselines, summaries = {}, {}
    for row in records:
        key = tuple(row[k] for k in ("studyId", "sourceFile", "specimen", "measurement", "unit"))
        subject_key = (*key, row["subjectId"])
        row["comparison"] = None
        accepted = row["qualityStatus"] == "accepted"
        if accepted and row["phase"] == "preflight":
            baselines.setdefault(subject_key, []).append(row["value"])
        if row["phase"] == "postflight" and accepted:
            row["comparison"] = {"baselineN": 0, "baselineMedian": None, "absoluteChange": None,
                                 "percentChange": None}
        group_key = (*key, row["timepoint"], row["studyGroup"])
        group = summaries.setdefault(group_key, {"total": 0, "subjects": set(), "values": []})
        group["total"] += 1
        if accepted:
            group["values"].append(row["value"])
            group["subjects"].add(row["subjectId"])
    for row in records:
        if row["comparison"] is None:
            continue
        key = tuple(row[k] for k in ("studyId", "sourceFile", "specimen", "measurement", "unit", "subjectId"))
        values = baselines.get(key)
        if values:
            center = median(values)
            delta = row["value"] - center
            row["comparison"] = {
                "baselineN": len(values), "baselineMedian": center, "absoluteChange": delta,
                "percentChange": 100 * delta / center if center > 0 and row["unit"] not in {None, "npq"} else None,
            }
    result = []
    for key, group in summaries.items():
        values = group["values"]
        result.append({
            **dict(zip(("studyId", "sourceFile", "specimen", "measurement", "unit", "timepoint", "studyGroup"), key)),
            "total": group["total"], "n": len(values), "subjectCount": len(group["subjects"]),
            "median": median(values) if values else None, "mean": mean(values) if values else None,
            "min": min(values) if values else None, "max": max(values) if values else None,
            "sampleSd": stdev(values) if len(values) > 1 else None,
        })
    return result


def get(url):
    response = requests.get(url, timeout=25)
    response.raise_for_status()
    return response


def build(output, cache):
    studies, observations = [], []
    metadata = {}
    cache.mkdir(parents=True, exist_ok=True)
    for study, name, checksum, system in FILES:
        animal = study == "OSD-804"
        source = {
            "studyId": study, "sourceFile": name, "sha256": checksum,
            "studyUrl": f"{BASE}/bio/repo/data/studies/{study}",
            "sourceUrl": f"{BASE}/geode-py/ws/studies/{study}/download?"
                         + urlencode({"source": "datamanager", "file": name}),
            "sourceType": "NASA_ANIMAL" if animal else "NASA_HUMAN",
            "species": "Mus musculus" if animal else "Homo sapiens",
            "reuseTermsUrl": TERMS, "intendedUse": "descriptive research",
            "sourceUpdatedAt": None, "retrievedAt": None,
        }
        local = ROOT / "data/osdr/OSD-569_CBC_TRANSFORMED.csv" if study == "OSD-569" else cache / name
        receipt = cache / f"{name}.json"
        try:
            if study not in metadata:
                try:
                    metadata[study] = get(f"{BASE}/osdr/data/osd/files/{study.removeprefix('OSD-')}").json()
                except (requests.RequestException, ValueError):
                    metadata[study] = {}
            entries = metadata[study].get("studies", {}).get(study, {}).get("study_files", [])
            entry = next((item for item in entries if item["file_name"] == name), None)
            if entry:
                source["sourceUpdatedAt"] = datetime.fromtimestamp(entry["date_updated"], timezone.utc).isoformat()
            if local.is_file():
                data = local.read_bytes()
                if receipt.is_file():
                    source["retrievedAt"] = json.loads(receipt.read_text())["retrievedAt"]
            else:
                data = get(source["sourceUrl"]).content
                source["retrievedAt"] = datetime.now(timezone.utc).isoformat()
            verify(data, checksum)
            rows = parse(data, source, system)
            if not local.is_file() and study != "OSD-569":
                receipt.write_text(json.dumps({"retrievedAt": source["retrievedAt"]}), encoding="utf-8")
                local.write_bytes(data)
            observations.extend(rows)
            quality = pd.Series([row["qualityStatus"] for row in rows]).value_counts().to_dict()
            studies.append({**source, "status": "available", "count": len(rows), "quality": quality})
        except (OSError, ValueError, requests.RequestException) as exc:
            studies.append({**source, "status": "unavailable", "reason": str(exc), "count": 0})
    from ml.radiation import load_radiation
    radiation_sources, radiation = load_radiation(cache)
    studies.extend(radiation_sources)
    summaries = analyze(observations)
    observations.extend(radiation)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps({
        "schemaVersion": 1, "studies": studies, "observations": observations, "summaries": summaries,
    }, allow_nan=False), encoding="utf-8")
    temporary.replace(output)
    for study in studies:
        print(study["studyId"], study["sourceFile"], study["status"], study["count"], study.get("reason", ""))
    return studies


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/research/research.json")
    parser.add_argument("--cache", type=Path, default=ROOT / "data/research/raw")
    args = parser.parse_args()
    studies = build(args.output, args.cache)
    if any(row["status"] != "available" for row in studies if row["studyId"] in {"OSD-569", "OSD-575"}):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
