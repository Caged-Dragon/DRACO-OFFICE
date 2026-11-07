from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from ..config import MAX_UPLOAD_BYTES
from ..services import convert as svc

router = APIRouter(prefix="/v1", tags=["convert"])


@router.post("/convert")
async def convert_file(file: UploadFile = File(...), to: str = Query(..., description="xlsx, ods, csv or pdf")) -> Response:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
    if not data:
        raise HTTPException(400, "The file is empty.")
    try:
        out, media = svc.convert(data, file.filename or "upload.xlsx", to)
    except svc.ConversionError as e:
        raise HTTPException(422, str(e)) from e
    stem = (file.filename or "workbook").rsplit(".", 1)[0]
    return Response(out, media_type=media, headers={"Content-Disposition": f'attachment; filename="{stem}.{to.lower().lstrip(".")}"'})
