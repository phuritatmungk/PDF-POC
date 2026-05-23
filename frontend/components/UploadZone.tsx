"use client";

import { useCallback, useRef, useState } from "react";
import { uploadPdfForOcr } from "@/lib/api";
import type { OcrResponse } from "@/lib/types";

type Props = {
  onResult: (file: File, result: OcrResponse) => void;
};

export default function UploadZone({ onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(null);
      setExtracting(false);
      setEta(null);
      setLoading(true);
      startTimeRef.current = null;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await uploadPdfForOcr(
          file,
          (page, total) => {
            const now = Date.now();
            if (!startTimeRef.current) {
              startTimeRef.current = now;
            } else {
              const elapsed = (now - startTimeRef.current) / 1000;
              const avgPerPage = elapsed / page;
              setEta(Math.round(avgPerPage * (total - page)));
            }
            setProgress({ page, total });
          },
          () => { setProgress(null); setEta(null); setExtracting(true); },
          controller.signal,
        );
        onResult(file, result);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Upload failed");
        }
      } finally {
        abortRef.current = null;
        startTimeRef.current = null;
        setLoading(false);
        setProgress(null);
        setExtracting(false);
        setEta(null);
      }
    },
    [onResult],
  );

  const pct = progress ? Math.round((progress.page / progress.total) * 100) : 0;

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
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <button
            onClick={() => abortRef.current?.abort()}
            className="px-3 py-1 rounded text-xs font-medium bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white transition-colors"
          >
            Stop
          </button>
          {extracting ? (
            <p className="text-sky-300 text-sm">Extracting fields with AI…</p>
          ) : progress ? (
            <>
              <p className="text-slate-300 text-sm">
                Processing page {progress.page} of {progress.total}…
              </p>
              <div className="w-full max-w-xs bg-slate-800 rounded-full h-2">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs">
                {pct}%{eta !== null && eta > 0 ? ` · ~${eta}s remaining` : ""}
              </p>
            </>
          ) : (
            <p className="text-slate-300 text-sm">Uploading…</p>
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
