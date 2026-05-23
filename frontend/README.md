# Frontend — PDF OCR POC

Next.js 14 + TypeScript + Tailwind + react-pdf.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The frontend expects the backend at `http://localhost:8000` (override with `NEXT_PUBLIC_API_BASE`).

## How the overlay works

The backend returns OCR boxes in coordinates of the 200-DPI rendered page (`page.width` × `page.height`). The `OCRBoxOverlay` component renders an SVG positioned absolutely over the rendered PDF page. The SVG's `viewBox` is set to the backend pixel space, so boxes scale automatically to whatever display size the PDF is rendered at.

Box stroke color reflects confidence: green ≥ 0.9, yellow ≥ 0.7, red below.

## Phase 2 features

- **Sidebar**: lists detected text grouped by page with confidence %.
- **Search**: filters sidebar entries; matching boxes turn pink in the overlay.
- **Click sync**: click a sidebar entry → the box turns sky-blue and the page scrolls into view. Click a box → the sidebar entry scrolls into view and highlights.
- **Zoom**: −/+ buttons in the toolbar (400–1600 px page width).
- **Export JSON**: downloads the raw OCR response as `<filename>.ocr.json`.
