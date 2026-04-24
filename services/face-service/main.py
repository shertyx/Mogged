import hashlib
import os
import joblib
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-service"}


@app.post("/photos/analyze")
async def analyze_photo(
    photo_id: str = Form(...),
    file: UploadFile = File(...),
):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()

    try:
        result = _pipeline.analyse_photo(contents, hash_md5, ext, photo_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result
