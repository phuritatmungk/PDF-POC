import type { OcrResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function uploadPdfForOcr(file: File): Promise<OcrResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/ocr`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OCR failed (${res.status}): ${detail}`);
  }
  return res.json();
}
