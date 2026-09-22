# Conference agenda input schema

The HTML builder consumes two UTF-8 JSON files: an agenda array and a conference configuration object.

## Agenda records

Prefer explicit `title` and `description` fields:

```json
[
  {
    "sessionId": "source-session-123",
    "day": "Tuesday, September 22nd, 2026",
    "dayDisplay": "Tuesday, Sep 22",
    "time": "10:00 AM – 10:40 AM",
    "title": "How Buildings Learn",
    "description": "A discussion of adaptive buildings and operating data.",
    "room": "Venetian Ballroom A",
    "track": "Main Stage",
    "themes": ["Commercial", "AI & Robotics"],
    "speakers": [
      {
        "name": "Alex Rivera",
        "title": "Chief Product Officer",
        "organization": "Example Properties"
      }
    ]
  }
]
```

Required for a useful session: `day`, `time`, and either `title` or `description`.

- `sessionId`: Preserve the source ID when possible. The builder derives a stable fallback when absent.
- `day`: Canonical filter value. Keep the year here when the source provides it.
- `dayDisplay`: Optional display label. Without it, dates shaped like `Tuesday, September 22nd, 2026` become `Tuesday, Sep 22`.
- `title`: Session title.
- `description`: Synopsis only when `title` is present. For legacy data without `title`, the first paragraph becomes the title and remaining paragraphs become the synopsis.
- `track`: Retained for spreadsheet export but intentionally omitted from the HTML cards.
- `themes`: Prefer an array. The legacy singular `theme` field may contain a comma-separated string.
- `speakers`: Prefer an array of `{name, title, organization}` objects. A newline-separated string in final display format is also accepted.

Speaker display format joins the available `Name`, `Title`, and `Organization` values with ` - `. Omit missing title or organization values instead of inserting placeholder text.

## Conference configuration

```json
{
  "conferenceName": "Example Conference 2027",
  "agendaTitle": "Example Conference 2027 Agenda",
  "pageTitle": "Example Conference 2027 Agenda",
  "venue": "Convention Center",
  "location": "Chicago",
  "dateRange": "May 3–5, 2027",
  "description": "Filterable Example Conference 2027 agenda.",
  "sourceUrl": "https://example.com/agenda",
  "sourceLabel": "View the live conference agenda",
  "retrievedDate": "April 10, 2027",
  "secondaryTheme": "AI & Robotics",
  "storageKey": "example-conference-2027"
}
```

- `conferenceName` is the only strongly recommended configuration value.
- `venue`, `location`, and `dateRange` are joined into the small header line.
- `secondaryTheme` is optional. When a session has exactly two themes and one matches this value, that badge inherits the primary theme's color.
- `storageKey` should be stable and unique per conference edition so stars persist without colliding with another event.
- `themeColors` may optionally map exact theme names to `{background, text, accent}` color objects. Otherwise colors are assigned deterministically from the built-in palette.
