export const RESERVED_DATA_KEYS = new Set(["meta", "quarters", "teams", "cohorts"]);
export const DEFAULT_INITIATIVE_COLOR = "#64748b";

export function getDomainKeys(data) {
  return Object.keys(data).filter(
    (key) => !RESERVED_DATA_KEYS.has(key) && Array.isArray(data[key])
  );
}

/** @deprecated use getDomainKeys */
export const getTeamKeys = getDomainKeys;

export function formatDomainLabel(domainId) {
  return domainId.charAt(0).toUpperCase() + domainId.slice(1);
}

/** @deprecated use formatDomainLabel */
export const formatTeamLabel = formatDomainLabel;

export function getDomainsForFilter(data) {
  const domains = [{ id: "all", label: "All domains" }];
  getDomainKeys(data).forEach((id) => {
    domains.push({ id, label: formatDomainLabel(id) });
  });
  return domains;
}

/** Parse sheet/API value into team id list (comma-separated or legacy single cohort). */
export function parseInitiativeTeams(item) {
  if (!item) return [];
  if (Array.isArray(item.teams)) {
    return item.teams.map((t) => String(t).trim()).filter(Boolean);
  }
  const raw = item.teams ?? item.cohort;
  if (!raw) return [];
  return String(raw)
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function initiativeMatchesTeamsFilter(item, selectedTeams) {
  if (!selectedTeams || selectedTeams.size === 0) return true;
  const assigned = parseInitiativeTeams(item);
  if (assigned.length === 0) return false;
  return [...selectedTeams].some((id) => assigned.includes(id));
}

export function withDefaultColor(item) {
  return { ...item, color: item.color || DEFAULT_INITIATIVE_COLOR };
}

export function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDate(iso) {
  const d = parseDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimelineRange(timeline) {
  if (!Array.isArray(timeline) || timeline.length < 2) return "";
  const [start, end] = timeline;
  if (!start || !end) return "";
  return `${formatDisplayDate(start)} — ${formatDisplayDate(end)}`;
}

export function parseQuarterEnd(value) {
  if (!value) return null;
  const normalized = String(value).includes("T") ? value : `${value}T23:59:59`;
  return parseDate(normalized);
}

const CALENDAR_QUARTERS = [
  { label: "Q1", start: "01-01", end: "03-31" },
  { label: "Q2", start: "04-01", end: "06-30" },
  { label: "Q3", start: "07-01", end: "09-30" },
  { label: "Q4", start: "10-01", end: "12-31" },
];

export function collectTimelineDates(data) {
  const dates = [];
  getDomainKeys(data).forEach((key) => {
    (data[key] || []).forEach((item) => {
      if (Array.isArray(item.timeline)) {
        item.timeline.forEach((value) => {
          const parsed = parseDate(value);
          if (parsed) dates.push(parsed);
        });
      }
    });
  });
  return dates;
}

export function getYearBoundsFromData(data) {
  const dates = collectTimelineDates(data);
  if (dates.length === 0) {
    const year = new Date().getFullYear();
    return { minYear: year, maxYear: year };
  }
  const years = dates.map((d) => d.getFullYear());
  return { minYear: Math.min(...years), maxYear: Math.max(...years) };
}

export function buildQuartersForYearRange(minYear, maxYear) {
  const raw = [];
  for (let year = minYear; year <= maxYear; year++) {
    CALENDAR_QUARTERS.forEach(({ label, start, end }) => {
      raw.push({
        year,
        label,
        start: `${year}-${start}`,
        end: `${year}-${end}`,
      });
    });
  }
  return raw;
}

export function generateQuartersFromData(data) {
  const { minYear, maxYear } = getYearBoundsFromData(data);
  return buildQuartersForYearRange(minYear, maxYear);
}

function parseQuartersRaw(raw) {
  const quarters = raw.map((q) => ({
    year: q.year,
    label: q.label,
    start: parseDate(q.start),
    end: parseQuarterEnd(q.end),
  }));
  if (quarters.some((q) => !q.start || !q.end)) {
    throw new Error("Each quarter needs valid start and end dates");
  }
  return quarters;
}

export function setQuartersFromData(data) {
  const raw =
    Array.isArray(data.quarters) && data.quarters.length > 0
      ? data.quarters
      : generateQuartersFromData(data);

  if (!raw.length) {
    throw new Error("Could not build quarters — add initiatives with timeline dates");
  }

  return parseQuartersRaw(raw);
}

export function dateToColumn(date, quarters) {
  for (let i = 0; i < quarters.length; i++) {
    if (date >= quarters[i].start && date <= quarters[i].end) return i + 1;
  }
  if (date < quarters[0].start) return 1;
  return quarters.length;
}

export function timelineToSpan(timeline, quarters) {
  const start = parseDate(timeline[0]);
  const end = parseDate(timeline[1]);
  if (!start || !end) return { start: 1, end: 2 };
  const colStart = dateToColumn(start, quarters);
  const colEnd = dateToColumn(end, quarters);
  return { start: colStart, end: Math.max(colStart + 1, colEnd + 1) };
}

export function assignLanes(initiatives, quarters) {
  const lanes = [];
  return initiatives.map((item) => {
    const span = timelineToSpan(item.timeline || [], quarters);
    let lane = 0;
    while (
      lanes[lane] &&
      lanes[lane].some((placed) => !(span.end <= placed.start || span.start >= placed.end))
    ) {
      lane++;
    }
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push({ start: span.start, end: span.end });
    return { ...item, span, lane };
  });
}

export function buildYearSpans(quarters) {
  const spans = [];
  let i = 0;
  while (i < quarters.length) {
    const year = quarters[i].year;
    let count = 0;
    while (i + count < quarters.length && quarters[i + count].year === year) count++;
    spans.push({ year, count, startCol: i + 2 });
    i += count;
  }
  return spans;
}

export function getAllInitiatives(data) {
  return getDomainKeys(data).flatMap((key) => (data[key] || []).map(withDefaultColor));
}

export function getRoadmapRows(data, quarters) {
  return getDomainKeys(data).map((key) => ({
    id: key,
    label: formatDomainLabel(key),
    initiatives: assignLanes((data[key] || []).map(withDefaultColor), quarters),
  }));
}

export function initiativeMatchesFilter(item, category, filterState) {
  if (filterState.domain !== "all" && category !== filterState.domain) return false;
  if (
    filterState.initiatives &&
    filterState.initiatives.size > 0 &&
    !filterState.initiatives.has(item.id)
  ) {
    return false;
  }
  if (!initiativeMatchesTeamsFilter(item, filterState.teams)) return false;
  return true;
}

export function rowMatchesDomainFilter(category, filterState) {
  if (filterState.domain === "all") return true;
  return filterState.domain === category;
}

/** @deprecated use rowMatchesDomainFilter */
export const rowMatchesTeamFilter = rowMatchesDomainFilter;

export function isFilterActive(filterState) {
  return (
    filterState.domain !== "all" ||
    (filterState.initiatives && filterState.initiatives.size > 0) ||
    (filterState.teams && filterState.teams.size > 0)
  );
}

export function getQuarterRangeLabel(quarters) {
  if (!quarters.length) return "";
  const first = quarters[0];
  const last = quarters[quarters.length - 1];
  return `${first.label} ${first.year} — ${last.label} ${last.year}`;
}

export function getDomainScopeLabel(filterState) {
  if (!filterState || filterState.domain === "all") return "all domains";
  return formatDomainLabel(filterState.domain);
}

/** e.g. "Q1 2026 — Q4 2030 · all domains" from loaded data + active filters */
export function getSubtitle(quarters, filterState) {
  const range = getQuarterRangeLabel(quarters);
  const domainScope = getDomainScopeLabel(filterState);
  if (range && domainScope) return `${range} · ${domainScope}`;
  return range || domainScope || "";
}

export const INITIAL_FILTER_STATE = {
  domain: "all",
  initiatives: null,
  teams: null,
};
