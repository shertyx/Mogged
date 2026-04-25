import hashlib
import os
import httpx
import joblib
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from dotenv import load_dotenv

from pipeline import AnalysisPipeline
from db import DBClient
from storage import StorageClient

load_dotenv()

app = FastAPI()

_db = DBClient(os.environ["POSTGRES_DSN"])
_storage = StorageClient(
    endpoint=os.environ["MINIO_ENDPOINT"],
    access_key=os.environ["MINIO_ROOT_USER"],
    secret_key=os.environ["MINIO_ROOT_PASSWORD"],
    bucket=os.environ["MINIO_BUCKET"],
)

_model_path = os.environ.get("MODEL_PATH", "/app/models/model_v1.joblib")
_model = joblib.load(_model_path) if os.path.exists(_model_path) else None

_pipeline = AnalysisPipeline(db=_db, storage=_storage, model=_model)

_user_service_url = os.environ.get("USER_SERVICE_URL", "http://user-service:8082")


@app.get("/health")
@app.get("/face/health")
def health():
    return {"status": "ok", "service": "face-service"}


@app.post("/face/photos/analyze")
@app.post("/photos/analyze")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
):
    """Upload photo and register in user-service — no ML analysis."""
    user_id = request.headers.get("X-User-ID", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing user id")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    s3_key = _storage.upload_photo(contents, hash_md5, ext)

    async with httpx.AsyncClient() as client:
        reg_resp = await client.post(
            f"{_user_service_url}/user/photos/register",
            json={"s3_key": s3_key, "hash": hash_md5},
            headers={"X-User-ID": user_id},
        )
        if reg_resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"RegisterUpload failed: {reg_resp.text}")
        photo_id = reg_resp.json()["photo_id"]

    signed_url = _storage.get_signed_url(s3_key)
    return {"photo_id": photo_id, "s3_key": s3_key, "signed_url": signed_url}


@app.post("/face/photos/analyze-stored")
@app.post("/photos/analyze-stored")
async def analyze_stored_photo(
    request: Request,
    photo_id: str = Form(...),
    s3_key: str = Form(...),
):
    """Run ML analysis on a photo already stored in MinIO."""
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    user_id = request.headers.get("X-User-ID", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing user id")

    try:
        contents = _storage.download_photo(s3_key)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Photo not found in storage: {e}")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = s3_key.rsplit(".", 1)[-1].lower() if "." in s3_key else "jpg"

    try:
        result = _pipeline.analyse_photo(contents, hash_md5, ext, photo_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    async with httpx.AsyncClient() as client:
        score_resp = await client.patch(
            f"{_user_service_url}/user/photos/score",
            json={
                "photo_id": photo_id,
                "score": result["chad_score"],
                "features": result["features"],
            },
        )
        if score_resp.status_code not in (200, 201, 204):
            raise HTTPException(status_code=502, detail=f"UpdatePhotoScore failed: {score_resp.text}")

    return {**result, "photo_id": photo_id}
