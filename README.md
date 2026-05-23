# PDF OCR POC

Upload a PDF → backend extracts text with PaddleOCR → frontend displays the PDF with OCR bounding boxes overlaid.

**Stack:** FastAPI + Docling (rasterization) + PaddleOCR (text) · Next.js + TypeScript + Tailwind + react-pdf.

## Run

Two terminals.

**Backend** (Windows, local Python):
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Features

**Phase 1 (MVP):**
- Drag-drop PDF upload
- Backend rasterizes pages with Docling (`images_scale=2.0`, ~144 DPI, `do_ocr=False`), runs PaddleOCR (English), returns JSON
- Frontend renders the PDF and overlays OCR bounding boxes color-coded by confidence (green ≥ 0.9, yellow ≥ 0.7, red below)
- Multi-page PDFs (scroll to navigate)

**Phase 2:**
- Sidebar text panel grouped by page with confidence
- Search bar filters sidebar entries and highlights matching boxes (pink)
- Bidirectional click-to-highlight: sidebar ↔ overlay box, with auto-scroll
- Zoom −/+ controls (400–1600 px page width)
- JSON export

**Not yet:** AI summary, table extraction, Docker, image extraction, annotated-PDF download, multi-language selector, editable OCR text.

## API

`POST /ocr` (multipart `file`, PDF) → 
```json
{
  "pages": [
    {
      "page": 1,
      "width": 1700,
      "height": 2200,
      "detections": [
        { "text": "...", "confidence": 0.98, "box": [[x,y],[x,y],[x,y],[x,y]] }
      ]
    }
  ]
}
```

`box` coords are in the backend's 200-DPI rendered pixel space; `width`/`height` are that same render's dimensions. The frontend's SVG `viewBox` uses these directly, so display scaling is automatic.

## Known caveats

- PaddleOCR's first run downloads model weights (~10 MB) to `~/.paddleocr/`.
- Docling's first run may also download layout/model artifacts (cached under `~/.cache/docling` or similar). Even with `do_ocr=False` and `do_table_structure=False`, Docling loads some components — this is heavier than the previous PyMuPDF setup.
- Installing `paddlepaddle` on Windows can be slow; pinned versions in `backend/requirements.txt` are the last combo verified stable on CPU.
- Docling's Python API has evolved across 2.x. If `PdfPipelineOptions` / `page.image.pil_image` accessors break on import, bump `docling` in `requirements.txt` and adjust `render_pdf_pages()` in `backend/app.py`.
- `pdfjs` worker is loaded from unpkg CDN. For offline use, switch to a bundled worker.
