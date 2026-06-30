/**
 * Real in-browser database (IndexedDB via Dexie).
 *
 * This is the app's source of truth while running locally. It exposes:
 *   - The roadmap contract used by sheetsApi.js: getRoadmap() / postToLocal()
 *   - Site + Cookiebot-report functions used by the Sites view.
 *
 * To move to a Microsoft (SharePoint/Excel) backend later, implement the same
 * GET/POST contract remotely and flip VITE_DATA_SOURCE=remote — no UI changes.
 */
import Dexie from "dexie";
import { DEFAULT_STATUSES } from "../config/statusConfig";
import { DEFAULT_PRIORITIES } from "../config/priorityConfig";

export const LOCAL_ADMIN_TOKEN =
  (import.meta.env.VITE_LOCAL_ADMIN_TOKEN || "local-dev").trim();

export const db = new Dexie("roadmap_app");

db.version(1).stores({
  // key = `${domain}::${id}` (unique); indexes on domain + id for lookups.
  projects: "key, domain, id",
  teams: "id",
  sites: "++id, name",
  reports: "++id, siteId, uploadedAt",
});

function projectKey(domain, id) {
  return `${String(domain).toLowerCase()}::${String(id)}`;
}

const SEED_TEAMS = [
  { id: "core", label: "Core Eng", color: "#8b5cf6" },
  { id: "design", label: "Design", color: "#ec4899" },
  { id: "data", label: "Data", color: "#14b8a6" },
  { id: "qa", label: "QA", color: "#f97316" },
];

const SEED_PROJECTS = [
  { domain: "platform", id: "PLAT-1", name: "Auth revamp", description: "Replace legacy auth with SSO and MFA across all apps.", timeline: ["2026-01-12", "2026-03-28"], status: "In Progress", teams: ["core"], owner: "Jane Doe", priority: "High", link: "https://example.com/projects/plat-1", progress: 45 },
  { domain: "platform", id: "PLAT-2", name: "API gateway", description: "Centralize routing, rate limiting, and observability.", timeline: ["2026-03-02", "2026-06-30"], status: "Future", teams: ["core", "data"], owner: "Sam Lee", priority: "Medium", link: "", progress: 0 },
  { domain: "platform", id: "PLAT-3", name: "Cost optimization", description: "Right-size infrastructure and cut idle spend.", timeline: ["2026-07-01", "2026-09-15"], status: "At Risk", teams: ["core"], owner: "Priya N.", priority: "High", link: "", progress: 10 },
  { domain: "marketing", id: "MKT-1", name: "Brand refresh", description: "New visual identity, logo, and site theme.", timeline: ["2026-02-01", "2026-04-30"], status: "Close to done", teams: ["design"], owner: "Alex Park", priority: "Medium", link: "https://example.com/projects/mkt-1", progress: 80 },
  { domain: "marketing", id: "MKT-2", name: "Q3 campaign", description: "Multi-channel launch campaign for the new release.", timeline: ["2026-06-15", "2026-09-30"], status: "Future", teams: ["design", "data"], owner: "Jordan Kim", priority: "Low", link: "", progress: 0 },
  { domain: "mobile", id: "MOB-1", name: "Offline mode", description: "Local caching and sync for spotty connectivity.", timeline: ["2026-01-20", "2026-05-10"], status: "In Progress", teams: ["core", "qa"], owner: "Chris Wong", priority: "High", link: "", progress: 55 },
  { domain: "mobile", id: "MOB-2", name: "Accessibility pass", description: "WCAG AA audit and remediation across screens.", timeline: ["2026-05-01", "2026-07-31"], status: "Done", teams: ["design", "qa"], owner: "Robin Shah", priority: "Medium", link: "", progress: 100 },
];

const SEED_SITES = [
  { name: "Main marketing site", url: "https://www.example.com" },
  { name: "Docs portal", url: "https://docs.example.com" },
];

db.on("populate", () => {
  db.teams.bulkAdd(SEED_TEAMS.map((t) => ({ ...t })));
  db.projects.bulkAdd(
    SEED_PROJECTS.map((p) => ({ ...p, key: projectKey(p.domain, p.id) }))
  );
  db.sites.bulkAdd(SEED_SITES.map((s) => ({ ...s })));
});

/** Strip the internal storage key + domain before handing a project to the UI. */
function toInitiative(row) {
  const { key, domain, ...rest } = row;
  void key;
  void domain;
  return rest;
}

/* ------------------------------- Roadmap ------------------------------- */

/** Assemble the nested payload the rest of the app expects. */
export async function getRoadmap() {
  const [projects, teams] = await Promise.all([db.projects.toArray(), db.teams.toArray()]);
  const payload = {
    teams: teams.map((t) => ({ ...t })),
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    priorities: DEFAULT_PRIORITIES.map((p) => ({ ...p })),
  };
  projects.forEach((row) => {
    const domain = row.domain;
    if (!payload[domain]) payload[domain] = [];
    payload[domain].push(toInitiative(row));
  });
  return payload;
}

