"""Field extraction from OCR detections — local LLM (Ollama) primary, heuristic fallback."""

import json
import os
import re
from typing import Any

DEFAULT_FIELD: dict[str, Any] = {"value": "", "page": None, "idx": None}

# ---------------------------------------------------------------------------
# Heuristic patterns (fallback when Ollama is unavailable)
# ---------------------------------------------------------------------------
COMPANY_TH = re.compile(r"บริษัท\s+.+?\s*(?:จำกัด|จํากัด)(?:\s*\(มหาชน\))?")
COMPANY_EN = re.compile(
    r"\b.+?(?:Co\.,?\s*Ltd\.?|Company\s+Limited|Public\s+Company\s+Limited|PCL)\b",
    re.IGNORECASE,
)
THAI_13_ID = re.compile(r"(?<!\d)\d{13}(?!\d)")
CAPITAL_LABEL = re.compile(r"ทุนจดทะเบียน|registered\s*capital", re.IGNORECASE)
TAX_LABEL = re.compile(r"ภาษี|tax\s*id", re.IGNORECASE)
REGISTRATION_LABEL = re.compile(r"ทะเบียน(?:นิติบุคคล)?|registration", re.IGNORECASE)
ADDRESS_LABEL = re.compile(r"ที่อยู่|address|สำนักงานแห่งใหญ่|ตั้งอยู่", re.IGNORECASE)
DATE_TH = re.compile(
    r"\d{1,2}\s*(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|"
    r"กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*\d{4}"
)
DATE_NUM = re.compile(r"\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b")
DIRECTORS_LABEL = re.compile(r"(?:รายชื่อ)?กรรมการ(?:และ|$|\s)|directors?", re.IGNORECASE)
BUSINESS_LABEL = re.compile(
    r"ประเภทธุรกิจ|business\s*type|nature\s*of\s*business", re.IGNORECASE
)
SECTION_BOUNDARY = re.compile(
    r"ทุนจดทะเบียน|ที่อยู่|address|ประเภทธุรกิจ|business\s*type|"
    r"วัตถุประสงค์|object|งบการเงิน|financial|โทร|tel|fax|"
    r"ลงลายมือชื่อ|signature|หน้าที่|^\s*\d+\s*$",
    re.IGNORECASE,
)


def _iter_detections(pages):
    for p in pages:
        for idx, det in enumerate(p["detections"]):
            yield p["page"], idx, det["text"]


def _find_first(pages, pattern, transform=lambda s: s):
    for page, idx, text in _iter_detections(pages):
        m = pattern.search(text)
        if m:
            return {"value": transform(m.group(0)).strip(), "page": page, "idx": idx}
    return dict(DEFAULT_FIELD)


def _find_value_after_label(pages, label_pattern):
    flat = list(_iter_detections(pages))
    for i, (page, idx, text) in enumerate(flat):
        if label_pattern.search(text):
            parts = re.split(r"[:：]", text, 1)
            if len(parts) == 2 and parts[1].strip():
                return {"value": parts[1].strip(), "page": page, "idx": idx}
            if i + 1 < len(flat):
                np_, nidx, ntext = flat[i + 1]
                return {"value": ntext.strip(), "page": np_, "idx": nidx}
    return dict(DEFAULT_FIELD)


def _find_multi_values_after_label(pages, label_pattern, max_items: int = 30):
    flat = list(_iter_detections(pages))
    for i, (page, idx, text) in enumerate(flat):
        if not label_pattern.search(text):
            continue
        collected: list[str] = []
        first_page, first_idx = page, idx
        parts = re.split(r"[:：]", text, 1)
        if len(parts) == 2 and parts[1].strip():
            collected.append(parts[1].strip())
        for j in range(i + 1, min(i + 1 + max_items, len(flat))):
            np_, nidx, ntext = flat[j]
            stripped = ntext.strip()
            if not stripped:
                continue
            if SECTION_BOUNDARY.search(stripped):
                break
            collected.append(stripped)
            if not collected:
                first_page, first_idx = np_, nidx
        if collected:
            return {"value": "\n".join(collected), "page": first_page, "idx": first_idx}
    return dict(DEFAULT_FIELD)


