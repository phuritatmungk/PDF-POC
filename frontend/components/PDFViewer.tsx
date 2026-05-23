"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import OCRBoxOverlay from "./OCRBoxOverlay";
import type { OcrResponse, Selection } from "@/lib/types";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File;
  ocr: OcrResponse;
  zoom: number;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
};

export default function PDFViewer({
  file,
  ocr,
  zoom,
  selected,
  onSelect,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selected) return;
    pageRefs.current[selected.page]?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [selected]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Document
        file={file}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<p className="text-slate-400">Loading PDF…</p>}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
          const ocrPage = ocr.pages.find((p) => p.page === n);
          return (
            <div
              key={n}
              ref={(el) => {
                pageRefs.current[n] = el;
              }}
              className="relative inline-block shadow-lg"
            >
              <Page
                pageNumber={n}
                width={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              {ocrPage && (
                <OCRBoxOverlay
                  page={ocrPage}
                  selected={selected}
                  onSelect={onSelect}
                />
              )}
            </div>
          );
        })}
      </Document>
    </div>
  );
}
