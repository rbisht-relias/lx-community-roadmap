/** Merged on top of Google Sheets data (meta + team filter definitions). */
export const ROADMAP_TITLE = "Community roadmap";

export const ROADMAP_DEFAULTS = {
  meta: {},
  teams: [
    { id: "c1", label: "Team 1", color: "#8b5cf6" },
    { id: "c2", label: "Team 2", color: "#eab308" },
    { id: "c3", label: "Team 3", color: "#14b8a6" },
    { id: "c4", label: "Team 4", color: "#3b82f6" },
  ],
};

export const ADMIN_TOKEN_STORAGE_KEY = "roadmap_admin_token";

/** Valid team ids for admin checkboxes (must match ROADMAP_DEFAULTS.teams). */
export const TEAM_OPTIONS = [
  { id: "c1", label: "Team 1 (c1)" },
  { id: "c2", label: "Team 2 (c2)" },
  { id: "c3", label: "Team 3 (c3)" },
  { id: "c4", label: "Team 4 (c4)" },
];
