import { useCallback, useState } from "react";
import { COHORT_OPTIONS } from "../config/roadmapDefaults";
import { DEFAULT_INITIATIVE_COLOR, formatTeamLabel } from "../utils/roadmapUtils";
import { addInitiative, validateInitiativeForm } from "../services/sheetsApi";

const EMPTY_FORM = {
  team: "",
  id: "",
  name: "",
  description: "",
  timelineStart: "",
  timelineEnd: "",
  color: DEFAULT_INITIATIVE_COLOR,
  cohort: "",
};

function buildInitialForm(teams) {
  return { ...EMPTY_FORM, team: teams[0] || "" };
}

export default function AdminModal({
  teams,
  adminToken,
  onUnlock,
  onLock,
  onClose,
  onSuccess,
}) {
  const [tokenInput, setTokenInput] = useState("");
  const unlocked = Boolean(adminToken);
  const [form, setForm] = useState(() => buildInitialForm(teams));
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
      return next;
    });
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const { errors, valid } = validateInitiativeForm(form);
      if (!valid) {
        setFieldErrors(errors);
        return;
      }

      setSubmitting(true);
      setSubmitError("");
      try {
        await addInitiative({
          adminToken,
          team: form.team.trim(),
          id: form.id.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          timelineStart: form.timelineStart,
          timelineEnd: form.timelineEnd,
          color: form.color || "",
          cohort: form.cohort || "",
        });
        onSuccess?.();
        onClose();
      } catch (err) {
        setSubmitError(err.message || "Failed to save.");
      } finally {
        setSubmitting(false);
      }
    },
    [adminToken, form, onClose, onSuccess]
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
                Team <span className="admin-field__req">*</span>
              </span>
              <select
                className="admin-field__input"
                value={form.team}
                onChange={(e) => updateField("team", e.target.value)}
                required
                disabled={teams.length === 0}
              >
                {teams.map((tab) => (
                  <option key={tab} value={tab}>
                    {formatTeamLabel(tab)}
                  </option>
                ))}
              </select>
              {teams.length === 0 ? (
                <span className="admin-field__error">No teams loaded yet.</span>
              ) : null}
              {fieldErrors.team ? (
                <span className="admin-field__error">{fieldErrors.team}</span>
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

            <div className="admin-field admin-field--color">
              <span className="admin-field__label">Color (optional)</span>
              <div className="admin-field__color-row">
                <input
                  type="color"
                  className="admin-field__color"
                  value={form.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  aria-label="Initiative color"
                />
                <span className="admin-field__color-value">{form.color}</span>
              </div>
            </div>

            <label className="admin-field">
              <span className="admin-field__label">Cohort (optional)</span>
              <select
                className="admin-field__input"
                value={form.cohort}
                onChange={(e) => updateField("cohort", e.target.value)}
              >
                {COHORT_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.cohort ? (
                <span className="admin-field__error">{fieldErrors.cohort}</span>
              ) : null}
            </label>

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
                  disabled={submitting || teams.length === 0}
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
