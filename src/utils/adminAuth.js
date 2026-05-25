import { ADMIN_TOKEN_STORAGE_KEY } from "../config/roadmapDefaults";

const URL_TOKEN_PARAM = "token";

/** Read ?token= from the URL and persist it as the admin token. Returns the token if applied. */
export function applyAdminTokenFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get(URL_TOKEN_PARAM);
    if (!token) return "";
    const trimmed = String(token).trim();
    if (!trimmed) return "";
    setStoredAdminToken(trimmed);
    return trimmed;
  } catch {
    return "";
  }
}

export function getStoredAdminToken() {
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    return token ? String(token).trim() : "";
  } catch {
    return "";
  }
}

export function setStoredAdminToken(token) {
  const trimmed = String(token || "").trim();
  try {
    if (trimmed) {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear saved admin token (e.g. when user clicks Lock). */
export function clearStoredAdminTokens() {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
