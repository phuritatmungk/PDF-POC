"use client";

type Props = {
  filename: string;
  pageCount: number;
  detectionCount: number;
  zoom: number;
  onZoom: (z: number) => void;
  onNew: () => void;
};

const MIN = 400;
const MAX = 1600;
const STEP = 100;

export default function Toolbar({
  filename,
  pageCount,
  detectionCount,
  zoom,
  onZoom,
  onNew,
}: Props) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-800 bg-slate-900/40 text-sm">
      <button
        onClick={onNew}
        className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white"
      >
        + New PDF
      </button>
      <span className="truncate max-w-xs text-slate-200">{filename}</span>
      <span className="text-slate-500">
        {pageCount} page(s) · {detectionCount} detection(s)
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onZoom(Math.max(MIN, zoom - STEP))}
          disabled={zoom <= MIN}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          −
        </button>
        <span className="tabular-nums w-12 text-center">{zoom}px</span>
        <button
          onClick={() => onZoom(Math.min(MAX, zoom + STEP))}
          disabled={zoom >= MAX}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
