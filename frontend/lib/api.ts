import type { OcrResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type OcrProgress =
  | { type: "rendered"; total: number }
  | { type: "page"; current: number; total: number }
  | { type: "extracting" }
  | { type: "done"; result: OcrResponse }
  | { type: "error"; message: string };

export async function uploadPdfForOcr(
  file: File,
  onProgress?: (event: OcrProgress) => void,
): Promise<OcrResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/ocr`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OCR failed (${res.status}): ${detail}`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as OcrProgress;
      onProgress?.(ev);
      if (ev.type === "done") return ev.result;
      if (ev.type === "error") throw new Error(ev.message);
    }
  }
  throw new Error("Stream ended without a 'done' event");
}
