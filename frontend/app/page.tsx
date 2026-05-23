"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import PDFViewer from "@/components/PDFViewer";
import FieldsForm from "@/components/FieldsForm";
import Toolbar from "@/components/Toolbar";
import type { Fields, OcrResponse, Selection } from "@/lib/types";

const EMPTY_FIELDS: Fields = {
  company_name:        { value: "", page: null, idx: null },
  registration_number: { value: "", page: null, idx: null },
  tax_id:              { value: "", page: null, idx: null },
  registered_capital:  { value: "", page: null, idx: null },
  address:             { value: "", page: null, idx: null },
  report_date:         { value: "", page: null, idx: null },
  business_type:       { value: "", page: null, idx: null },
  directors:           { value: "", page: null, idx: null },
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState<OcrResponse | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState(800);

  const hasResult = file && ocr;
  const detectionCount = ocr
    ? ocr.pages.reduce((n, p) => n + p.detections.length, 0)
    : 0;

  return (
    <main className="h-screen flex flex-col">
      <Toolbar
        filename={file?.name ?? ""}
        pageCount={ocr?.pages.length ?? 0}
        detectionCount={detectionCount}
        zoom={zoom}
        onZoom={setZoom}
        onNew={() => { setFile(null); setOcr(null); setSelected(null); }}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {hasResult ? (
            <PDFViewer
              file={file}
              ocr={ocr}
              zoom={zoom}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <div className="p-6">
              <UploadZone
                onResult={(f, r) => {
                  setFile(f);
                  setOcr(r);
                  setSelected(null);
                }}
              />
            </div>
          )}
        </div>
        <FieldsForm
          key={file?.name ?? "__empty__"}
          fields={ocr?.fields ?? EMPTY_FIELDS}
          filename={file?.name ?? ""}
          onSelect={setSelected}
        />
      </div>
    </main>
  );
}
