/** Merged on top of Google Sheets data (meta + cohort filters). */
export const ROADMAP_TITLE = "Community roadmap";

export const ROADMAP_DEFAULTS = {
  meta: {},
  cohorts: [
    { id: "c1", label: "Cohort 1", color: "#8b5cf6" },
    { id: "c2", label: "Cohort 2", color: "#eab308" },
    { id: "c3", label: "Cohort 3", color: "#14b8a6" },
    { id: "c4", label: "Cohort 4", color: "#3b82f6" },
  ],
};

export const ADMIN_TOKEN_STORAGE_KEY = "roadmap_admin_token";

export const COHORT_OPTIONS = [
  { value: "", label: "None" },
  { value: "c1", label: "Cohort 1 (c1)" },
  { value: "c2", label: "Cohort 2 (c2)" },
  { value: "c3", label: "Cohort 3 (c3)" },
  { value: "c4", label: "Cohort 4 (c4)" },
];