def _find_id_near_label(pages, label_pattern):
    flat = list(_iter_detections(pages))
    for i, (page, idx, text) in enumerate(flat):
        prev_text = flat[i - 1][2] if i > 0 else ""
        if label_pattern.search(text) or label_pattern.search(prev_text):
            m = THAI_13_ID.search(text)
            if m:
                return {"value": m.group(0), "page": page, "idx": idx}
            if i + 1 < len(flat):
                m = THAI_13_ID.search(flat[i + 1][2])
                if m:
                    return {
                        "value": m.group(0),
                        "page": flat[i + 1][0],
                        "idx": flat[i + 1][1],
                    }
    return dict(DEFAULT_FIELD)


def _extract_agenda_heuristic(pages) -> list[dict]:
    """Return list of {topic, description, page, idx} by scanning for วาระที่ N lines."""
    flat = list(_iter_detections(pages))
    items: list[dict] = []

    i = 0
    while i < len(flat):
        page, idx, text = flat[i]
        t = text.strip()
        if _AGENDA_LINE.search(t):
            desc_parts: list[str] = []
            j = i + 1
            while j < len(flat):
                _, _, ntext = flat[j]
                nt = ntext.strip()
                if not nt or _WATERMARK.match(nt):
                    j += 1
                    continue
                if _AGENDA_LINE.search(nt) or _AGENDA_END.search(nt):
                    break
                desc_parts.append(nt)
                j += 1
            items.append({"topic": t, "description": " ".join(desc_parts), "page": page, "idx": idx})
            i = j
            continue
        i += 1

    return items


def extract_fields_heuristic(pages) -> dict[str, dict[str, Any]]:
    company = _find_first(pages, COMPANY_TH)
    if not company["value"]:
        company = _find_first(pages, COMPANY_EN)
    registration = _find_id_near_label(pages, REGISTRATION_LABEL)
    tax = _find_id_near_label(pages, TAX_LABEL)
    if not registration["value"]:
        registration = _find_first(pages, THAI_13_ID)
    if not tax["value"]:
        tax = registration
    capital = _find_value_after_label(pages, CAPITAL_LABEL)
    address = _find_multi_values_after_label(pages, ADDRESS_LABEL, max_items=10)
    business = _find_value_after_label(pages, BUSINESS_LABEL)
    directors = _find_multi_values_after_label(pages, DIRECTORS_LABEL, max_items=30)
    date = _find_first(pages, DATE_TH)
    if not date["value"]:
        date = _find_first(pages, DATE_NUM)
    agenda_items = _extract_agenda_heuristic(pages)
    result: dict[str, Any] = {
        "company_name": company,
        "registration_number": registration,
        "tax_id": tax,
        "registered_capital": capital,
        "address": address,
        "report_date": date,
        "business_type": business,
        "directors": directors,
    }
    for i, item in enumerate(agenda_items, 1):
        result[f"topic_{i}"] = {"value": item["topic"], "page": item["page"], "idx": item["idx"]}
        result[f"description_{i}"] = {"value": item["description"], "page": item["page"], "idx": item["idx"]}
    return result


# ---------------------------------------------------------------------------
# LLM extraction — OpenAI-compatible endpoint (llama.cpp, Ollama, etc.)
# ---------------------------------------------------------------------------
_FIELD_KEYS = [
    "company_name",
    "registration_number",
    "tax_id",
    "registered_capital",
    "address",
    "report_date",
    "business_type",
    "directors",
]

_SYSTEM = (
    "You are a data extraction assistant for Thai company documents. "
    "Extract ONLY values explicitly present in the provided text. "
    "Do NOT use prior knowledge or training data to fill in missing fields — if a field is not found in the text, return empty string. "
    "Return ONLY valid JSON — no markdown, no explanation. /no_think"
)

_USER_TMPL = """Extract fields from a Thai company document. Return ONLY valid JSON.

=== GENERAL TEXT (company name, ID, capital, date, business type) ===
{general}

=== ADDRESS TEXT (extract address from this only) ===
{address}

=== DIRECTORS TEXT (extract director names from this only) ===
{directors}

=== AGENDA TEXT (extract meeting agenda topics and descriptions from this only) ===
{agenda}

RULES:
- company_name: output ONCE, e.g. "บริษัท โออิชิ กรุ๊ป จำกัด (มหาชน)"
- registration_number: 13-digit registration number
- tax_id: 13-digit tax ID (often same as registration_number)
- registered_capital: ทุนจดทะเบียน amount with words
- address: main office on line 1, each สำนักงานสาขา on its own line (join address fragments with spaces). Exclude warnings/watermarks/DBD text.
- report_date: document date
- business_type: nature of business
- directors: ALL names from the numbered list (1. 2. 3. ...) in DIRECTORS TEXT, one per line, no number prefix. Do NOT use signing-authority text.
- agenda: array of objects, one per agenda item found in AGENDA TEXT. Each object has "topic" (the agenda title, e.g. "วาระที่ 1 รับรองรายงานการประชุม") and "description" (the body text / resolution for that item). Use [] if no agenda found.

{{"company_name":"...","registration_number":"...","tax_id":"...","registered_capital":"...","address":"mainoffice\\nbranch1\\nbranch2","report_date":"...","business_type":"...","directors":"name1\\nname2\\nname3","agenda":[{{"topic":"วาระที่ 1 ...","description":"..."}},{{"topic":"วาระที่ 2 ...","description":"..."}}]}}"""

