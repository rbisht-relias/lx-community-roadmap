import { useCallback, useState } from "react";
import { formatDomainLabel } from "../utils/roadmapUtils";
import { addInitiative, validateInitiativeForm } from "../services/sheetsApi";

const EMPTY_FORM = {
  domain: "",
  id: "",
  name: "",
  description: "",
  timelineStart: "",
  timelineEnd: "",
  status: "",
  teams: [],
};

function buildInitialForm(domains) {
  return { ...EMPTY_FORM, domain: domains[0] || "" };
}

export default function AdminModal({
  domains,
  teamOptions = [],
  validTeamIds = [],
  statusOptions = [],
  validStatusLabels = [],
  adminToken,
  onUnlock,
  onLock,
  onClose,
  onSuccess,
}) {
  const [tokenInput, setTokenInput] = useState("");
  const unlocked = Boolean(adminToken);
  const [form, setForm] = useState(() => buildInitialForm(domains));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = tokenInput.trim();
      if (!trimmed) return;
      onUnlock(trimmed);
    },
    [onUnlock, tokenInput]
  );

  const handleLogout = useCallback(() => {
    onLock();
    setTokenInput("");
  }, [onLock]);

  const updateField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next.teams;
      return next;
    });
    setSubmitError("");
  }, []);

  const toggleTeam = useCallback((teamId) => {
    setForm((prev) => {
      const set = new Set(prev.teams);
      if (set.has(teamId)) set.delete(teamId);
      else set.add(teamId);
      return { ...prev, teams: [...set] };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.teams;
      return next;
    });
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const { errors, valid } = validateInitiativeForm(
        form,
        validTeamIds,
        validStatusLabels
      );
      if (!valid) {
        setFieldErrors(errors);
        return;
      }

      setSubmitting(true);
      setSubmitError("");
      try {
        await addInitiative({
          adminToken,
          team: form.domain.trim(),
          id: form.id.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          timelineStart: form.timelineStart,
          timelineEnd: form.timelineEnd,
          status: form.status || "",
          teams: form.teams.join(","),
        });
        onSuccess?.();
        onClose();
      } catch (err) {
        setSubmitError(err.message || "Failed to save.");
      } finally {
        setSubmitting(false);
      }
    },
    [adminToken, form, onClose, onSuccess, validTeamIds, validStatusLabels]
  );

  const footer = (content) => (
    <footer className="admin-modal__footer">{content}</footer>
  );

  return (
    <div className="admin-modal" role="presentation" onClick={onClose}>
      <aside
        className="admin-modal__panel"
        role="dialog"
        aria-labelledby="admin-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal__header">
          <div className="admin-modal__header-text">
            <h2 id="admin-modal-title" className="admin-modal__title">
              Add initiative
            </h2>
            <p className="admin-modal__subtitle">Create a row in Google Sheets</p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {!unlocked ? (
          <form className="admin-modal__form" onSubmit={handleUnlock}>
            <div className="admin-modal__scroll theme-scroll">
              <p className="admin-modal__hint">
                Enter the admin token to unlock the form. Your session stays unlocked
                after refresh until you click Lock or close this browser tab.
              </p>
              <label className="admin-field">
                <span className="admin-field__label">Admin token</span>
                <input
                  type="password"
                  className="admin-field__input"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
            </div>
            {footer(
              <>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary">
                  Unlock
                </button>
              </>
            )}
          </form>
        ) : (
          <form className="admin-modal__form" onSubmit={handleSubmit}>
            <div className="admin-modal__scroll theme-scroll">
              <div className="admin-modal__status">
                <span className="admin-modal__status-dot" aria-hidden="true" />
                <span className="admin-modal__unlocked">Admin unlocked</span>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--small"
                  onClick={handleLogout}
                >
                  Lock
                </button>
              </div>

            <label className="admin-field">
              <span className="admin-field__label">
                Domain <span className="admin-field__req">*</span>
              </span>
              <select
                className="admin-field__input"
                value={form.domain}
                onChange={(e) => updateField("domain", e.target.value)}
                required
                disabled={domains.length === 0}
              >
                {domains.map((tab) => (
                  <option key={tab} value={tab}>
                    {formatDomainLabel(tab)}
                  </option>
                ))}
              </select>
              {domains.length === 0 ? (
                <span className="admin-field__error">No domains loaded yet.</span>
              ) : null}
              {fieldErrors.domain ? (
                <span className="admin-field__error">{fieldErrors.domain}</span>
              ) : null}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                ID <span className="admin-field__req">*</span>
              </span>
              <input
                type="text"
                className="admin-field__input"
                value={form.id}
                onChange={(e) => updateField("id", e.target.value)}
                required
              />
              {fieldErrors.id ? (
                <span className="admin-field__error">{fieldErrors.id}</span>
              ) : null}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                Name <span className="admin-field__req">*</span>
              </span>
              <input
                type="text"
                className="admin-field__input"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
              {fieldErrors.name ? (
                <span className="admin-field__error">{fieldErrors.name}</span>
              ) : null}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                Description <span className="admin-field__req">*</span>
              </span>
              <textarea
                className="admin-field__input admin-field__textarea"
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                required
              />
              {fieldErrors.description ? (
                <span className="admin-field__error">{fieldErrors.description}</span>
              ) : null}
            </label>

            <div className="admin-field-row">
              <label className="admin-field">
                <span className="admin-field__label">
                  Timeline start <span className="admin-field__req">*</span>
                </span>
                <input
                  type="date"
                  className="admin-field__input"
                  value={form.timelineStart}
                  onChange={(e) => updateField("timelineStart", e.target.value)}
                  required
                />
                {fieldErrors.timelineStart ? (
                  <span className="admin-field__error">{fieldErrors.timelineStart}</span>
                ) : null}
              </label>

              <label className="admin-field">
                <span className="admin-field__label">
                  Timeline end <span className="admin-field__req">*</span>
                </span>
                <input
                  type="date"
                  className="admin-field__input"
                  value={form.timelineEnd}
                  onChange={(e) => updateField("timelineEnd", e.target.value)}
                  required
                />
                {fieldErrors.timelineEnd ? (
                  <span className="admin-field__error">{fieldErrors.timelineEnd}</span>
                ) : null}
              </label>
            </div>

            <label className="admin-field">
              <span className="admin-field__label">Status (optional)</span>
              <select
                className="admin-field__input"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                <option value="">None</option>
                {statusOptions.map((opt) => (
                  <option key={opt.id} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.status ? (
                <span className="admin-field__error">{fieldErrors.status}</span>
              ) : null}
            </label>

            <fieldset className="admin-field admin-field--teams">
              <legend className="admin-field__label">Teams (optional)</legend>
              <p className="admin-field__hint-inline">
                Select one or more teams. Stored as comma-separated values in the sheet.
              </p>
              {teamOptions.length === 0 ? (
                <p className="admin-field__hint-inline">
                  No teams in App Config. Add teams via Manage teams or the sheet.
                </p>
              ) : (
                <div className="admin-team-checkboxes">
                  {teamOptions.map((opt) => (
                    <label key={opt.id} className="admin-team-check">
                      <input
                        type="checkbox"
                        checked={form.teams.includes(opt.id)}
                        onChange={() => toggleTeam(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {fieldErrors.teams ? (
                <span className="admin-field__error">{fieldErrors.teams}</span>
              ) : null}
            </fieldset>

            {submitError ? (
              <p className="admin-modal__submit-error" role="alert">
                {submitError}
              </p>
            ) : null}
            </div>
            {footer(
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={submitting || domains.length === 0}
                >
                  {submitting ? "Saving…" : "Add to sheet"}
                </button>
              </>
            )}
          </form>
        )}
      </aside>
    </div>
  );
}
