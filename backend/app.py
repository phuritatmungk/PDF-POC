import json
import os
import uuid
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR

from extractor import extract_fields

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

RENDER_SCALE = 2  # 72 dpi × 2 = 144 dpi

app = FastAPI(title="PDF OCR POC")

_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_engine = PaddleOCR(
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="th_PP-OCRv5_mobile_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)


def render_pdf_pages(pdf_path: Path, max_pages: int | None = None):
    """Yield (1-based page_number, PIL.Image) using pypdfium2 (fast, no ML)."""
    doc = pdfium.PdfDocument(str(pdf_path))
    total = len(doc)
    limit = min(total, max_pages) if max_pages else total
    for i in range(limit):
        page = doc[i]
        bitmap = page.render(scale=RENDER_SCALE)
        pil_img = bitmap.to_pil().convert("RGB")
        page.close()
        yield i + 1, pil_img
    doc.close()


def run_ocr(img):
    """Run PaddleOCR 3.x on a PIL image; return detections in our schema."""
    arr = np.array(img)
    results = ocr_engine.predict(arr)
    detections = []
    if not results:
        return detections
    for res in results:
        rec_texts = res.get("rec_texts", []) or []
        rec_scores = res.get("rec_scores", []) or []
        rec_polys = res.get("rec_polys", []) or res.get("dt_polys", []) or []
        for text, score, poly in zip(rec_texts, rec_scores, rec_polys):
            detections.append(
                {
                    "text": text,
                    "confidence": float(score),
                    "box": [[float(x), float(y)] for x, y in poly],
                }
            )
    return detections


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    max_pages: int = Query(default=50, ge=1, le=500, description="Max pages to process"),
):
    filename = file.filename or "upload.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    pdf_bytes = await file.read()
    saved_path = UPLOAD_DIR / f"{uuid.uuid4().hex}_{filename}"
    saved_path.write_bytes(pdf_bytes)

    try:
        pages = []
        for page_num, img in render_pdf_pages(saved_path, max_pages=max_pages):
            pages.append(
                {
                    "page": page_num,
                    "width": img.width,
                    "height": img.height,
                    "detections": run_ocr(img),
                }
            )
        return {"pages": pages, "fields": extract_fields(pages)}
    finally:
        saved_path.unlink(missing_ok=True)
