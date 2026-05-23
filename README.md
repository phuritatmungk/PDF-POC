# PDF OCR POC

Upload a Thai company PDF → OCR every page → LLM extracts structured fields → editable form auto-filled.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | Python · FastAPI · Uvicorn |
| **PDF rendering** | pypdfium2 (page-by-page, 144 DPI) |
| **OCR** | PaddleOCR 3.x — PP-OCRv5 Thai (`th_PP-OCRv5_mobile_rec`) |
| **Field extraction** | Local LLM via llama.cpp or Ollama (OpenAI-compatible `/v1/chat/completions`) with heuristic fallback |
| **LLM model** | Typhoon2.5-Qwen3-4B GGUF (or any model served locally) |
| **Frontend** | Next.js 14 · TypeScript · Tailwind CSS |
| **PDF viewer** | react-pdf (pdfjs-dist 4.x) |
| **Streaming** | Server-Sent Events (SSE) for per-page OCR progress |
| **Deployment** | Docker Compose (backend + frontend) · Vercel (frontend) · Cloudflare quick tunnel (backend) |

## Features

- Drag-and-drop PDF upload with real-time per-page progress bar + ETA
- "Extracting fields with AI…" phase indicator while LLM runs
- Stop button cancels upload mid-stream
- Auto-filled editable form: company name, registration no., tax ID, registered capital, address, report date, business type, directors
- Address accordion — each branch (สำนักงานสาขา) collapses individually; branch count in label
- "Locate ↗" button jumps to the source detection in the PDF viewer
- OCR bounding boxes overlaid on PDF, colour-coded by confidence
- Export JSON of all fields
- LLM extracts from focused sections (heuristic pre-locates address block and directors list before calling LLM, keeping prompt within 8k tokens)
- Falls back to regex heuristics if no LLM server is configured

## Quick Start

### 1. Start the LLM server (optional but recommended)

```bash
# Pull and serve with llama.cpp (downloads model on first run, ~2.5 GB)
llama-server -hf scb10x/typhoon2.5-qwen3-4b-gguf:Q4_K_M --port 8080 -c 8192 -ngl 999

# Or with Ollama
ollama pull scb10x/typhoon2.5-qwen3-4b-gguf:Q4_K_M
ollama serve
```

### 2. Start the stack

```bash
# With LLM extraction (llama.cpp on host)
LLM_BASE_URL=http://host.docker.internal:8080 docker compose up --build

# Without LLM (heuristic fallback only)
docker compose up --build
```

Open http://localhost:3000. First build downloads OCR model weights into named volumes (`paddle_models`) — these persist across rebuilds.

### Demo script (includes Cloudflare tunnel for Vercel frontend)

```bash
bash demo.sh
```

Starts Docker stack + Cloudflare quick tunnel, prints the tunnel URL to update in Vercel env vars.

### Local dev (no Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
LLM_BASE_URL=http://localhost:8080 uvicorn app:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | _(unset)_ | OpenAI-compatible server URL. If unset, uses heuristic extraction. |
| `LLM_MODEL` | `local-model` | Model name (required for Ollama; ignored by llama.cpp). |
| `LLM_MAX_CORPUS_CHARS` | `3000` | Max chars of general OCR text sent to LLM. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins. |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | Backend URL baked into the Next.js build. |

## API

`POST /ocr-stream` — SSE stream (multipart `file`, PDF)

Events:
```
data: {"type":"progress","page":1,"total":5}
data: {"type":"extracting"}
data: {"type":"done","pages":[...],"fields":{...}}
```

`POST /ocr` — same but single JSON response (no streaming)

`GET /health` → `{"status":"ok"}`

Field schema:
```json
{
  "company_name":        {"value": "...", "page": 1, "idx": 42},
  "registration_number": {"value": "...", "page": null, "idx": null},
  "tax_id":              {"value": "..."},
  "registered_capital":  {"value": "..."},
  "address":             {"value": "mainoffice\nbranch1\nbranch2"},
  "report_date":         {"value": "..."},
  "business_type":       {"value": "..."},
  "directors":           {"value": "name1\nname2\nname3"}
}
```

`page`/`idx` are null for LLM-extracted multi-line fields (Locate button hidden).
 
## Deploy

**Frontend → Vercel:** import repo, set root directory = `frontend`, add `NEXT_PUBLIC_API_BASE` env var pointing to your backend tunnel URL.

**Backend → local Docker:** run `demo.sh` which starts Docker + Cloudflare quick tunnel and prints the URL to paste into Vercel.
