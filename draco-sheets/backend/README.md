# Draco Sheets backend (Python / FastAPI)

An optional service for work the browser should not do:

| Endpoint | What it does |
| --- | --- |
| `GET /health` | Status and whether LibreOffice is available |
| `POST /v1/convert?to=xlsx\|ods\|csv\|pdf` | Convert an uploaded workbook (xlsx, xls, xlsm, ods, csv, tsv) with LibreOffice |
| `POST /v1/stats/describe` `regression` `ttest` `anova` `correlation` `forecast` | Analysis ToolPak statistics with numpy / scipy on very large ranges |

Run: `pip install -r requirements.txt && uvicorn app.main:app --port 8000` (docs at `/docs`), or `docker build -t draco-backend . && docker run -p 8000:8000 draco-backend`.
Test: `python -m pytest tests`.
Settings (environment): `DRACO_ALLOWED_ORIGINS` (comma-separated browser origins), `DRACO_MAX_UPLOAD_MB`, `DRACO_CONVERT_TIMEOUT_S`, `DRACO_SOFFICE`.
The site works without it. To use it, set `VITE_API_URL` on the front end.
The service has no sign-in of its own, so host it privately or put it behind your proxy before exposing it.
