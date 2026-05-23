import type { OcrResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function uploadPdfForOcr(
  file: File,
  onProgress: (page: number, total: number) => void,
  onExtracting: () => void,
  signal?: AbortSignal,
): Promise<OcrResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/ocr-stream`, { method: "POST", body: form, signal });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OCR failed (${res.status}): ${detail}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.replace(/^data:\s*/, "").trim();
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "progress") {
        onProgress(event.page, event.total);
      } else if (event.type === "extracting") {
        onExtracting();
      } else if (event.type === "done") {
        return { pages: event.pages, fields: event.fields };
      }
    }
  }

  throw new Error("Stream ended without a done event");
}
