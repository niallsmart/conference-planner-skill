import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    parsed[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.config || !args.output) {
  console.error("Usage: node build_conference_agenda.mjs --input agenda.json --config conference.json --output agenda.html");
  process.exit(2);
}

const inputPath = path.resolve(args.input);
const configPath = path.resolve(args.config);
const outputPath = path.resolve(args.output);
const rows = JSON.parse(await fs.readFile(inputPath, "utf8"));
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

if (!Array.isArray(rows)) throw new Error("The agenda input must be a JSON array.");

const conferenceName = String(config.conferenceName || "Conference");
const agendaTitle = String(config.agendaTitle || `${conferenceName} Agenda`);
const pageTitle = String(config.pageTitle || agendaTitle);
const dateRange = String(config.dateRange || "");
const sourceUrl = String(config.sourceUrl || "");
const sourceLabel = String(config.sourceLabel || "View the live conference agenda");
const retrievedDate = String(config.retrievedDate || "");
const secondaryTheme = String(config.secondaryTheme || "");
const storageSlug = String(config.storageKey || conferenceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "conference");
const storageKey = `conferenceAgenda.${storageSlug}.starredSessions`;
const headerEyebrow = [config.venue, config.location, dateRange].filter(Boolean).join(" · ");
const pageDescription = String(config.description || `Filterable ${conferenceName} agenda${dateRange ? ` for ${dateRange}` : ""}.`);

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const monthAbbreviations = {
  January: "Jan", February: "Feb", March: "Mar", April: "Apr",
  May: "May", June: "Jun", July: "Jul", August: "Aug",
  September: "Sep", October: "Oct", November: "Nov", December: "Dec",
};
const formatDay = (day) => String(day || "").replace(
  /^(\w+), (\w+) (\d+)(?:st|nd|rd|th), \d{4}$/,
  (_, weekday, month, date) => `${weekday}, ${monthAbbreviations[month] || month} ${date}`,
);
const splitThemes = (row) => {
  const value = row.themes ?? row.theme ?? [];
  const themes = Array.isArray(value) ? value : String(value).split(/\s*,\s*/);
  return [...new Set(themes.map((theme) => String(theme).trim()).filter(Boolean))];
};
const formatSpeaker = (speaker) => {
  if (typeof speaker === "string") {
    return speaker.split(/\s+-\s+/)
      .map((part) => part.trim())
      .filter((part) => part && part.toLowerCase() !== "not listed")
      .join(" - ");
  }
  if (!speaker || typeof speaker !== "object" || !speaker.name) return "";
  return [speaker.name, speaker.title, speaker.organization]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");
};
const paletteSequence = [
  { background: "#EDE9FE", text: "#5B21B6", accent: "#7C3AED" },
  { background: "#DBEAFE", text: "#1E3A8A", accent: "#2563EB" },
  { background: "#FEF3C7", text: "#78350F", accent: "#D97706" },
  { background: "#CCFBF1", text: "#115E59", accent: "#0F766E" },
  { background: "#FFEDD5", text: "#9A3412", accent: "#EA580C" },
  { background: "#E0E7FF", text: "#3730A3", accent: "#4F46E5" },
  { background: "#F3E8D7", text: "#6B3A14", accent: "#9A5B27" },
  { background: "#FCE7F3", text: "#9D174D", accent: "#DB2777" },
  { background: "#CFFAFE", text: "#155E75", accent: "#0891B2" },
  { background: "#FEE2E2", text: "#991B1B", accent: "#DC2626" },
  { background: "#DCFCE7", text: "#166534", accent: "#16A34A" },
];
const defaultThemePalette = { background: "#E5E7EB", text: "#374151", accent: "#E3AD3E" };
const days = [...new Set(rows.map((row) => String(row.day || "")).filter(Boolean))];
const themes = [...new Set(rows.flatMap(splitThemes))].sort((a, b) => a.localeCompare(b));
const customThemePalette = config.themeColors && typeof config.themeColors === "object" ? config.themeColors : {};
const themePalette = Object.fromEntries(themes.map((theme, index) => [
  theme,
  customThemePalette[theme] || paletteSequence[index % paletteSequence.length],
]));
const dayLabel = (day) => {
  const matchingRow = rows.find((row) => String(row.day || "") === day);
  return String(matchingRow?.dayDisplay || matchingRow?.day_display || formatDay(day));
};

