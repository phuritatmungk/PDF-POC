"""Heuristic field extraction from OCR detections for Thai/EN company reports."""

import re
from typing import Any

DEFAULT_FIELD: dict[str, Any] = {"value": "", "page": None, "idx": None}

COMPANY_TH = re.compile(r"บริษัท\s+.+?\s*(?:จำกัด|จํากัด)(?:\s*\(มหาชน\))?")
COMPANY_EN = re.compile(
    r"\b.+?(?:Co\.,?\s*Ltd\.?|Company\s+Limited|Public\s+Company\s+Limited|PCL)\b",
    re.IGNORECASE,
)
THAI_13_ID = re.compile(r"(?<!\d)\d{13}(?!\d)")
CAPITAL_LABEL = re.compile(r"ทุนจดทะเบียน|registered\s*capital", re.IGNORECASE)
TAX_LABEL = re.compile(r"ภาษี|tax\s*id", re.IGNORECASE)
REGISTRATION_LABEL = re.compile(r"ทะเบียน(?:นิติบุคคล)?|registration", re.IGNORECASE)
ADDRESS_LABEL = re.compile(r"ที่อยู่|address", re.IGNORECASE)
DATE_TH = re.compile(
    r"\d{1,2}\s*(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|"
    r"กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*\d{4}"
)
DATE_NUM = re.compile(r"\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b")
DIRECTORS_LABEL = re.compile(r"(?:รายชื่อ)?กรรมการ(?:และ|$|\s)|directors?", re.IGNORECASE)
BUSINESS_LABEL = re.compile(
    r"ประเภทธุรกิจ|business\s*type|nature\s*of\s*business", re.IGNORECASE
)

# Patterns that mark the start of a new section — used to stop multi-value collection.
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
    """Find label; return value after colon on same line, else next detection's text."""
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
    """Find label; collect all subsequent detections until the next section boundary.
    Returns a newline-joined value so the form can display each line separately.
    """
    flat = list(_iter_detections(pages))
    for i, (page, idx, text) in enumerate(flat):
        if not label_pattern.search(text):
            continue

        collected: list[str] = []
        first_page, first_idx = page, idx

        # Value on same line after colon
        parts = re.split(r"[:：]", text, 1)
        if len(parts) == 2 and parts[1].strip():
            collected.append(parts[1].strip())
            first_page, first_idx = page, idx

        for j in range(i + 1, min(i + 1 + max_items, len(flat))):
            np_, nidx, ntext = flat[j]
            stripped = ntext.strip()
            if not stripped:
                continue
            if SECTION_BOUNDARY.search(stripped):
                break
            collected.append(stripped)
            if not collected:  # first item sets the locate reference
                first_page, first_idx = np_, nidx

        if collected:
            return {
                "value": "\n".join(collected),
                "page": first_page,
                "idx": first_idx,
            }
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


def extract_fields(pages) -> dict[str, dict[str, Any]]:
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

    return {
        "company_name": company,
        "registration_number": registration,
        "tax_id": tax,
        "registered_capital": capital,
        "address": address,
        "report_date": date,
        "business_type": business,
        "directors": directors,
    }
