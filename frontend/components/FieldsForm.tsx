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
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(FIELD_LABELS.map((f) => [f.key, fields[f.key]?.value ?? ""])),
    topics: fields.topics?.value ?? "",
    descriptions: fields.descriptions?.value ?? "",
  }));
  const [openAddresses, setOpenAddresses] = useState<Set<number>>(new Set());
  const [openAgendas, setOpenAgendas] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);

  /** Returns onDragOver / onDragLeave / onDrop props for a field.
   *  append=true: newline-join (directors, address); append=false: replace */
  function dropProps(key: string, append = false) {
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(key); },
      onDragLeave: () => setDragOver(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        const text = e.dataTransfer.getData("text/plain").trim();
        if (!text) return;
        setValues((prev) => ({
          ...prev,
          [key]: append && prev[key] ? `${prev[key]}\n${text}` : text,
        }));
      },
    };
  }

  /** Border class that highlights when dragging over */
  function borderCls(key: string) {
    return dragOver === key
      ? "border-sky-400 bg-sky-950/30"
      : "border-slate-700";
  }

  const exportData = () => {
    const topicLines = values.topics.split("\n").filter((l) => l.trim());
    const descLines = values.descriptions.split("\n");
    const agendaFields: Record<string, string> = {};
    topicLines.forEach((t, i) => {
      agendaFields[`topic_${i + 1}`] = t;
      agendaFields[`description_${i + 1}`] = descLines[i] ?? "";
    });
    const data = {
      source: filename,
      fields: {
        ...Object.fromEntries(FIELD_LABELS.map((f) => [f.key, values[f.key]])),
        ...agendaFields,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
        <h2 className="text-sm font-semibold text-slate-200">Company Report Fields</h2>
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
                        ({allLines.length} location{allLines.length !== 1 ? "s" : ""}
                        {branchCount > 0 ? `, ${branchCount} branch${branchCount !== 1 ? "es" : ""}` : ""})
                      </span>
                    );
                  })()}
                </label>
                {canLocate ? (
                  <button
                    onClick={() => onSelect({ page: ext.page!, idx: ext.idx! })}
                    className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 uppercase tracking-wider"
                    title={`Highlight source on page ${ext.page}`}
                  >
                    Locate ↗
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">not found</span>
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
                      placeholder="(not detected — drop text here or fill manually)"
                      className={`w-full px-3 py-2 bg-slate-950 border rounded text-sm focus:outline-none focus:border-sky-500 placeholder:text-slate-600 transition-colors ${borderCls(key)}`}
                      {...dropProps(key, true)}
                    />
                  );
                  return (
                    <div
                      className={`space-y-1 rounded border ${dragOver === key ? "border-sky-400 bg-sky-950/20" : "border-transparent"} transition-colors`}
                      {...dropProps(key, true)}
                    >
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
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={empty ? "(not detected — drop text here or fill manually)" : ""}
                  rows={Math.max(2, values[key].split("\n").length)}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded text-sm resize-y focus:outline-none focus:border-sky-500 placeholder:text-slate-600 transition-colors ${borderCls(key)}`}
                  {...dropProps(key, true)}
                />
              ) : (
                <input
                  type="text"
                  value={values[key]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={empty ? "(not detected — drop text here or fill manually)" : ""}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded text-sm focus:outline-none focus:border-sky-500 placeholder:text-slate-600 transition-colors ${borderCls(key)}`}
                  {...dropProps(key, false)}
                />
              )}
            </div>
          );
        })}

        {/* Agenda Section */}
        {(() => {
          const topicLines = values.topics.split("\n").filter((l) => l.trim());
          const descLines = values.descriptions.split("\n");
          const hasAgenda = topicLines.length > 0;
          return (
            <div>
              <div className="flex items-center justify-between mb-1.5 mt-2 pt-3 border-t border-slate-800">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Meeting Agenda
                  {hasAgenda && (
                    <span className="ml-2 normal-case text-slate-500">
                      ({topicLines.length} item{topicLines.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </label>
                {fields.topics.page != null && fields.topics.idx != null ? (
                  <button
                    onClick={() => onSelect({ page: fields.topics.page!, idx: fields.topics.idx! })}
                    className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 uppercase tracking-wider"
                  >
                    Locate ↗
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                    {hasAgenda ? "" : "not found"}
                  </span>
                )}
              </div>
              {hasAgenda ? (
                <div className="space-y-1">
                  {topicLines.map((topic, i) => {
                    const topicKey = `agenda-topic-${i}`;
                    const descKey = `agenda-desc-${i}`;
                    return (
                      <div key={i} className="border border-slate-700 rounded overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left"
                          onClick={() => setOpenAgendas((prev) => {
                            const next = new Set(prev);
                            next.has(i) ? next.delete(i) : next.add(i);
                            return next;
                          })}
                        >
                          <span className="truncate">
                            <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                            {topic.length > 50 ? topic.slice(0, 50) + "…" : topic}
                          </span>
                          <span className="ml-2 shrink-0 text-slate-500">{openAgendas.has(i) ? "▲" : "▼"}</span>
                        </button>
                        {openAgendas.has(i) && (
                          <div className="border-t border-slate-700 bg-slate-950">
                            <input
                              type="text"
                              value={topic}
                              onChange={(e) => {
                                const updated = topicLines.map((t, j) => j === i ? e.target.value : t);
                                setValues((prev) => ({ ...prev, topics: updated.join("\n") }));
                              }}
                              className={`w-full px-3 py-1.5 bg-transparent border-b text-xs text-slate-300 focus:outline-none transition-colors ${dragOver === topicKey ? "border-sky-400 bg-sky-950/30" : "border-slate-800"}`}
                              placeholder="Topic title"
                              {...dropProps(topicKey, false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(null);
                                const text = e.dataTransfer.getData("text/plain").trim();
                                if (!text) return;
                                const updated = topicLines.map((t, j) => j === i ? text : t);
                                setValues((prev) => ({ ...prev, topics: updated.join("\n") }));
                              }}
                            />
                            <textarea
                              value={descLines[i] ?? ""}
                              rows={3}
                              onChange={(e) => {
                                const updated = topicLines.map((_, j) => j === i ? e.target.value : (descLines[j] ?? ""));
                                setValues((prev) => ({ ...prev, descriptions: updated.join("\n") }));
                              }}
                              placeholder="Description / resolution — drop text here"
                              className={`w-full px-3 py-2 bg-transparent text-sm resize-y focus:outline-none placeholder:text-slate-600 transition-colors ${dragOver === descKey ? "bg-sky-950/30 border border-sky-400 rounded" : ""}`}
                              {...dropProps(descKey, false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(null);
                                const text = e.dataTransfer.getData("text/plain").trim();
                                if (!text) return;
                                const existing = descLines[i] ?? "";
                                const newVal = existing ? `${existing} ${text}` : text;
                                const updated = topicLines.map((_, j) => j === i ? newVal : (descLines[j] ?? ""));
                                setValues((prev) => ({ ...prev, descriptions: updated.join("\n") }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">(no agenda items detected)</p>
              )}
            </div>
          );
        })()}
      </div>
    </aside>
  );
}
