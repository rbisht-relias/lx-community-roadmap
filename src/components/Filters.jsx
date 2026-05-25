import { useEffect, useRef, useState } from "react";
import {
  getAllInitiatives,
  getTeamsForFilter,
  isFilterActive,
} from "../utils/roadmapUtils";

function FilterPill({ label, active, cohortActive, swatchColor, dotColor, onClick }) {
  const className = [
    "filter-pill",
    active && "filter-pill--active",
    cohortActive && "filter-pill--cohort-active",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className} onClick={onClick}>
      {swatchColor ? (
        <>
          <span className="filter-pill__swatch" style={{ background: swatchColor }} />
          {label}
        </>
      ) : dotColor ? (
        <>
          <span className="filter-pill__dot" style={{ background: dotColor }} />
          {label}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function FilterRow({ labelText, children }) {
  return (
    <div className="filter-row">
      <span className="filter-row__label">{labelText}</span>
      <div className="filter-row__pills">{children}</div>
    </div>
  );
}

function getSelectedInitiativeId(filterState) {
  if (!filterState.initiatives || filterState.initiatives.size === 0) return "";
  return [...filterState.initiatives][0];
}

function InitiativeSelect({ initiatives, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = value ? initiatives.find((item) => item.id === value) : null;
  const displayLabel = selected ? selected.name : "All initiatives";

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const pick = (initiativeId) => {
    onChange(initiativeId);
    setOpen(false);
  };

  return (
    <div className="filter-select-wrap" ref={rootRef}>
      <button
        type="button"
        id="initiative-filter"
        className={`filter-select-trigger${open ? " filter-select-trigger--open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="filter-select-trigger__label">{displayLabel}</span>
        <span className="filter-select-trigger__chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          className="filter-select-menu theme-scroll"
          role="listbox"
          aria-labelledby="initiative-filter"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`filter-select-option${!value ? " filter-select-option--selected" : ""}`}
              onClick={() => pick(null)}
            >
              All initiatives
            </button>
          </li>
          {initiatives.map((item) => {
            const isSelected = value === item.id;
            return (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`filter-select-option${isSelected ? " filter-select-option--selected" : ""}`}
                  onClick={() => pick(item.id)}
                >
                  <span
                    className="filter-select-option__swatch"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Filters({ data, filterState, onTeamChange, onInitiativeChange, onCohortChange, onClear }) {
  const teams = getTeamsForFilter(data);
  const initiatives = getAllInitiatives(data);
  const cohorts = data.cohorts || [];
  const filterActive = isFilterActive(filterState);
  const selectedInitiativeId = getSelectedInitiativeId(filterState);

  const clearFiltersButton = (
    <button
      type="button"
      className="filter-clear-btn"
      disabled={!filterActive}
      onClick={onClear}
    >
      Clear filters
    </button>
  );

  return (
    <div className="roadmap__filters" aria-label="Roadmap filters">
      <FilterRow labelText="Team:">
        {teams.map((team) => (
          <FilterPill
            key={team.id}
            label={team.label}
            active={filterState.team === team.id}
            onClick={() => onTeamChange(team.id)}
          />
        ))}
      </FilterRow>

      <div className="filter-row">
        <span className="filter-row__label" id="initiative-filter-label">
          Initiative:
        </span>
        <InitiativeSelect
          initiatives={initiatives}
          value={selectedInitiativeId}
          onChange={onInitiativeChange}
        />
      </div>

      {cohorts.length > 0 && (
        <FilterRow labelText="Cohort:">
          <FilterPill
            label="All cohorts"
            cohortActive={filterState.cohort === "all"}
            onClick={() => onCohortChange("all")}
          />
          {cohorts.map((cohort) => (
            <FilterPill
              key={cohort.id}
              label={cohort.label}
              cohortActive={filterState.cohort === cohort.id}
              dotColor={cohort.color}
              onClick={() => onCohortChange(cohort.id)}
            />
          ))}
        </FilterRow>
      )}

      <div className="roadmap__filters-end">{clearFiltersButton}</div>
    </div>
  );
}
