"use client";

import { useEffect, useRef } from "react";
import type { OcrResponse, Selection } from "@/lib/types";

type Props = {
  ocr: OcrResponse;
  filename: string;
  query: string;
  onQueryChange: (q: string) => void;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
};

export default function Sidebar({
  ocr,
  filename,
  query,
  onQueryChange,
  selected,
  onSelect,
}: Props) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const q = query.trim().toLowerCase();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(ocr, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.pdf$/i, "")}.ocr.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-80 shrink-0 border-l border-slate-800 bg-slate-900/40 flex flex-col h-[calc(100vh-7rem)]">
      <div className="p-3 border-b border-slate-800 space-y-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search text…"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={exportJson}
          className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
        >
          Export JSON
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {ocr.pages.map((p) => {
          const items = p.detections
            .map((d, idx) => ({ d, idx }))
            .filter(({ d }) => !q || d.text.toLowerCase().includes(q));
          if (items.length === 0) return null;
          return (
            <div key={p.page}>
              <div className="text-xs uppercase text-slate-500 px-2 py-1">
                Page {p.page}
              </div>
              <ul className="space-y-1">
                {items.map(({ d, idx }) => {
                  const isSelected =
                    selected?.page === p.page && selected.idx === idx;
                  return (
                    <li key={idx}>
                      <button
                        ref={isSelected ? selectedRef : null}
                        onClick={() => onSelect({ page: p.page, idx })}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm flex justify-between gap-2 ${
                          isSelected
                            ? "bg-sky-500/20 ring-1 ring-sky-400"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate">{d.text}</span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