function parseTeams(value) {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  return String(value || "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function addProject(payload) {
  const domain = String(payload.team || "").trim().toLowerCase();
  const id = String(payload.id || "").trim();
  if (!domain) throw new Error("Domain is required.");
  if (!id) throw new Error("ID is required.");
  const key = projectKey(domain, id);
  if (await db.projects.get(key)) throw new Error(`ID already exists: ${id}`);
  await db.projects.add({
    key,
    domain,
    id,
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    timeline: [String(payload.timelineStart || ""), String(payload.timelineEnd || "")],
    status: String(payload.status || "").trim(),
    teams: parseTeams(payload.teams),
    owner: String(payload.owner || "").trim(),
    priority: String(payload.priority || "").trim(),
    link: String(payload.link || "").trim(),
    progress: Number(payload.progress) || 0,
  });
  return { ok: true };
}

async function updateProject(payload) {
  const domain = String(payload.team || "").trim().toLowerCase();
  const id = String(payload.id || "").trim();
  const key = projectKey(domain, id);
  const row = await db.projects.get(key);
  if (!row) throw new Error(`ID not found: ${id}`);
  const next = {
    ...row,
    name: String(payload.name ?? row.name).trim(),
    description: String(payload.description ?? row.description).trim(),
    timeline: [
      String(payload.timelineStart || row.timeline?.[0] || ""),
      String(payload.timelineEnd || row.timeline?.[1] || ""),
    ],
    status: String(payload.status ?? row.status ?? "").trim(),
    teams: parseTeams(payload.teams),
    owner: String(payload.owner ?? row.owner ?? "").trim(),
    priority: String(payload.priority ?? row.priority ?? "").trim(),
    link: String(payload.link ?? row.link ?? "").trim(),
  };
  if (payload.progress !== undefined) next.progress = Number(payload.progress) || 0;
  await db.projects.put(next);
  return { ok: true };
}

async function deleteProject(payload) {
  const key = projectKey(payload.team, payload.id);
  const existing = await db.projects.get(key);
  if (!existing) throw new Error(`ID not found: ${payload.id}`);
  await db.projects.delete(key);
  return { ok: true };
}

async function updateStatus(payload) {
  const key = projectKey(payload.team, payload.id);
  const row = await db.projects.get(key);
  if (!row) throw new Error(`ID not found: ${payload.id}`);
  await db.projects.update(key, { status: String(payload.status || "").trim() });
  return { ok: true };
}

async function addTeam(payload) {
  const teamId = String(payload.teamId || "").trim();
  if (!teamId) throw new Error("Team Id is required.");
  if (await db.teams.get(teamId)) throw new Error(`Team Id already exists: ${teamId}`);
  await db.teams.add({
    id: teamId,
    label: String(payload.teamName || teamId).trim(),
    color: String(payload.color || "").trim() || "#64748b",
  });
  return { ok: true };
}

async function deleteTeam(payload) {
  const teamId = String(payload.teamId || "").trim().toLowerCase();
  const projects = await db.projects.toArray();
  const used = projects.some((p) =>
    parseTeams(p.teams).some((t) => t.toLowerCase() === teamId)
  );
  if (used) throw new Error(`Cannot delete team "${payload.teamId}": it is in use.`);
  await db.teams.where("id").equalsIgnoreCase(teamId).delete();
  return { ok: true };
}

/** Mirror of the remote POST handler; mutates the DB. (Local mode has no auth.) */
export async function postToLocal(payload) {
  const action = String(payload.action || "add").trim().toLowerCase();
  if (action === "addteam") return addTeam(payload);
  if (action === "deleteteam") return deleteTeam(payload);
  if (action === "delete") return deleteProject(payload);
  if (action === "updatestatus") return updateStatus(payload);
  if (action === "update") return updateProject(payload);
  return addProject(payload);
}

export async function resetLocalData() {
  await db.delete();
  await db.open();
}

/* ------------------------- Sites & Cookiebot --------------------------- */

export function listSites() {
  return db.sites.orderBy("name").toArray();
}

export async function addSite({ name, url }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("Site name is required.");
  return db.sites.add({ name: cleanName, url: String(url || "").trim() });
}

export async function deleteSite(id) {
  await db.reports.where("siteId").equals(id).delete();
  await db.sites.delete(id);
}

export function listReports(siteId) {
  return db.reports.where("siteId").equals(siteId).reverse().sortBy("uploadedAt");
}

export async function getAllReports() {
  return db.reports.toArray();
}

export async function addReport({ siteId, file, summary, uploadedAt }) {
  return db.reports.add({
    siteId,
    fileName: file.name,
    fileType: file.type || "",
    size: file.size,
    blob: file,
    summary: summary || null,
    uploadedAt: uploadedAt || new Date().toISOString(),
  });
}

export async function deleteReport(id) {
  await db.reports.delete(id);
}

export async function getReportBlob(id) {
  const row = await db.reports.get(id);
  return row?.blob || null;
}
