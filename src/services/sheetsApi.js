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

export function mergeRoadmapData(sheetPayload) {
  return {
    ...ROADMAP_DEFAULTS,
    ...sheetPayload,
    meta: { ...ROADMAP_DEFAULTS.meta, ...(sheetPayload?.meta || {}) },
    cohorts: sheetPayload?.cohorts?.length
      ? sheetPayload.cohorts
      : ROADMAP_DEFAULTS.cohorts,
  };
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

export function validateInitiativeForm(fields) {
  const errors = {};
  const team = String(fields.team || "").trim();
  const id = String(fields.id || "").trim();
  const name = String(fields.name || "").trim();
  const description = String(fields.description || "").trim();
  const timelineStart = String(fields.timelineStart || "").trim();
  const timelineEnd = String(fields.timelineEnd || "").trim();
  const cohort = String(fields.cohort || "").trim();

  if (!team) errors.team = "Team is required.";
  if (!id) errors.id = "ID is required.";
  if (!name) errors.name = "Name is required.";
  if (!description) errors.description = "Description is required.";
  if (!timelineStart) errors.timelineStart = "Start date is required.";
  if (!timelineEnd) errors.timelineEnd = "End date is required.";
  if (timelineStart && timelineEnd && timelineEnd < timelineStart) {
    errors.timelineEnd = "End date must be on or after start date.";
  }
  if (cohort && !["c1", "c2", "c3", "c4"].includes(cohort)) {
    errors.cohort = "Cohort must be c1, c2, c3, or c4.";
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}
