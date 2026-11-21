"""Deterministic announcement text generator for CrowdVision alerts supporting English and Hindi."""
from __future__ import annotations

import re
from typing import Any, Optional


SEVERITY_PREFIXES_EN = {
    "CRITICAL": "Critical alert.",
    "HIGH": "High-priority alert.",
    "MEDIUM": "Attention.",
    "LOW": "Information.",
}

SEVERITY_PREFIXES_HI = {
    "CRITICAL": "गंभीर चेतावनी।",
    "HIGH": "उच्च प्राथमिकता अलर्ट।",
    "MEDIUM": "सावधान।",
    "LOW": "सूचना।",
}

# Backward compatibility with existing tests
SEVERITY_PREFIXES = SEVERITY_PREFIXES_EN

CATEGORY_PHRASES_EN = {
    "critical_density": "Severe crowd congestion detected at {location}.",
    "bottleneck": "Crowd bottleneck detected at {location}.",
    "counterflow": "Dangerous counterflow detected at {location}.",
    "rapid_accumulation": "Rapid crowd accumulation detected at {location}.",
    "occupancy_warning": "High crowd density detected at {location}.",
}

CATEGORY_PHRASES_HI = {
    "critical_density": "{location} पर गंभीर भीड़ जमाव देखा गया है।",
    "bottleneck": "{location} पर क्राउड बॉटलनेक देखा गया है।",
    "counterflow": "{location} पर खतरनाक विपरीत प्रवाह देखा गया है।",
    "rapid_accumulation": "{location} पर तेजी से भीड़ बढ़ रही है।",
    "occupancy_warning": "{location} पर भीड़ का घनत्व अधिक है।",
}

# Backward compatibility with existing tests
CATEGORY_PHRASES = CATEGORY_PHRASES_EN

ZONE_TRANSLITERATIONS_HI = {
    "main stage": "मेन स्टेज",
    "north entrance": "उत्तर प्रवेश द्वार",
    "south entrance": "दक्षिण प्रवेश द्वार",
    "east entrance": "पूर्वी प्रवेश द्वार",
    "west entrance": "पश्चिमी प्रवेश द्वार",
    "entrance a": "प्रवेश द्वार ए",
    "entrance b": "प्रवेश द्वार बी",
    "entrance c": "प्रवेश द्वार सी",
    "emergency corridor": "आपातकालीन गलियारा",
    "food court": "फूड कोर्ट",
    "concourse": "कॉन्कोर्स",
    "platform 1": "प्लेटफॉर्म 1",
    "platform 2": "प्लेटफॉर्म 2",
    "waiting hall": "प्रतीक्षा कक्ष",
}

ACTION_TRANSLITERATIONS_HI = {
    "redirect incoming visitors to entrance b immediately": "आने वाले आगंतुकों को तुरंत प्रवेश द्वार बी पर पुनर्निर्देशित करें।",
    "redirect incoming visitors to entrance b": "आने वाले आगंतुकों को प्रवेश द्वार बी पर पुनर्निर्देशित करें।",
    "immediate monitoring is required": "तत्काल निगरानी आवश्यक है।",
    "dispatch security team": "सुरक्षा टीम को तुरंत भेजें।",
    "open emergency gates": "आपातकालीन द्वार तुरंत खोलें।",
}

MAX_ANNOUNCEMENT_LENGTH = 250


def _clean_text(text: str) -> str:
    """Normalize whitespace and strip harmful or noisy characters."""
    if not text:
        return ""
    # Strip raw JSON brackets, braces, and internal IDs
    text = re.sub(r"\{.*?\}|\[.*?\]", "", text)
    # Collapse multiple spaces and trim
    text = " ".join(text.split())
    return text.strip()


