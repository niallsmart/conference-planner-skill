---
name: conference-planner
description: Extract and normalize conference schedules from webpages or supplied files, and create a polished interactive static HTML agenda. Use when a user wants to turn an event program into a filterable personal conference planner; do not use for ordinary calendars or meeting scheduling.
---

# Conference Planner

Turn a published conference program into a polished mobile-friendly planning aid. Preserve the source wording and session structure while adapting the original schedule and other metadata.

## Workflow

1. Read the source schedule completely. For a live webpage, retrieve the current published agenda rather than relying on an older local copy. For PDFs or supplied files, use the relevant document-reading workflow.
2. Normalize every agenda entry to the schema in [references/input-schema.md](references/input-schema.md). Keep stable source IDs when available. Otherwise derive IDs from day, time, title, and room so saved stars survive regeneration.
3. Preserve speaker order and format each speaker from the available `Name`, `Title`, and `Organization` values, separated by ` - ` and with one speaker per line. Omit unknown title or organization values instead of inserting placeholder text. Do not include speaker photos.
4. Run `python3 scripts/validate_agenda.py /absolute/path/agenda.json`. Resolve missing required fields and malformed speaker records; review possible duplicates rather than deleting them automatically.

## Interactive HTML

Create a conference config JSON and normalized agenda JSON, then run:

```bash
node scripts/build_conference_agenda.mjs \
  --input /absolute/path/conference-name/agenda.json \
  --config /absolute/path/conference-name/conference.json \
  --output /absolute/path/conference-name/index.html
```

The builder provides:

- day and theme filters;
- AND keyword filtering across title, description, and speakers;
- whole-word match highlighting;
- per-session stars saved in browser local storage;
- stable Starred and Unstarred views that do not remove a session immediately after its star changes;
- a responsive mobile filter panel with a pinned reveal affordance after the inline filters scroll away; and
- a standalone HTML file with no external runtime dependency.

Keep visual-only revisions separate from extraction: update the normalized JSON only when schedule data changes, and regenerate HTML from that JSON for layout or interaction changes.

## Validation

After generation, confirm that:

- the HTML session count equals the normalized record count;
- conference-specific title, venue, location, date range, source link, and storage key appear correctly;
