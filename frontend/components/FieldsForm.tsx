"use client";

import { useState } from "react";
import type { Fields, Selection } from "@/lib/types";

const FIELD_LABELS: {
  key: keyof Fields;
  label: string;
  multiline?: boolean;
}[] = [
  { key: "company_name", label: "Company Name" },
  { key: "registration_number", label: "Registration No." },
  { key: "tax_id", label: "Tax ID" },
  { key: "registered_capital", label: "Registered Capital" },
  { key: "address", label: "Address", multiline: true },
  { key: "report_date", label: "Report Date" },
  { key: "business_type", label: "Business Type" },
  { key: "directors", label: "Directors", multiline: true },
];

type Props = {
  fields: Fields;
  filename: string;
  onSelect: (s: Selection) => void;
};

export default function FieldsForm({ fields, filename, onSelect }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FIELD_LABELS.map((f) => [f.key, fields[f.key]?.value ?? ""]),
    ),
  );
  const [openAddresses, setOpenAddresses] = useState<Set<number>>(new Set());

  const exportData = () => {
    const data = {
      source: filename,
      fields: Object.fromEntries(
        FIELD_LABELS.map((f) => [f.key, values[f.key]]),
      ),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.pdf$/i, "")}.fields.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-96 shrink-0 border-l border-slate-800 bg-slate-900/40 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          Company Report Fields
        </h2>
        <button
          onClick={exportData}
          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 rounded text-xs font-medium"
        >
          Export JSON
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {FIELD_LABELS.map(({ key, label, multiline }) => {
          const ext = fields[key];
          const canLocate = ext.page != null && ext.idx != null;
          const empty = !ext.value;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {label}
                  {key === "address" && values[key] && (() => {
                    const allLines = values[key].split("\n").filter((l) => l.trim());
                    const branchCount = allLines.filter((l) => l.includes("สำนักงานสาขา")).length;
                    return (
                      <span className="ml-2 normal-case text-slate-500">
                        ({allLines.length} location{allLines.length !== 1 ? "s" : ""}{branchCount > 0 ? `, ${branchCount} branch${branchCount !== 1 ? "es" : ""}` : ""})
                      </span>
                    );
                  })()}
                </label>
                {canLocate ? (
                  <button
                    onClick={() =>
                      onSelect({ page: ext.page!, idx: ext.idx! })
                    }
                    className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 uppercase tracking-wider"
                    title={`Highlight source on page ${ext.page}`}
                  >
                    Locate ↗
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                    not found
                  </span>
                )}
              </div>
              {key === "address" ? (
                (() => {
                  const lines = values[key].split("\n").filter((l) => l.trim());
                  if (lines.length === 0) return (
                    <input
                      type="text"
                      value=""
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="(not detected — fill manually)"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
                    />
                  );
                  return (
                    <div className="space-y-1">
                      {lines.map((line, i) => (
                        <div key={i} className="border border-slate-700 rounded overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left"
                            onClick={() => setOpenAddresses((prev) => {
                              const next = new Set(prev);
                              next.has(i) ? next.delete(i) : next.add(i);
                              return next;
                            })}
                          >
                            <span className="truncate">{line.length > 55 ? line.slice(0, 55) + "…" : line}</span>
                            <span className="ml-2 shrink-0 text-slate-500">{openAddresses.has(i) ? "▲" : "▼"}</span>
                          </button>
                          {openAddresses.has(i) && (
                            <textarea
                              value={line}
                              rows={3}
                              onChange={(e) => {
                                const updated = lines.map((l, j) => j === i ? e.target.value : l);
                                setValues((prev) => ({ ...prev, [key]: updated.join("\n") }));
                              }}
                              className="w-full px-3 py-2 bg-slate-950 border-t border-slate-700 text-sm resize-y focus:outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : multiline ? (
                <textarea
                  value={values[key]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={empty ? "(not detected — fill manually)" : ""}
                  rows={Math.max(2, values[key].split("\n").length)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm resize-y focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
                />
              ) : (
                <input
                  type="text"
                  value={values[key]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={empty ? "(not detected — fill manually)" : ""}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
                />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
