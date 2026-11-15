# Reproduce locally on Windows PowerShell

From the repository root with Node 24 and Python 3.13 installed:

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/requirements.txt
.\.venv\Scripts\python.exe -m ml.ingest
.\.venv\Scripts\python.exe -m ml.train
.\.venv\Scripts\python.exe -m pytest -q
npm test
npm run build
npm run dev
```

Ingestion writes data/research/research.json and caches downloaded CSVs in data/research/raw. Checksum mismatches mark a source unavailable and surface an error exit when a priority study file is unavailable. Use the ingestion --cache and --output options to build isolated snapshots. Training writes evaluation.json and isolation-forest.pkl to data/research by default. Use --output to override. Load pickle artifacts exclusively from a trusted local training run. The Node server consumes only JSON files; restart after regenerating. After ingestion, `npm run research:snapshot` refreshes `public/research/hematocrit.json`, the copy of the hematocrit comparison that the live link (no server) shows. Override artifact paths with RESEARCH_FILE and MODEL_REPORT when needed.

Sign-in uses demo accounts with no password, and data is kept in local SQLite. Keep deployment limited to the prototype environment. Full npm audit flagged existing test tooling dependencies. npm audit --omit=dev reported zero findings.