def _extract_occupancy_pct(measurements: dict, description: str, title: str) -> Optional[str]:
    """Extract verified occupancy percentage from measurements, description, or title."""
    for key in ("occupancy_ratio", "occupancy", "occupancy_pct", "capacity_utilization_pct", "utilization_pct"):
        if key in measurements and measurements[key] is not None:
            val = measurements[key]
            try:
                if isinstance(val, str):
                    clean_val = val.replace("%", "").strip()
                    num = float(clean_val)
                    if key == "occupancy_ratio" and 0 < num <= 1.0:
                        num = num * 100.0
                    return f"{int(num)}" if num.is_integer() else f"{round(num, 1)}"
                elif isinstance(val, (int, float)):
                    num = float(val)
                    if (key == "occupancy_ratio" or (key == "occupancy" and num <= 1.0)) and num > 0:
                        num = num * 100.0
                    return f"{int(num)}" if num.is_integer() else f"{round(num, 1)}"
            except (ValueError, TypeError):
                continue

    for text in (description, title):
        if not text:
            continue
        m = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:of\s+rated\s+zone\s+capacity|capacity|occupancy)?", text, re.IGNORECASE)
        if m:
            try:
                num = float(m.group(1))
                return f"{int(num)}" if num.is_integer() else f"{round(num, 1)}"
            except (ValueError, TypeError):
                pass
        m2 = re.search(r"occupancy(?:\s+ratio|\s+level|\s+reached|\s+at|\s*:)?\s*(\d+(?:\.\d+)?)\s*%?", text, re.IGNORECASE)
        if m2:
            try:
                num = float(m2.group(1))
                if 0 < num <= 1.0:
                    num = num * 100.0
                return f"{int(num)}" if num.is_integer() else f"{round(num, 1)}"
            except (ValueError, TypeError):
                pass

    return None


def _extract_people_count(measurements: dict) -> Optional[int]:
    """Extract verified people count from measurements."""
    for key in ("detected_people_in_zone", "people_count", "count", "person_count", "current_occupancy"):
        if key in measurements and measurements[key] is not None:
            try:
                return int(float(measurements[key]))
            except (ValueError, TypeError):
                continue
    return None


