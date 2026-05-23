# Backend — PDF OCR POC

FastAPI + PaddleOCR + PyMuPDF.

## Setup (Windows, local)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

First run will download PaddleOCR English models (~10MB) to `~/.paddleocr/`.

## Run

```bash
uvicorn app:app --reload --port 8000
```

## Endpoints

- `GET /health` → `{"status": "ok"}`
- `POST /ocr` (multipart `file`) → `{"pages": [{"page", "width", "height", "detections": [{"text", "confidence", "box"}]}]}`

`box` is a 4-point polygon `[[x1,y1],[x2,y2],[x3,y3],[x4,y4]]` in pixel coordinates of the rendered page at 200 DPI. `width`/`height` are the rendered page size — use these to scale boxes to your frontend display size.