# Patterns for corpus filtering
_WATERMARK = re.compile(
    r"^(?:DBD|กรมพัฒนาธุรกิจการค้า|Department of Business Development|"
    r"Ministry of Commerce|Creative\s+services|กระทรวงพาณิชย์|"
    r"ยิ้มแจ้น|โป่งใส|ใส่ใจบริการ|ใส่ใจมริการ|คำเตือน.*)$",
    re.IGNORECASE,
)
_OBJECTIVE_LINE = re.compile(r"^\s*\(\d+\)\s*ประกอบกิจการ")

_ADDR_END = re.compile(r"วัตถุประสงค์|^\s*\d+\s*$")

_DIR_START = re.compile(r"กรรมการของ\S*มี\s*\d+\s*คน|กรรมการของบริษัทมี")
_DIR_END = re.compile(r"ชื่อและจำนวนกรรมการซึ่งมีอำนาจ|ข้อจำกัดอำนาจกรรมการ")

_AGENDA_LINE = re.compile(r"วาระที่\s*\d+|Agenda\s+\d+|วาระ\s*\d+", re.IGNORECASE)
# Only stop at real meeting-end markers. ผู้รับรอง/ผู้ตรวจสอบ can appear inside
# agenda descriptions so we don't terminate on them.
_AGENDA_END = re.compile(r"ปิดประชุม|ปิดการประชุม|signed\s+by|ลงชื่อ.*ประธาน", re.IGNORECASE)


_BRANCH_LINE = re.compile(r"สำนักงานสาขา\s+ตั้งอยู่")
_MAIN_OFFICE = re.compile(r"สำนักงานแห่งใหญ่|ที่ตั้งสำนักงาน")
_ADDRESS_LIKE = re.compile(r"เลขที่|ถนน|แขวง|ตำบล|อำเภอ|จังหวัด|กรุงเทพ")
_MEETING_HEADER = re.compile(r"ระเบียบวาระ|วาระการประชุม|agenda", re.IGNORECASE)


def _build_corpus(pages, max_chars: int = 3000) -> str:
    """General corpus for simple fields: filtered, capped."""
    lines = []
    for p in pages:
        lines.append(f"[Page {p['page']}]")
        for det in p["detections"]:
            t = det["text"].strip()
            if t and not _WATERMARK.match(t) and not _OBJECTIVE_LINE.match(t):
                lines.append(t)
    return "\n".join(lines)[:max_chars]


def _find_address_section(pages) -> str:
    """Collect main-office block + every สำนักงานสาขา line. Stays compact."""
    flat = list(_iter_detections(pages))
    main_lines: list[str] = []
    branch_lines: list[str] = []

    # Grab main office (lines after สำนักงานแห่งใหญ่ until first branch/objectives)
    collecting_main = False
    for _, _, text in flat:
        t = text.strip()
        if not t or _WATERMARK.match(t):
            continue
        if _MAIN_OFFICE.search(t):
            collecting_main = True
        if collecting_main:
            if _BRANCH_LINE.search(t) or _ADDR_END.search(t):
                break
            if _ADDRESS_LIKE.search(t) or _MAIN_OFFICE.search(t):
                main_lines.append(t)

    # Grab every branch line across all pages
    for _, _, text in flat:
        t = text.strip()
        if _BRANCH_LINE.search(t) and not _WATERMARK.match(t):
            branch_lines.append(t)

    return "\n".join(main_lines + branch_lines)[:1500]


def _find_directors_section(pages) -> str:
    """Find the numbered directors list section."""
    flat = list(_iter_detections(pages))
    start = None
    for i, (_, _, text) in enumerate(flat):
        if _DIR_START.search(text):
            start = i
            break
    if start is None:
        return ""
    collected: list[str] = []
    for i in range(start, min(start + 80, len(flat))):
        t = flat[i][2].strip()
        if not t:
            continue
        if collected and _DIR_END.search(t):
            break
        collected.append(t)
    return "\n".join(collected)


