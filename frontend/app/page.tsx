"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import PDFViewer from "@/components/PDFViewer";
import FieldsForm from "@/components/FieldsForm";
import Toolbar from "@/components/Toolbar";
import type { OcrResponse, Selection } from "@/lib/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState<OcrResponse | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState(800);

  if (!file || !ocr) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">PDF OCR POC</h1>
        <UploadZone
          onResult={(f, r) => {
            setFile(f);
            setOcr(r);
            setSelected(null);
          }}
        />
      </main>
    );
  }

  const detectionCount = ocr.pages.reduce((n, p) => n + p.detections.length, 0);

  return (
    <main className="h-screen flex flex-col">
      <Toolbar
        filename={file.name}
        pageCount={ocr.pages.length}
        detectionCount={detectionCount}
        zoom={zoom}
        onZoom={setZoom}
        onNew={() => {
          setFile(null);
          setOcr(null);
          setSelected(null);
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <PDFViewer
            file={file}
            ocr={ocr}
            zoom={zoom}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <FieldsForm
          key={file.name}
          fields={ocr.fields}
          filename={file.name}
          onSelect={setSelected}
        />
      </div>
    </main>
  );
}
