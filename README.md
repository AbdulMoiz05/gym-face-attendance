# Face attendance (standalone)

This folder is a **separate project** extracted from the Gym Management monorepo: person registration, multi-angle face enrollment (InsightFace + FAISS), live face recognition check-in, attendance logs, and unknown-face snapshots.

## Layout

| Part | Stack | Port (default) |
|------|--------|----------------|
| `backend/` | Django + DRF + JWT | 8000 |
| `ai-service/` | FastAPI + InsightFace + FAISS | 8001 |
| `frontend/` | Vite + React | 5174 |

## Quick start

1. **Backend**

   ```bash
   cd backend
   cp .env.example .env
   # Edit .env — set SECRET_KEY and AI_SERVICE_SECRET (match ai-service)
   py -3.10 -m pip install -r requirements.txt
   py -3.10 manage.py migrate
   py -3.10 manage.py createsuperuser
   py -3.10 manage.py runserver 0.0.0.0:8000
   ```

2. **AI service** (Python 3.10+ recommended; InsightFace/onnxruntime can be heavy to install)

   ```bash
   cd ai-service
   cp .env.example .env
   # Set AI_SERVICE_SECRET to the same value as backend AI_SERVICE_SECRET
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8001
   ```

3. **Frontend**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5174`. Log in with the superuser you created. Add people under **People**, open a profile → **Register face**, then use **Attendance** for live recognition.

## Environment

- Backend `AI_SERVICE_SECRET` must match `AI_SERVICE_SECRET` in the AI service so `store-face-embedding`, `mark-attendance`, and `face-embeddings` work.
- Frontend optional env (see `frontend/.env.example` if present): `VITE_API_URL`, `VITE_AI_SERVICE_URL` (defaults target localhost).

## Notes

- This app does **not** depend on the parent `Gym_Management` repo at runtime; copy or deploy this folder alone.
- Face models download on first InsightFace use; ensure disk and RAM are sufficient (`buffalo_l` is configurable in `ai-service/config.py`).
- FAISS index files live under `ai-service/data/` after the first registrations.
