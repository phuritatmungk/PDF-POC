"use client";

import { useCallback, useState } from "react";
import { uploadPdfForOcr } from "@/lib/api";
import type { OcrResponse } from "@/lib/types";

type Props = {
  onResult: (file: File, result: OcrResponse) => void;
};

export default function UploadZone({ onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const result = await uploadPdfForOcr(file);
        onResult(file, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onResult],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-slate-300">Running OCR…</p>
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
