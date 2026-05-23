"use client";

import type { PageResult, Selection } from "@/lib/types";

type Props = {
  page: PageResult;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
};

function confidenceColor(c: number) {
  if (c >= 0.9) return "rgb(34 197 94)";
  if (c >= 0.7) return "rgb(234 179 8)";
  return "rgb(239 68 68)";
}

export default function OCRBoxOverlay({ page, selected, onSelect }: Props) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
      viewBox={`0 0 ${page.width} ${page.height}`}
      preserveAspectRatio="none"
    >
      {page.detections.map((d, i) => {
        const isSelected = selected?.page === page.page && selected.idx === i;
        const stroke = isSelected
          ? "rgb(56 189 248)"
          : confidenceColor(d.confidence);
        const fill = isSelected
          ? "rgba(56,189,248,0.25)"
          : "rgba(0,0,0,0.001)";
        return (
          <polygon
            key={i}
            points={d.box.map(([x, y]) => `${x},${y}`).join(" ")}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 4 : 2}
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onClick={() => onSelect({ page: page.page, idx: i })}
          >
            <title>{`${d.text} (${(d.confidence * 100).toFixed(1)}%)`}</title>
          </polygon>
        );
      })}
    </svg>
  );
}
