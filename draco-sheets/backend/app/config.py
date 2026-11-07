import os

MAX_UPLOAD_BYTES = int(os.getenv("DRACO_MAX_UPLOAD_MB", "25")) * 1024 * 1024
CONVERT_TIMEOUT_S = int(os.getenv("DRACO_CONVERT_TIMEOUT_S", "90"))
SOFFICE = os.getenv("DRACO_SOFFICE", "soffice")
# Comma-separated origins allowed to call the API from a browser, e.g. "https://sheets.example.com".
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("DRACO_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4174").split(",") if o.strip()]
