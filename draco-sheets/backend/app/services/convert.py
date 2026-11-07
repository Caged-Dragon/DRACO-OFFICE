"""Convert spreadsheets between xlsx / xls / ods / csv / pdf with LibreOffice (headless)."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from ..config import CONVERT_TIMEOUT_S, SOFFICE

# target extension -> (LibreOffice filter, media type)
TARGETS: dict[str, tuple[str, str]] = {
    "xlsx": ("xlsx:Calc MS Excel 2007 XML", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "ods": ("ods", "application/vnd.oasis.opendocument.spreadsheet"),
    "csv": ("csv:Text - txt - csv (StarCalc):44,34,76,1", "text/csv"),
    "pdf": ("pdf:calc_pdf_Export", "application/pdf"),
}
SOURCES = {".xlsx", ".xls", ".xlsm", ".ods", ".csv", ".tsv", ".fods"}


class ConversionError(RuntimeError):
    pass


def available() -> bool:
    return shutil.which(SOFFICE) is not None


def convert(data: bytes, filename: str, target: str) -> tuple[bytes, str]:
    """Return (converted bytes, media type). Raises ConversionError with a user-readable message."""
    target = target.lower().lstrip(".")
    if target not in TARGETS:
        raise ConversionError(f"Unsupported target format '{target}'. Use one of: {', '.join(sorted(TARGETS))}.")
    suffix = Path(filename).suffix.lower()
    if suffix not in SOURCES:
        raise ConversionError(f"Unsupported source file type '{suffix or 'none'}'.")
    if not available():
        raise ConversionError("LibreOffice is not installed on the server.")
    flt, media = TARGETS[target]
    with tempfile.TemporaryDirectory(prefix="draco-") as tmp:
        src = Path(tmp) / f"input{suffix}"
        src.write_bytes(data)
        out = Path(tmp) / "out"
        out.mkdir()
        profile = Path(tmp) / "profile"  # private profile: concurrent conversions do not lock each other
        cmd = [SOFFICE, f"-env:UserInstallation=file://{profile}", "--headless", "--norestore", "--convert-to", flt, "--outdir", str(out), str(src)]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=CONVERT_TIMEOUT_S)
        except subprocess.TimeoutExpired as e:
            raise ConversionError("The conversion took too long.") from e
        except subprocess.CalledProcessError as e:
            raise ConversionError("The file could not be converted.") from e
        produced = sorted(out.iterdir())
        if not produced:
            raise ConversionError("The file could not be converted.")
        return produced[0].read_bytes(), media
