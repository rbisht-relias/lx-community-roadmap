import { useCallback, useState } from "react";
import { addTeam, deleteTeam, validateTeamForm } from "../services/sheetsApi";

const DEFAULT_NEW_TEAM_COLOR = "#8b5cf6";

const EMPTY_FORM = {
  teamName: "",
  teamId: "",
  color: DEFAULT_NEW_TEAM_COLOR,
};

export default function TeamsAdminModal({
  teams,
  adminToken,
  onUnlock,
  onLock,
  onClose,
  onSuccess,
}) {
  const [tokenInput, setTokenInput] = useState("");
  const unlocked = Boolean(adminToken);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

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

  const handleAddTeam = useCallback(
    async (e) => {
      e.preventDefault();
      const { errors, valid } = validateTeamForm(form);
      if (!valid) {
        setFieldErrors(errors);
        return;
      }

      setSubmitting(true);
      setSubmitError("");
      try {
        await addTeam({
          adminToken,
          teamId: form.teamId.trim(),
          teamName: form.teamName.trim(),
          color: form.color || "",
        });
        setForm(EMPTY_FORM);
        onSuccess?.();
      } catch (err) {
        setSubmitError(err.message || "Failed to add team.");
      } finally {
        setSubmitting(false);
      }
    },
    [adminToken, form, onSuccess]
  );

  const handleDeleteTeam = useCallback(
    async (team) => {
      const confirmed = window.confirm(
        `Delete team "${team.label}" (${team.id}) from App Config? This cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingId(team.id);
      setSubmitError("");
      try {
        await deleteTeam({ adminToken, teamId: team.id });
        onSuccess?.();
      } catch (err) {
        setSubmitError(err.message || "Failed to delete team.");
      } finally {
        setDeletingId("");
      }
    },
    [adminToken, onSuccess]
  );

  const footer = (content) => <footer className="admin-modal__footer">{content}</footer>;

  return (
    <div className="admin-modal" role="presentation" onClick={onClose}>
      <aside
        className="admin-modal__panel admin-modal__panel--teams"
        role="dialog"
        aria-labelledby="teams-admin-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal__header">
          <div className="admin-modal__header-text">
            <h2 id="teams-admin-title" className="admin-modal__title">
              Manage teams
            </h2>
            <p className="admin-modal__subtitle">
              Teams are stored on the App Config sheet (Team Name, Team Id).
            </p>
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
                Enter the admin token to add or remove teams.
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
          <>
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

              <form className="admin-teams-form" onSubmit={handleAddTeam}>
                <h3 className="admin-teams-form__heading">Add team</h3>
                <label className="admin-field">
                  <span className="admin-field__label">
                    Team Name <span className="admin-field__req">*</span>
                  </span>
                  <input
                    type="text"
                    className="admin-field__input"
                    value={form.teamName}
                    onChange={(e) => updateField("teamName", e.target.value)}
                    placeholder="e.g. Platform"
                    required
                  />
                  {fieldErrors.teamName ? (
                    <span className="admin-field__error">{fieldErrors.teamName}</span>
                  ) : null}
                </label>

                <label className="admin-field">
                  <span className="admin-field__label">
                    Team Id <span className="admin-field__req">*</span>
                  </span>
                  <input
                    type="text"
                    className="admin-field__input"
                    value={form.teamId}
                    onChange={(e) => updateField("teamId", e.target.value)}
                    placeholder="e.g. t5"
                    required
                  />
                  {fieldErrors.teamId ? (
                    <span className="admin-field__error">{fieldErrors.teamId}</span>
                  ) : null}
                </label>

                <div className="admin-field admin-field--color">
                  <span className="admin-field__label">Color (optional)</span>
                  <div className="admin-field__color-row">
                    <input
                      type="color"
                      className="admin-field__color"
                      value={form.color}
                      onChange={(e) => updateField("color", e.target.value)}
                      aria-label="Team color"
                    />
                    <span className="admin-field__color-value">{form.color}</span>
                  </div>
                  {fieldErrors.color ? (
                    <span className="admin-field__error">{fieldErrors.color}</span>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="admin-btn admin-btn--primary admin-teams-form__submit"
                  disabled={submitting}
                >
                  {submitting ? "Adding…" : "Add team to sheet"}
                </button>
              </form>

              <section className="admin-teams-list" aria-label="Current teams">
                <h3 className="admin-teams-form__heading">Teams in App Config</h3>
                {teams.length === 0 ? (
                  <p className="admin-modal__hint">No teams yet. Add one above or in Google Sheets.</p>
                ) : (
                  <ul className="admin-teams-list__items">
                    {teams.map((team) => (
                      <li key={team.id} className="admin-teams-list__item">
                        <span
                          className="admin-teams-list__dot"
                          style={{ background: team.color }}
                          aria-hidden="true"
                        />
                        <span className="admin-teams-list__text">
                          <span className="admin-teams-list__name">{team.label}</span>
                          <span className="admin-teams-list__id">{team.id}</span>
                        </span>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--small admin-teams-list__delete"
                          disabled={Boolean(deletingId)}
                          onClick={() => handleDeleteTeam(team)}
                        >
                          {deletingId === team.id ? "Deleting…" : "Delete"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {submitError ? (
                <p className="admin-modal__submit-error" role="alert">
                  {submitError}
                </p>
              ) : null}
            </div>
            {footer(
              <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
                Close
              </button>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
