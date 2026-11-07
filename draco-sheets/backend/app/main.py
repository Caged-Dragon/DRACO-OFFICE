from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .routers import convert, health, stats

app = FastAPI(title="Draco Sheets backend", version="1.0.0", docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"], max_age=600)
app.include_router(health.router)
app.include_router(convert.router)
app.include_router(stats.router)