const dayOptions = days.map((day) =>
  `<option value="${escapeHtml(day)}">${escapeHtml(dayLabel(day))}</option>`
).join("\n");

const themeOptions = themes.map((theme) =>
  `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`
).join("\n");

const sessionCards = rows.map((row, index) => {
  const themeList = splitThemes(row);
  const descriptionText = String(row.description || "").trim();
  const descriptionParts = descriptionText.split(/\n\s*\n/);
  const title = String(row.title || descriptionParts.shift() || "Untitled session").trim();
  const synopsis = row.title ? descriptionText : descriptionParts.join("\n\n");
  const speakerValues = Array.isArray(row.speakers)
    ? row.speakers
    : String(row.speakers || "").split(/\r?\n/);
  const speakers = speakerValues.map(formatSpeaker).filter(Boolean);
  const primaryTheme = themeList.find((theme) => theme !== secondaryTheme) || themeList[0] || "";
  const primaryPalette = themePalette[primaryTheme] || defaultThemePalette;
  const themeBadges = themeList.map((theme) => {
    const isSecondary = theme === secondaryTheme && themeList.length === 2 && primaryTheme !== theme;
    const palette = isSecondary ? primaryPalette : (themePalette[theme] || defaultThemePalette);
    return `<span class="theme-badge${isSecondary ? " theme-badge-secondary" : ""}" style="--theme-bg: ${palette.background}; --theme-text: ${palette.text}; --theme-accent: ${palette.accent};">${escapeHtml(theme)}</span>`;
  }).join("");
  const themeMarkup = themeBadges ? `<div class="themes">${themeBadges}</div>` : "";
  const speakerMarkup = speakers.length
    ? `<div class="speakers"><h3>Speakers</h3><ul>${speakers.map((speaker) => `<li>${escapeHtml(speaker)}</li>`).join("")}</ul></div>`
    : "";
  const synopsisMarkup = synopsis
    ? `<p class="synopsis">${escapeHtml(synopsis).replaceAll("\n\n", "</p><p class=\"synopsis\">")}</p>`
    : "";
  const themesKey = themeList.map((theme) => theme.toLowerCase()).join("|");
  const searchKey = [title, synopsis, ...speakers].join(" ").toLowerCase();
  const sessionId = String(row.sessionId || row.session_id || row.id || crypto.createHash("sha256")
    .update([row.day, row.time, title, row.room].join("|"))
    .digest("hex").slice(0, 16));
  const room = String(row.room || "").trim();
  const roomMarkup = room
    ? `<div class="room-meta"><p class="room-label">Room</p><p class="room">${escapeHtml(room)}</p></div>`
    : "";

  return `<article class="session" style="--session-accent: ${primaryPalette.accent};" data-day="${escapeHtml(row.day)}" data-themes="${escapeHtml(themesKey)}" data-search="${escapeHtml(searchKey)}" data-session-id="${escapeHtml(sessionId)}" data-session-index="${index}">
    <div class="session-when">
      <p class="day">${escapeHtml(row.dayDisplay || row.day_display || formatDay(row.day))}</p>
      <p class="time">${escapeHtml(row.time || "")}</p>
      ${roomMarkup}
    </div>
    <div class="session-content">
      <div class="session-heading-row">
        <div class="session-title-group">
          <h2><span class="session-title">${escapeHtml(title)}</span>&nbsp;<button class="session-star" type="button" aria-pressed="false" aria-label="Star session: ${escapeHtml(title)}" title="Star this session"><span class="star-icon" aria-hidden="true">☆</span></button></h2>
        </div>
        ${themeMarkup}
      </div>
      ${synopsisMarkup}
      ${speakerMarkup}
    </div>
  </article>`;
}).join("\n");

const headerEyebrowMarkup = headerEyebrow
  ? `<p class="eyebrow">${escapeHtml(headerEyebrow)}</p>`
  : "";
const footerSnapshotMarkup = retrievedDate
  ? `<p>Static snapshot retrieved ${escapeHtml(retrievedDate)}.</p>`
  : "";
