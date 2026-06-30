import { useCallback, useEffect, useState } from "react";
import {
  listDomains,
  createDomain,
  deleteDomain,
  listTeams,
  createTeam,
  deleteTeamById,
  listStatuses,
  createStatus,
  deleteStatusDef,
  listPriorities,
  createPriority,
  deletePriorityDef,
} from "../../db/database";

function SettingsSection({
  title,
  description,
  items,
  hasColor,
  placeholder,
  onAdd,
  onDelete,
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#34954a");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onAdd(hasColor ? { label, color } : { label });
      setLabel("");
    } catch (err) {
      setError(err.message || "Could not add.");
    }
  };

  const remove = async (item) => {
    setError("");
    try {
      await onDelete(item);
    } catch (err) {
      setError(err.message || "Could not delete.");
    }
  };

  return (
    <section className="settings-card">
      <header className="settings-card__head">
        <h3 className="settings-card__title">{title}</h3>
        {description ? <p className="settings-card__desc">{description}</p> : null}
      </header>

      <ul className="settings-list">
        {items.length === 0 ? (
          <li className="settings-list__empty">None yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="settings-list__row">
              <span className="settings-list__label">
                {hasColor ? (
                  <span className="settings-list__swatch" style={{ background: item.color }} />
                ) : null}
                {item.label || item.name}
              </span>
              <button
                type="button"
                className="settings-list__del"
                aria-label={`Delete ${item.label || item.name}`}
                onClick={() => remove(item)}
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>

      <form className="settings-add" onSubmit={submit}>
        {hasColor ? (
          <input
            type="color"
            className="settings-add__color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Color"
          />
        ) : null}
        <input
          type="text"
          className="settings-add__input"
          placeholder={placeholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <button type="submit" className="settings-add__btn">
          Add
        </button>
      </form>
      {error ? <p className="settings-card__error">{error}</p> : null}
    </section>
  );
}

export default function SettingsView({ onChange }) {
  const [domains, setDomains] = useState([]);
  const [teams, setTeams] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);

  const refresh = useCallback(async () => {
    const [d, t, s, p] = await Promise.all([
      listDomains(),
      listTeams(),
      listStatuses(),
      listPriorities(),
    ]);
    setDomains(d);
    setTeams(t);
    setStatuses(s);
    setPriorities(p);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // After any change, refresh local lists AND tell the app to reload roadmap data.
  const afterChange = useCallback(async () => {
    await refresh();
    onChange?.();
  }, [refresh, onChange]);

  return (
    <div className="settings">
      <p className="settings__intro">
        Manage the building blocks used across the roadmap. Items in use by a project can&apos;t be
        deleted until they&apos;re removed from those projects.
      </p>
      <div className="settings__grid">
        <SettingsSection
          title="Domains"
          description="Top-level groupings (rows on the roadmap)."
          items={domains}
          placeholder="e.g. Platform"
          onAdd={async ({ label }) => {
            await createDomain(label);
            await afterChange();
          }}
          onDelete={async (item) => {
            await deleteDomain(item.id);
            await afterChange();
          }}
        />

        <SettingsSection
          title="Teams"
          description="Teams that can be assigned to projects."
          items={teams}
          hasColor
          placeholder="e.g. Core Eng"
          onAdd={async ({ label, color }) => {
            await createTeam({ name: label, color });
            await afterChange();
          }}
          onDelete={async (item) => {
            await deleteTeamById(item.id);
            await afterChange();
          }}
        />

        <SettingsSection
          title="Statuses"
          description="Workflow states; the color drives the roadmap bar."
          items={statuses}
          hasColor
          placeholder="e.g. In Review"
          onAdd={async ({ label, color }) => {
            await createStatus({ label, color });
            await afterChange();
          }}
          onDelete={async (item) => {
            await deleteStatusDef(item.id);
            await afterChange();
          }}
        />

        <SettingsSection
          title="Priorities"
          description="Priority levels shown as badges."
          items={priorities}
          hasColor
          placeholder="e.g. Critical"
          onAdd={async ({ label, color }) => {
            await createPriority({ label, color });
            await afterChange();
          }}
          onDelete={async (item) => {
            await deletePriorityDef(item.id);
            await afterChange();
          }}
        />
      </div>
    </div>
  );
}
