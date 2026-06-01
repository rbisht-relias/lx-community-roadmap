import { resolveStatusDefinitions } from "../config/statusConfig";
import { ROADMAP_DEFAULTS } from "../config/roadmapDefaults";

function getApiUrl() {
  const url = import.meta.env.VITE_SHEETS_API_URL;
  return url ? String(url).trim().replace(/\/$/, "") : "";
}

export function hasSheetsApi() {
  return Boolean(getApiUrl());
}

export function getGoogleSheetUrl() {
  const url = import.meta.env.VITE_GOOGLE_SHEET_URL;
  return url ? String(url).trim() : "";
}

function isTeamFilterDefinition(entry) {
  return entry && typeof entry === "object" && entry.id && entry.label && !entry.timeline;
}

function resolveTeamFilterDefinitions(payload) {
  if (Array.isArray(payload?.cohorts) && isTeamFilterDefinition(payload.cohorts[0])) {
    return payload.cohorts;
  }
  if (Array.isArray(payload?.teams) && payload.teams.length > 0) {
    if (!payload.teams[0] || isTeamFilterDefinition(payload.teams[0])) {
      return payload.teams;
    }
  }
  return ROADMAP_DEFAULTS.teams;
}

export function mergeRoadmapData(sheetPayload) {
  const payload = sheetPayload || {};
  const sheetData = { ...payload };
  delete sheetData.teams;
  delete sheetData.cohorts;
  delete sheetData.statuses;

  return {
    ...ROADMAP_DEFAULTS,
    ...sheetData,
    meta: { ...ROADMAP_DEFAULTS.meta, ...(payload.meta || {}) },
    teams: resolveTeamFilterDefinitions(payload),
    statuses: resolveStatusDefinitions(payload.statuses),
  };
}

export function getValidTeamIds(data) {
  return (data?.teams || []).map((t) => t.id).filter(Boolean);
}

export function getTeamOptionsForAdmin(data) {
  return (data?.teams || []).map((t) => ({
    id: t.id,
    label: t.label === t.id ? t.label : `${t.label} (${t.id})`,
  }));
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export async function fetchRoadmap() {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error(
      "VITE_SHEETS_API_URL is not set. Copy .env.example to .env and add your Google Apps Script Web App URL (see README.md)."
    );
  }

  const res = await fetch(apiUrl);
  const payload = await parseJsonResponse(res);
  return mergeRoadmapData(payload);
}

async function postToSheetsApi(payload) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error(
      "VITE_SHEETS_API_URL is not set. Configure the Google Apps Script URL to add initiatives."
    );
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const json = await parseJsonResponse(res);
  if (json.ok === false) {
    throw new Error(json.error || "Request failed.");
  }
  return json;
}

export async function addInitiative(payload) {
  return postToSheetsApi(payload);
}

export async function deleteInitiative({ adminToken, team, id }) {
  return postToSheetsApi({
    action: "delete",
    adminToken,
    team: String(team || "").trim().toLowerCase(),
    id: String(id || "").trim(),
  });
}

export async function addTeam({ adminToken, teamId, teamName, color }) {
  return postToSheetsApi({
    action: "addTeam",
    adminToken,
    teamId: String(teamId || "").trim(),
    teamName: String(teamName || "").trim(),
    color: String(color || "").trim(),
  });
}

export async function deleteTeam({ adminToken, teamId }) {
  return postToSheetsApi({
    action: "deleteTeam",
    adminToken,
    teamId: String(teamId || "").trim(),
  });
}

export async function updateInitiativeStatus({ adminToken, team, id, status }) {
  return postToSheetsApi({
    action: "updateStatus",
    adminToken,
    team: String(team || "").trim().toLowerCase(),
    id: String(id || "").trim(),
    status: String(status || "").trim(),
  });
}

function normalizeTeamsField(teams) {
  if (Array.isArray(teams)) {
    return teams.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(teams || "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function getValidStatusLabels(data) {
  return (data?.statuses || []).map((s) => s.label).filter(Boolean);
}

export function validateInitiativeForm(fields, validTeamIds = [], validStatusLabels = []) {
  const errors = {};
  const domain = String(fields.domain ?? fields.team ?? "").trim();
  const id = String(fields.id || "").trim();
  const name = String(fields.name || "").trim();
  const description = String(fields.description || "").trim();
  const timelineStart = String(fields.timelineStart || "").trim();
  const timelineEnd = String(fields.timelineEnd || "").trim();
  const status = String(fields.status || "").trim();
  const teamIds = normalizeTeamsField(fields.teams ?? fields.cohort);

  if (!domain) errors.domain = "Domain is required.";
  if (!id) errors.id = "ID is required.";
  if (!name) errors.name = "Name is required.";
  if (!description) errors.description = "Description is required.";
  if (!timelineStart) errors.timelineStart = "Start date is required.";
  if (!timelineEnd) errors.timelineEnd = "End date is required.";
  if (timelineStart && timelineEnd && timelineEnd < timelineStart) {
    errors.timelineEnd = "End date must be on or after start date.";
  }

  if (teamIds.length > 0 && validTeamIds.length > 0) {
    const invalid = teamIds.filter((t) => !validTeamIds.includes(t));
    if (invalid.length > 0) {
      errors.teams = `Teams must be one of: ${validTeamIds.join(", ")}.`;
    }
  }

  if (status && validStatusLabels.length > 0 && !validStatusLabels.includes(status)) {
    errors.status = `Status must be one of: ${validStatusLabels.join(", ")}.`;
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

const TEAM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateTeamForm({ teamId, teamName, color }) {
  const errors = {};
  const id = String(teamId || "").trim();
  const name = String(teamName || "").trim();
  const colorVal = String(color || "").trim();

  if (!id) errors.teamId = "Team Id is required.";
  else if (!TEAM_ID_PATTERN.test(id)) {
    errors.teamId = "Use letters, numbers, hyphens, or underscores only.";
  }

  if (!name) errors.teamName = "Team Name is required.";

  if (colorVal && !/^#[0-9A-Fa-f]{6}$/.test(colorVal)) {
    errors.color = "Color must be a hex value like #8b5cf6.";
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}
