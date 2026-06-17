# Gym SaaS – AI Microservice

Face registration (KYC-style) and real-time recognition using **InsightFace** (ArcFace 512-d) and **FAISS** (cosine similarity). Production-ready, CPU/GPU optional.

## Stack

- **FastAPI** – async endpoints
- **InsightFace** – RetinaFace detection + ArcFace 512-d embeddings (no retraining)
- **FAISS** – IndexFlatIP (cosine), persisted to disk, reload on startup
- **Django** – store embeddings, mark attendance (REST)

## Setup

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env    # set DJANGO_API_URL, AI_SERVICE_SECRET
uvicorn main:app --reload --port 8001
```

Set in Django `.env`: `AI_SERVICE_SECRET` (same value as in ai-service).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health, FAISS count, model loaded |
| POST | `/register-face/` | KYC registration: send samples, then `is_final=true` to save & update FAISS |
| POST | `/recognize-face/` | Single image (JSON `image_b64` or multipart `file`) → member_id + confidence; marks attendance in Django |

### Register flow

- Frontend sends multiple images (e.g. 5 per pose × 5 steps).
- Each request: `{ member_id, step?, image_b64, is_final }`.
- Quality checks: single face, blur, brightness.
- On `is_final=true`: average embeddings, POST to Django `store-face-embedding`, add to FAISS, persist index.

### Recognize flow

- POST one image → extract embedding → FAISS search (top-1).
- If similarity ≥ `RECOGNITION_SIMILARITY_THRESHOLD`: return `{ recognized: true, member_id, confidence }` and call Django `mark-attendance` (cooldown applied).

## Real-time speed (detect → recognize fast)

For real-time gates (face detect hotey hi recognize, bbox + member_id), the service is tuned for low latency:

- **Response first**: Recognition result and `bbox` are returned immediately; attendance is marked in the **background** so the client is not blocked by Django.
- **First face only**: With `REALTIME_FIRST_FACE_ONLY=true` (default), the **first/best face** in the frame is used (no “exactly one face” check), so multiple people in frame still get one person recognized quickly.
- **Smaller detection size**: `DET_SIZE=320` (default) runs detection faster than 640; set `DET_SIZE=640` if you need higher accuracy.
- **Image downscale**: Images larger than `RECOGNITION_MAX_IMAGE_DIM` (default 640) are downscaled before inference to speed decode and model run. Set to `0` to disable.

Optional env: `INSIGHTFACE_PROVIDER=CUDA` for GPU, and `INSIGHTFACE_MODEL=buffalo_s` for faster (slightly less accurate) inference.

## Threshold tuning

- **RECOGNITION_SIMILARITY_THRESHOLD** (default 0.6): higher = fewer false positives, more false negatives. Typical range 0.5–0.75.
- **FACE_CONFIDENCE_THRESHOLD** (default 0.5): detection confidence.
- **BLUR_THRESHOLD**: Laplacian variance; increase to allow more blur.
- **ATTENDANCE_COOLDOWN_HOURS** (Django): hours before same member can be marked again (default 4).

## Project structure

```
ai-service/
  main.py           # FastAPI app, lifespan (load FAISS), /health
  config.py         # Env-based config
  models/           # Pydantic schemas
  services/         # face_detector, face_recognizer, faiss_index, liveness
  routers/          # register.py, recognize.py
  utils/            # image, django_client
  data/             # faiss_index.bin, faiss_member_mapping.json (created at runtime)
```

## Example responses

**POST /register-face/** (sample accepted):
```json
{ "success": true, "message": "Sample accepted", "step": 1, "samples_collected": 3 }
```

**POST /register-face/** (final):
```json
{ "success": true, "message": "Face registered", "samples_collected": 26 }
```

**POST /recognize-face/** (recognized):
```json
{ "recognized": true, "member_id": "G1M0001", "confidence": 0.82, "attendance_marked": true }
```

**POST /recognize-face/** (not recognized):
```json
{ "recognized": false, "error": "no_face" }
```

**GET /health**:
```json
{ "status": "ok", "service": "ai-service", "faiss_loaded": true, "faiss_count": 12, "model_loaded": true }
```
