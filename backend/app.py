import uuid
from pathlib import Path

import numpy as np
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Pre-download Docling models to a local dir (avoids huggingface_hub symlink issue on Windows).
DOCLING_MODELS_DIR = Path(__file__).parent / ".docling_models"
DOCLING_MODELS_DIR.mkdir(exist_ok=True)
DOCLING_ARTIFACTS_PATH = StandardPdfPipeline.download_models_hf(
    local_dir=DOCLING_MODELS_DIR
)

# Docling images_scale: 1.0 ≈ 72 DPI. 2.0 ≈ 144 DPI.
IMAGES_SCALE = 2.0

app = FastAPI(title="PDF OCR POC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# PaddleOCR 3.x with PP-OCRv5 Thai recognition.
# Detection model is language-agnostic; recognition is Thai-specific.
ocr_engine = PaddleOCR(
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="th_PP-OCRv5_mobile_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)

_pdf_pipeline_options = PdfPipelineOptions(artifacts_path=DOCLING_ARTIFACTS_PATH)
_pdf_pipeline_options.images_scale = IMAGES_SCALE
_pdf_pipeline_options.generate_page_images = True
_pdf_pipeline_options.do_ocr = False
_pdf_pipeline_options.do_table_structure = False

doc_converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=_pdf_pipeline_options)
    }
)


def render_pdf_pages(pdf_path: Path):
    """Yield (page_number, PIL.Image) for each page using Docling."""
    result = doc_converter.convert(source=pdf_path)
    for page_no, page in result.document.pages.items():
        img = page.image.pil_image
        yield page_no, img.convert("RGB")


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
async def ocr(file: UploadFile = File(...)):
    filename = file.filename or "upload.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    pdf_bytes = await file.read()
    saved_path = UPLOAD_DIR / f"{uuid.uuid4().hex}_{filename}"
    saved_path.write_bytes(pdf_bytes)

    try:
        pages = []
        for page_num, img in render_pdf_pages(saved_path):
            pages.append(
                {
                    "page": page_num,
                    "width": img.width,
                    "height": img.height,
                    "detections": run_ocr(img),
                }
            )

        return {"pages": pages}
    finally:
        saved_path.unlink(missing_ok=True)
