"use client";

import { useCallback, useState } from "react";
import { uploadPdfForOcr } from "@/lib/api";
import type { OcrResponse } from "@/lib/types";

type Props = {
  onResult: (file: File, result: OcrResponse) => void;
};

type Progress =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "ocr"; current: number; total: number }
  | { phase: "extracting" };

export default function UploadZone({ onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<Progress>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);

  const loading = progress.phase !== "idle";

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setProgress({ phase: "uploading" });
      try {
        const result = await uploadPdfForOcr(file, (ev) => {
          if (ev.type === "rendered") {
            setProgress({ phase: "ocr", current: 0, total: ev.total });
          } else if (ev.type === "page") {
            setProgress({ phase: "ocr", current: ev.current, total: ev.total });
          } else if (ev.type === "extracting") {
            setProgress({ phase: "extracting" });
          }
        });
        onResult(file, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [onResult],
  );

  const pct =
    progress.phase === "ocr" && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  const label =
    progress.phase === "uploading"
      ? "Uploading…"
      : progress.phase === "ocr"
        ? `OCR page ${progress.current} / ${progress.total}`
        : progress.phase === "extracting"
          ? "Extracting fields…"
          : "";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
        dragging ? "border-sky-400 bg-sky-400/5" : "border-slate-700 bg-slate-900/40"
      }`}
    >
      {loading ? (
        <div className="flex flex-col items-center gap-4 min-w-[280px] mx-auto">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-slate-300 text-sm">{label}</p>
          {pct !== null && (
            <div className="w-full">
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-200 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{pct}%</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-slate-200 mb-3">Drop a PDF here, or</p>
          <label className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white">
            Choose file
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </>
      )}
      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
}
