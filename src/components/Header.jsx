import { ROADMAP_TITLE } from "../config/roadmapDefaults";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Header({
  subtitle,
  themePreference,
  onThemeChange,
  onAddClick,
  onManageTeamsClick,
  googleSheetUrl,
}) {
  return (
    <header className="roadmap__header">
      <div className="roadmap__header-main">
        <h1 className="roadmap__title">{ROADMAP_TITLE}</h1>
        {subtitle ? <p className="roadmap__subtitle">{subtitle}</p> : null}
        {googleSheetUrl ? (
          <a
            className="roadmap__sheets-btn"
            href={googleSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Sheets
          </a>
        ) : null}
      </div>
      <div className="roadmap__header-actions">
        {onThemeChange ? (
          <ThemeSwitcher preference={themePreference} onChange={onThemeChange} />
        ) : null}
        {onManageTeamsClick ? (
          <button type="button" className="roadmap__teams-btn" onClick={onManageTeamsClick}>
            <span className="roadmap__add-btn-label roadmap__add-btn-label--full">Manage teams</span>
            <span className="roadmap__add-btn-label roadmap__add-btn-label--short">Teams</span>
          </button>
        ) : null}
        {onAddClick ? (
          <button type="button" className="roadmap__add-btn" onClick={onAddClick}>
            <span className="roadmap__add-btn-label roadmap__add-btn-label--full">Add initiative</span>
            <span className="roadmap__add-btn-label roadmap__add-btn-label--short">Add</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