def _find_agenda_section(pages, max_chars: int = 8000) -> str:
    """Collect agenda items: วาระที่ N lines + their following description lines."""
    flat = list(_iter_detections(pages))
    collected: list[str] = []
    in_agenda = False

    for _, _, text in flat:
        t = text.strip()
        if not t or _WATERMARK.match(t):
            continue
        if _AGENDA_LINE.search(t) or _MEETING_HEADER.search(t):
            in_agenda = True
        if in_agenda:
            if _AGENDA_END.search(t):
                break
            collected.append(t)

    return "\n".join(collected)[:max_chars]


def _annotate_locations(pages, fields: dict) -> None:
    """Best-effort: attach page/idx for single-line values."""
    for field in fields.values():
        val = field["value"]
        if not val or "\n" in val:
            continue
        needle = val[:40].lower()
        for p in pages:
            for idx, det in enumerate(p["detections"]):
                if needle in det["text"].lower():
                    field["page"] = p["page"]
                    field["idx"] = idx
                    break
            if field["page"] is not None:
                break


def extract_fields_llm(pages) -> dict[str, dict[str, Any]]:
    """Call any OpenAI-compatible server: llama.cpp (default) or Ollama."""
    import urllib.error
    import urllib.request

    # LLM_BASE_URL: llama.cpp default is :8080, Ollama is :11434
    base_url = os.environ.get("LLM_BASE_URL", "http://localhost:8080").rstrip("/")
    # LLM_MODEL: required for Ollama; llama.cpp ignores it (uses loaded model)
    model = os.environ.get("LLM_MODEL", "local-model")
    # MAX_CORPUS_CHARS: keep corpus within context window (~8k tokens ≈ 12k chars)
    max_chars = int(os.environ.get("LLM_MAX_CORPUS_CHARS", "3000"))

    general = _build_corpus(pages, max_chars=max_chars)
    address = _find_address_section(pages)
    directors = _find_directors_section(pages)
    agenda = _find_agenda_section(pages)
    print(f"[extractor] sections — general:{len(general)}c address:{len(address)}c directors:{len(directors)}c agenda:{len(agenda)}c")

    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": _USER_TMPL.format(
                    general=general, address=address, directors=directors, agenda=agenda
                )},
            ],
            "temperature": 0,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"},
        }
    ).encode()

    req = urllib.request.Request(
        f"{base_url}/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} from LLM server: {err_body[:300]}")

    raw = body["choices"][0]["message"]["content"].strip()
    # Strip Qwen3/thinking-model <think>...</think> blocks
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    # Strip accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    data: dict = json.loads(raw)
    result: dict[str, Any] = {
        key: {"value": str(data.get(key, "") or ""), "page": None, "idx": None}
        for key in _FIELD_KEYS
    }
    # Clean duplicate บริษัท prefix the LLM sometimes emits
    cn = result["company_name"]["value"]
    if cn:
        result["company_name"]["value"] = re.sub(r"^(?:บริษัท\s+)+", "บริษัท ", cn)

    # Flatten agenda array → topic_1/description_1, topic_2/description_2, ...
    agenda_items = data.get("agenda", [])
    if isinstance(agenda_items, list):
        for i, item in enumerate(agenda_items, 1):
            if isinstance(item, dict):
                result[f"topic_{i}"] = {"value": str(item.get("topic", "") or ""), "page": None, "idx": None}
                result[f"description_{i}"] = {"value": str(item.get("description", "") or ""), "page": None, "idx": None}

    _annotate_locations(pages, result)
    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_fields(pages) -> dict[str, dict[str, Any]]:
    """Use local LLM if LLM_BASE_URL is set; otherwise fall back to heuristic."""
    llm_url = os.environ.get("LLM_BASE_URL", "").strip()
    print(f"[extractor] LLM_BASE_URL={llm_url!r}")
    if llm_url:
        try:
            return extract_fields_llm(pages)
        except Exception as exc:
            import traceback
            print(f"[extractor] LLM extraction failed: {exc}")
            traceback.print_exc()
            print("[extractor] falling back to heuristic")
    else:
        print("[extractor] no LLM_BASE_URL, using heuristic")
    return extract_fields_heuristic(pages)