const footerSourceMarkup = sourceUrl
  ? `<p><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel)}</a></p>`
  : "";
const storageKeyLiteral = JSON.stringify(storageKey);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      color-scheme: light;
      --navy: #112c46;
      --navy-2: #183e60;
      --gold: #e3ad3e;
      --ink: #17283a;
      --muted: #5f6f7f;
      --line: #d6e0e8;
      --surface: #ffffff;
      --page: #edf3f7;
      --tag: #dcecf6;
      --shadow: 0 14px 38px rgba(17, 44, 70, 0.1);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-width: 320px;
      background:
        linear-gradient(rgba(17, 44, 70, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(17, 44, 70, 0.035) 1px, transparent 1px),
        var(--page);
      background-size: 28px 28px;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }

    a { color: inherit; }

    .masthead {
      border-top: 6px solid var(--gold);
      background: linear-gradient(135deg, var(--navy), var(--navy-2));
      color: #fff;
    }

    .masthead-inner,
    .filters-inner,
    main,
    footer {
      width: min(1440px, calc(100% - 40px));
      margin-inline: auto;
    }

    .masthead-inner {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 32px;
      padding: 32px 0 28px;
    }

    .eyebrow {
      margin: 0 0 4px;
      color: #a9cee8;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 1.05;
      letter-spacing: -0.035em;
    }

    .filter-bar {
      position: sticky;
      z-index: 10;
      top: 0;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 5px 18px rgba(17, 44, 70, 0.08);
      backdrop-filter: blur(12px);
    }

    .filters-inner {
      display: grid;
      grid-template-columns: repeat(3, minmax(175px, 1fr)) minmax(255px, auto);
      align-items: end;
      gap: 16px;
      padding: 16px 0;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--navy);
      font-size: 0.88rem;
      font-weight: 700;
    }

    select,
    input,
    button {
      min-height: 46px;
      border: 1px solid #aebdca;
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      font: inherit;
    }

    select,
    input {
      width: 100%;
    }

    select {
      height: 46px;
      padding: 0 42px 0 13px;
    }

    input { padding: 0 13px; }

    button {
      padding: 0 18px;
      border-color: var(--navy);
      background: var(--navy);
      color: #fff;
      cursor: pointer;
      font-weight: 700;
    }

    button:hover { background: #245173; }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible { outline: 3px solid rgba(227, 173, 62, 0.65); outline-offset: 2px; }

    .star-view {
      min-width: 255px;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .star-view legend {
      margin-bottom: 6px;
      color: var(--navy);
      font-size: 0.88rem;
      font-weight: 700;
    }

    .star-view-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      min-height: 46px;
      overflow: hidden;
      border: 1px solid #aebdca;
      border-radius: 8px;
      background: #fff;
    }

    .star-view button {
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      border-right: 1px solid var(--line);
      border-radius: 0;
      background: #fff;
      color: var(--navy);
      font-size: 0.88rem;
    }

    .star-view button:last-child { border-right: 0; }
    .star-view button:hover { background: #edf3f7; }
    .star-view button[aria-pressed="true"] { background: var(--navy); color: #fff; }

    main { padding: 28px 0 56px; }

    .session-list {
      display: grid;
      gap: 14px;
    }

    .session {
      display: grid;
      grid-template-columns: minmax(215px, 0.72fr) minmax(360px, 3.5fr);
      gap: 26px;
      padding: 24px;
      border: 1px solid var(--line);
      border-left: 5px solid var(--session-accent, var(--gold));
      border-radius: 12px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .session[hidden] { display: none; }
    .session-when { border-right: 1px solid var(--line); padding-right: 22px; }
    .day { margin: 0; color: var(--navy); font-size: 0.9rem; font-weight: 700; }
    .time { margin: 5px 0 0; font-size: 1.08rem; font-weight: 700; }
    .room-meta { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
    .room-label { margin: 0; color: var(--muted); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .room { margin: 2px 0 0; font-size: 0.94rem; font-weight: 700; }

    .session-heading-row { display: flex; align-items: center; gap: 18px; }
    .session-title-group { flex: 1 1 auto; min-width: 0; }
    .session-title-group h2 { min-width: 0; }
    .themes { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 7px; margin-left: auto; }
    .theme-badge {
      display: inline-flex;
      padding: 3px 9px;
      border: 1px solid var(--theme-accent);
      border-radius: 999px;
      background: var(--theme-bg);
      color: var(--theme-text);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .theme-badge-secondary { background: #fff; }

    .session-star {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      min-width: 1.25em;
      min-height: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: #7b8995;
      font-size: 1em;
      line-height: 1;
      vertical-align: -0.06em;
    }

    .session-star:hover { background: transparent; color: #a86400; }
    .session-star[aria-pressed="true"] { background: transparent; color: #c98508; }
    .star-icon { display: block; line-height: inherit; }

    .session h2 {
      margin: 0;
      color: var(--navy);
      font-size: 1.25rem;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .synopsis { margin: 12px 0 0; color: #405264; }

    .search-highlight {
      padding: 0 0.08em;
      border-radius: 2px;
      background: #ffe08a;
      color: inherit;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }

    .speakers { margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--line); }
    .speakers h3 { margin: 0 0 6px; color: var(--muted); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .speakers ul { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
    .speakers li { font-size: 0.92rem; }

    .empty-state {
      padding: 56px 24px;
      border: 1px dashed #9fb1c1;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.78);
      color: var(--muted);
      text-align: center;
    }

    footer {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 24px 0 36px;
      border-top: 1px solid #bfcbd5;
      color: var(--muted);
      font-size: 0.88rem;
    }

    footer p { margin: 0; }
    footer a { color: var(--navy); font-weight: 700; }

    .filter-placeholder { height: 0; }
    .mobile-filter-reveal,
    .mobile-filter-panel-header,
    .mobile-filter-backdrop { display: none; }

    @media (max-width: 1120px) {
      .masthead-inner { align-items: start; flex-direction: column; }
      .filters-inner { grid-template-columns: 1fr 1fr; }
      .session { grid-template-columns: 1fr; gap: 18px; }
      .session-when { border-right: 0; border-bottom: 1px solid var(--line); padding: 0 0 14px; }
    }

    @media (max-width: 580px) {
      .filter-bar { position: static; }
      body.mobile-filters-open { overflow: hidden; }

      .mobile-filter-reveal {
        position: fixed;
        z-index: 40;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 42px;
        padding: 0 16px;
        border: 0;
        border-radius: 0 0 10px 10px;
        background: var(--navy);
        box-shadow: 0 6px 18px rgba(17, 44, 70, 0.2);
        color: #fff;
        font-size: 0.9rem;
        transform: translateY(-110%);
        opacity: 0;
        pointer-events: none;
        transition: transform 180ms ease, opacity 180ms ease;
      }

      .mobile-filter-reveal:hover { background: var(--navy-2); }
      .mobile-filter-reveal.is-visible { transform: translateY(0); opacity: 1; pointer-events: auto; }

      .mobile-filter-backdrop {
        position: fixed;
        z-index: 45;
        inset: 0;
        display: block;
        background: rgba(10, 28, 43, 0.5);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }

      .mobile-filter-backdrop.is-visible { opacity: 1; pointer-events: auto; }

      .filter-bar.is-overlay-open {
        position: fixed;
        z-index: 50;
        top: 0;
        left: 0;
        right: 0;
        max-height: calc(100dvh - 14px);
        overflow-y: auto;
        border-radius: 0 0 14px 14px;
        background: #fff;
        box-shadow: 0 14px 42px rgba(17, 44, 70, 0.28);
        animation: mobile-filter-panel-in 180ms ease both;
      }

      .filter-bar.is-overlay-open .mobile-filter-panel-header {
        display: flex;
        grid-column: 1 / -1;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        color: var(--navy);
      }

      .mobile-filter-panel-header strong { font-size: 1rem; }

      .mobile-filter-hide {
        min-height: 34px;
        padding: 0 10px;
        border-color: #aebdca;
        background: #fff;
        color: var(--navy);
        font-size: 0.82rem;
      }

      .mobile-filter-hide:hover { background: #edf3f7; }

      @keyframes mobile-filter-panel-in {
        from { transform: translateY(-14px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .masthead-inner,
      .filters-inner,
      main,
      footer { width: min(100% - 28px, 1440px); }
      .masthead-inner { padding: 24px 0; }
      .filters-inner { grid-template-columns: 1fr; gap: 12px; }
      .session { padding: 19px; border-left-width: 4px; }
      footer { flex-direction: column; }
    }

    @media print {
      body { background: #fff; }
      .filter-bar { position: static; box-shadow: none; }
      button { display: none; }
      .session { break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div>
        ${headerEyebrowMarkup}
        <h1>${escapeHtml(agendaTitle)}</h1>
      </div>
    </div>
  </header>

  <div class="filter-placeholder" id="filter-placeholder" aria-hidden="true"></div>
  <section class="filter-bar" id="filter-panel" aria-label="Agenda filters">
    <div class="filters-inner">
      <div class="mobile-filter-panel-header">
        <strong>Filters</strong>
        <button class="mobile-filter-hide" id="mobile-filter-hide" type="button">Hide filters <span aria-hidden="true">↑</span></button>
      </div>
      <label for="day-filter">Day
        <select id="day-filter">
          <option value="">All days</option>
          ${dayOptions}
        </select>
      </label>
      <label for="theme-filter">Theme
        <select id="theme-filter">
          <option value="">All themes</option>
          ${themeOptions}
        </select>
      </label>
      <label for="text-filter">Keywords (all words required)
        <input id="text-filter" type="search" placeholder="Search title, description, speakers" autocomplete="off">
      </label>
      <fieldset class="star-view">
        <legend>Saved sessions</legend>
        <div class="star-view-options" role="group" aria-label="Filter by starred state">
          <button type="button" data-star-filter="all" aria-pressed="true">All</button>
          <button type="button" data-star-filter="starred" aria-pressed="false">Starred</button>
          <button type="button" data-star-filter="unstarred" aria-pressed="false">Unstarred</button>
        </div>
      </fieldset>
    </div>
  </section>
  <button class="mobile-filter-reveal" id="mobile-filter-reveal" type="button" aria-controls="filter-panel" aria-expanded="false" aria-hidden="true" tabindex="-1">
    <span>Show filters</span><span aria-hidden="true">↓</span>
  </button>
  <div class="mobile-filter-backdrop" id="mobile-filter-backdrop" aria-hidden="true"></div>

  <main>
    <div class="session-list" id="session-list">
      ${sessionCards}
    </div>
    <div class="empty-state" id="empty-state" hidden>No agenda entries match these filters.</div>
  </main>

  <footer>
    ${footerSnapshotMarkup}
    ${footerSourceMarkup}
  </footer>

  <script>
    const dayFilter = document.getElementById("day-filter");
    const themeFilter = document.getElementById("theme-filter");
    const textFilter = document.getElementById("text-filter");
    const emptyState = document.getElementById("empty-state");
    const filterBar = document.getElementById("filter-panel");
    const filterPlaceholder = document.getElementById("filter-placeholder");
    const mobileFilterReveal = document.getElementById("mobile-filter-reveal");
    const mobileFilterHide = document.getElementById("mobile-filter-hide");
    const mobileFilterBackdrop = document.getElementById("mobile-filter-backdrop");
    const mobileViewport = window.matchMedia("(max-width: 580px)");
    const sessions = [...document.querySelectorAll(".session")];
    const sessionStarButtons = [...document.querySelectorAll(".session-star")];
    const starViewButtons = [...document.querySelectorAll("[data-star-filter]")];
    const storageKey = ${storageKeyLiteral};
    let selectedStarView = "all";
    let mobileFiltersOpen = false;
    let mobileAffordanceFrame = 0;

    function loadStarredSessions() {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return new Set(Array.isArray(stored) ? stored : []);
      } catch {
        return new Set();
      }
    }

    const starredSessions = loadStarredSessions();

    function saveStarredSessions() {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...starredSessions]));
      } catch {
        // The star controls still work for this page view when storage is unavailable.
      }
    }

    function updateStarButton(button, isStarred) {
      const sessionTitle = button.closest(".session").querySelector(".session-title").textContent;
      button.setAttribute("aria-pressed", String(isStarred));
      button.setAttribute("aria-label", (isStarred ? "Unstar session: " : "Star session: ") + sessionTitle);
      button.title = isStarred ? "Remove star" : "Star this session";
      button.querySelector(".star-icon").textContent = isStarred ? "★" : "☆";
    }

    function setMobileRevealVisible(visible) {
      const shouldShow = visible && mobileViewport.matches && !mobileFiltersOpen;
      mobileFilterReveal.classList.toggle("is-visible", shouldShow);
      mobileFilterReveal.setAttribute("aria-hidden", String(!shouldShow));
      mobileFilterReveal.tabIndex = shouldShow ? 0 : -1;
    }

    function updateMobileFilterAffordance() {
      if (!mobileViewport.matches || mobileFiltersOpen) {
        setMobileRevealVisible(false);
        return;
      }

      const filterBounds = filterBar.getBoundingClientRect();
      const mostlyGoneThreshold = Math.min(56, filterBounds.height * 0.2);
      setMobileRevealVisible(filterBounds.bottom <= mostlyGoneThreshold);
    }

    function queueMobileFilterAffordanceUpdate() {
      if (mobileAffordanceFrame) return;
      mobileAffordanceFrame = requestAnimationFrame(() => {
        mobileAffordanceFrame = 0;
        updateMobileFilterAffordance();
      });
    }

    function openMobileFilters() {
      if (!mobileViewport.matches || mobileFiltersOpen) return;
      filterPlaceholder.style.height = filterBar.offsetHeight + "px";
      mobileFiltersOpen = true;
      filterBar.classList.add("is-overlay-open");
      mobileFilterBackdrop.classList.add("is-visible");
      mobileFilterBackdrop.setAttribute("aria-hidden", "false");
      mobileFilterReveal.setAttribute("aria-expanded", "true");
      document.body.classList.add("mobile-filters-open");
      setMobileRevealVisible(false);
      requestAnimationFrame(() => mobileFilterHide.focus());
    }

    function closeMobileFilters(returnFocus = false) {
      if (!mobileFiltersOpen) return;
      mobileFiltersOpen = false;
      filterBar.classList.remove("is-overlay-open");
      mobileFilterBackdrop.classList.remove("is-visible");
      mobileFilterBackdrop.setAttribute("aria-hidden", "true");
      mobileFilterReveal.setAttribute("aria-expanded", "false");
      document.body.classList.remove("mobile-filters-open");
      filterPlaceholder.style.height = "";
      updateMobileFilterAffordance();
      if (returnFocus && mobileFilterReveal.classList.contains("is-visible")) {
        requestAnimationFrame(() => mobileFilterReveal.focus());
      }
    }

    function handleMobileFilterKeydown(event) {
      if (!mobileFiltersOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileFilters(true);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...filterBar.querySelectorAll("button, input, select")]
        .filter((element) => !element.disabled && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleMobileViewportChange() {
      if (!mobileViewport.matches) closeMobileFilters(false);
      updateMobileFilterAffordance();
    }

    function isWordCharacter(character) {
      return Boolean(character && /[\\p{L}\\p{N}_]/u.test(character));
    }

    function isWholeWordAt(text, term, matchAt) {
      return !isWordCharacter(text[matchAt - 1])
        && !isWordCharacter(text[matchAt + term.length]);
    }

    function containsWholeWord(text, term) {
      let startAt = 0;
      let matchAt = text.indexOf(term, startAt);
      while (matchAt !== -1) {
        if (isWholeWordAt(text, term, matchAt)) return true;
        startAt = matchAt + term.length;
        matchAt = text.indexOf(term, startAt);
      }
      return false;
    }

    function clearSearchHighlights() {
      const parents = new Set();
      document.querySelectorAll("mark.search-highlight").forEach((mark) => {
        parents.add(mark.parentNode);
        mark.replaceWith(document.createTextNode(mark.textContent));
      });
      parents.forEach((parent) => parent.normalize());
    }

    function highlightSearchTerms(searchTerms) {
      const terms = [...new Set(searchTerms)].filter(Boolean);
      if (!terms.length) return;

      sessions.filter((session) => !session.hidden).forEach((session) => {
        session.querySelectorAll(".session-title, .synopsis, .speakers li").forEach((target) => {
          const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
          const textNodes = [];
          while (walker.nextNode()) textNodes.push(walker.currentNode);

          textNodes.forEach((textNode) => {
            const text = textNode.nodeValue;
            const lowerText = text.toLowerCase();
            const ranges = [];

            terms.forEach((term) => {
              let startAt = 0;
              let matchAt = lowerText.indexOf(term, startAt);
              while (matchAt !== -1) {
                if (isWholeWordAt(lowerText, term, matchAt)) {
                  ranges.push([matchAt, matchAt + term.length]);
                }
                startAt = matchAt + term.length;
                matchAt = lowerText.indexOf(term, startAt);
              }
            });

            if (!ranges.length) return;
            ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
            const mergedRanges = [];
            ranges.forEach(([start, end]) => {
              const previous = mergedRanges[mergedRanges.length - 1];
              if (previous && start <= previous[1]) {
                previous[1] = Math.max(previous[1], end);
              } else {
                mergedRanges.push([start, end]);
              }
            });

            const fragment = document.createDocumentFragment();
            let cursor = 0;
            mergedRanges.forEach(([start, end]) => {
              if (start > cursor) fragment.append(document.createTextNode(text.slice(cursor, start)));
              const mark = document.createElement("mark");
              mark.className = "search-highlight";
              mark.textContent = text.slice(start, end);
              fragment.append(mark);
              cursor = end;
            });
            if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
            textNode.replaceWith(fragment);
          });
        });
      });
    }

    function applyFilters() {
      const selectedDay = dayFilter.value;
      const selectedTheme = themeFilter.value.toLowerCase();
      const searchTerms = textFilter.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
      let visibleCount = 0;

      clearSearchHighlights();

      sessions.forEach((session) => {
        const matchesDay = !selectedDay || session.dataset.day === selectedDay;
        const sessionThemes = session.dataset.themes ? session.dataset.themes.split("|") : [];
        const matchesTheme = !selectedTheme || sessionThemes.includes(selectedTheme);
        const matchesText = searchTerms.every((term) => containsWholeWord(session.dataset.search, term));
        const isStarred = starredSessions.has(session.dataset.sessionId);
        const matchesStarView = selectedStarView === "all"
          || (selectedStarView === "starred" && isStarred)
          || (selectedStarView === "unstarred" && !isStarred);
        const visible = matchesDay && matchesTheme && matchesText && matchesStarView;
        session.hidden = !visible;
        session.classList.toggle("is-starred", isStarred);
        if (visible) visibleCount += 1;
      });

      emptyState.hidden = visibleCount !== 0;
      highlightSearchTerms(searchTerms);
    }

    dayFilter.addEventListener("change", applyFilters);
    themeFilter.addEventListener("change", applyFilters);
    textFilter.addEventListener("input", applyFilters);
    starViewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedStarView = button.dataset.starFilter;
        starViewButtons.forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
        applyFilters();
      });
    });

    sessionStarButtons.forEach((button) => {
      const session = button.closest(".session");
      updateStarButton(button, starredSessions.has(session.dataset.sessionId));
      button.addEventListener("click", () => {
        const sessionId = session.dataset.sessionId;
        if (starredSessions.has(sessionId)) {
          starredSessions.delete(sessionId);
        } else {
          starredSessions.add(sessionId);
        }
        saveStarredSessions();
        const isStarred = starredSessions.has(sessionId);
        updateStarButton(button, isStarred);
        session.classList.toggle("is-starred", isStarred);
      });
    });

    mobileFilterReveal.addEventListener("click", openMobileFilters);
    mobileFilterHide.addEventListener("click", () => closeMobileFilters(true));
    mobileFilterBackdrop.addEventListener("click", () => closeMobileFilters(true));
    document.addEventListener("keydown", handleMobileFilterKeydown);
    window.addEventListener("scroll", queueMobileFilterAffordanceUpdate, { passive: true });
    window.addEventListener("resize", queueMobileFilterAffordanceUpdate, { passive: true });
    if (mobileViewport.addEventListener) {
      mobileViewport.addEventListener("change", handleMobileViewportChange);
    } else {
      mobileViewport.addListener(handleMobileViewportChange);
    }

    applyFilters();
    requestAnimationFrame(updateMobileFilterAffordance);
  </script>
</body>
</html>`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, html, "utf8");
console.log(`Wrote ${rows.length} agenda entries to ${outputPath}`);
