#!/usr/bin/env python3
"""Validate normalized conference agenda JSON before artifact generation."""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


def title_for(row):
    title = str(row.get("title") or "").strip()
    if title:
        return title
    description = str(row.get("description") or "").strip()
    return description.split("\n\n", 1)[0].strip()


def themes_for(row):
    value = row.get("themes", row.get("theme", []))
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("agenda", type=Path)
    args = parser.parse_args()

    try:
        rows = json.loads(args.agenda.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(json.dumps({"valid": False, "error": str(error)}, indent=2))
        return 1

    if not isinstance(rows, list):
        print(json.dumps({"valid": False, "error": "Agenda root must be a JSON array."}, indent=2))
        return 1

    missing = []
    malformed_speakers = []
    keys = []
    themes = set()
    days = []

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            missing.append({"index": index, "fields": ["record must be an object"]})
            continue

        required_missing = [
            field
            for field, value in (
                ("day", row.get("day")),
                ("time", row.get("time")),
                ("title", title_for(row)),
            )
            if not str(value or "").strip()
        ]
        if required_missing:
            missing.append({"index": index, "fields": required_missing})

        day = str(row.get("day") or "").strip()
        if day and day not in days:
            days.append(day)
        themes.update(themes_for(row))

        key = (
            day.casefold(),
            str(row.get("time") or "").strip().casefold(),
            title_for(row).casefold(),
            str(row.get("room") or "").strip().casefold(),
        )
        keys.append(key)

        speakers = row.get("speakers", [])
        if isinstance(speakers, list):
            for speaker_index, speaker in enumerate(speakers):
                if isinstance(speaker, dict) and not str(speaker.get("name") or "").strip():
                    malformed_speakers.append({"index": index, "speaker": speaker_index})

    duplicate_counts = Counter(keys)
    duplicates = [
        {"day": key[0], "time": key[1], "title": key[2], "room": key[3], "count": count}
        for key, count in duplicate_counts.items()
        if count > 1
    ]
    result = {
        "valid": not missing and not malformed_speakers,
        "records": len(rows),
        "days": days,
        "themes": sorted(themes),
        "missingRequiredFields": missing,
        "malformedSpeakers": malformed_speakers,
        "possibleDuplicates": duplicates,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