def build_spoken_announcement(alert: Any, language: Optional[str] = None) -> Optional[str]:
    """
    Build a concise, deterministic spoken text announcement from actual alert fields.
    Supports English ("en") and Hindi ("hi").

    Accepts an Alert ORM model, AlertData dataclass, or dictionary representation.
    Returns None if mandatory alert data is missing or invalid.
    """
    if alert is None:
        return None

    # Extract fields from dict or object
    if isinstance(alert, dict):
        severity = alert.get("severity")
        zone_name = alert.get("zone_name") or alert.get("zone_id")
        category = alert.get("category", "")
        title = alert.get("title", "")
        description = alert.get("description", "")
        measurements = alert.get("supporting_measurements") or {}
        alert_lang = alert.get("language")
    else:
        severity = getattr(alert, "severity", None)
        zone_name = getattr(alert, "zone_name", None) or getattr(alert, "zone_id", None)
        category = getattr(alert, "category", "") or ""
        title = getattr(alert, "title", "") or ""
        description = getattr(alert, "description", "") or ""
        measurements = getattr(alert, "supporting_measurements", {}) or {}
        alert_lang = getattr(alert, "language", None) or measurements.get("language")

    if not isinstance(measurements, dict):
        measurements = {}

    if not severity or not isinstance(severity, str):
        return None

    sev_upper = severity.strip().upper()
    if sev_upper not in SEVERITY_PREFIXES_EN and sev_upper not in (
        "CRITICAL", "HIGH", "MEDIUM", "LOW", "MODERATE", "INFO", "WARNING"
    ):
        return None

    # Normalize severity to standard set
    if sev_upper in ("MODERATE", "WARNING"):
        sev_norm = "MEDIUM"
    elif sev_upper == "INFO":
        sev_norm = "LOW"
    else:
        sev_norm = sev_upper

    # Determine target language: alert specific -> parameter -> settings -> default "en"
    target_lang = alert_lang or language
    if not target_lang:
        try:
            from app.config import get_settings
            target_lang = get_settings().elevenlabs_language
        except Exception:
            target_lang = "en"

    lang = "hi" if target_lang and str(target_lang).lower().startswith("hi") else "en"

    # Severity prefix
    if lang == "hi":
        prefix = SEVERITY_PREFIXES_HI.get(sev_norm, "अलर्ट।")
    else:
        prefix = SEVERITY_PREFIXES_EN.get(sev_norm, "Alert.")

    # Location clean & transliteration
    loc_clean = _clean_text(str(zone_name)) if zone_name else ""
    if re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-", loc_clean):
        location = "निगरानी क्षेत्र" if lang == "hi" else "monitored zone"
    elif loc_clean:
        if lang == "hi":
            location = ZONE_TRANSLITERATIONS_HI.get(loc_clean.lower(), loc_clean)
        else:
            location = loc_clean
    else:
        location = "निगरानी क्षेत्र" if lang == "hi" else "monitored area"

    # Category and condition phrase
    cat_lower = str(category).lower().strip()
    title_clean = _clean_text(title)
    description_clean = _clean_text(description)

    # Check for verified occupancy and people counts
    occupancy_pct = _extract_occupancy_pct(measurements, description_clean, title_clean)
    people_count = _extract_people_count(measurements)

    if lang == "hi":
        phrase_template = CATEGORY_PHRASES_HI.get(cat_lower)
        if not phrase_template:
            if "bottleneck" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_HI["bottleneck"]
            elif "counterflow" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_HI["counterflow"]
            elif "congestion" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_HI["critical_density"]
            elif "accumulation" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_HI["rapid_accumulation"]
            elif "density" in title_clean.lower() or "warning" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_HI["occupancy_warning"]
            elif occupancy_pct is not None:
                phrase_template = "{location} की ऑक्यूपेंसी {occupancy} प्रतिशत पर पहुंच गई है।"
            elif people_count is not None:
                phrase_template = "{location} पर {people_count} लोग देखे गए हैं।"
            else:
                phrase_template = "{location} पर असामान्य भीड़ की स्थिति देखी गई है।"

        if occupancy_pct is not None and cat_lower in ("occupancy_warning", "crowd_density", ""):
            condition_text = f"{location} पर भीड़ का घनत्व अधिक है। वर्तमान ऑक्यूपेंसी {occupancy_pct} प्रतिशत है।"
        elif occupancy_pct is not None and "{occupancy}" in phrase_template:
            condition_text = phrase_template.format(location=location, occupancy=occupancy_pct)
        elif people_count is not None and "{people_count}" in phrase_template:
            condition_text = phrase_template.format(location=location, people_count=people_count)
        else:
            condition_text = phrase_template.format(location=location)

    else:
        phrase_template = CATEGORY_PHRASES_EN.get(cat_lower)
        if not phrase_template:
            if "bottleneck" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_EN["bottleneck"]
            elif "counterflow" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_EN["counterflow"]
            elif "congestion" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_EN["critical_density"]
            elif "accumulation" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_EN["rapid_accumulation"]
            elif "density" in title_clean.lower() or "warning" in title_clean.lower():
                phrase_template = CATEGORY_PHRASES_EN["occupancy_warning"]
            elif occupancy_pct is not None:
                phrase_template = "{location} has reached {occupancy} percent occupancy."
            elif people_count is not None:
                phrase_template = "{people_count} people detected at {location}."
            else:
                phrase_template = "Unusual crowd condition detected at {location}."

        if occupancy_pct is not None and "{occupancy}" in phrase_template:
            condition_text = phrase_template.format(location=location, occupancy=occupancy_pct)
        elif people_count is not None and "{people_count}" in phrase_template:
            condition_text = phrase_template.format(location=location, people_count=people_count)
        elif occupancy_pct is not None and (
            "high crowd density" in title_clean.lower() or ("density" in title_clean.lower() and "high" in title_clean.lower())
        ):
            condition_text = f"High crowd density detected at {location}. Current occupancy is {occupancy_pct} percent."
        elif occupancy_pct is not None and cat_lower in ("occupancy_warning", "crowd_density", ""):
            condition_text = f"{location} has reached {occupancy_pct} percent occupancy."
        else:
            condition_text = phrase_template.format(location=location)

    # Optional verified action from intelligence system
    action_raw = (
        measurements.get("recommended_action")
        or measurements.get("action")
        or measurements.get("mitigation")
    )
    action_text = ""
    if action_raw and isinstance(action_raw, str):
        cleaned_action = _clean_text(action_raw).rstrip(".")
        if cleaned_action:
            if lang == "hi":
                action_clean_lower = cleaned_action.lower()
                action_text = ACTION_TRANSLITERATIONS_HI.get(action_clean_lower, f"{cleaned_action}।")
            else:
                action_text = f"{cleaned_action}."

    # Assemble announcement
    parts = [prefix, condition_text]
    if action_text:
        parts.append(action_text)

    spoken = " ".join(parts).strip()
    spoken = re.sub(r"\s+", " ", spoken)

    # Enforce safe length limit for control room speech
    if len(spoken) > MAX_ANNOUNCEMENT_LENGTH:
        clipped = spoken[:MAX_ANNOUNCEMENT_LENGTH]
        last_dot = max(clipped.rfind("."), clipped.rfind("।"))
        if last_dot > len(prefix):
            spoken = clipped[: last_dot + 1]
        else:
            spoken = clipped.rstrip() + "..."

    return spoken
