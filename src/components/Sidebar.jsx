import { ROADMAP_TITLE } from "../config/roadmapDefaults";
import ThemeSwitcher from "./ThemeSwitcher";

const ICONS = {
  overview: (
    <path d="M3 3h7v7H3V3zm11 0h7v4h-7V3zM3 14h7v7H3v-7zm11-3h7v10h-7V11z" />
  ),
  timeline: (
    <path d="M3 5h12v3H3V5zm4 5h13v3H7v-3zM3 15h9v3H3v-3z" />
  ),
  table: (
    <path d="M3 4h18v4H3V4zm0 6h18v4H3v-4zm0 6h18v4H3v-4z" />
  ),
  sites: (
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.7 0 3.2 2.3 3.8 6H8.2C8.8 6.3 10.3 4 12 4zM4.3 9h3.4a22 22 0 000 6H4.3a8 8 0 010-6zm3.9 8h7.6c-.6 3-2 5-3.8 5s-3.2-2-3.8-5zm9.5-2a22 22 0 000-6h3.4a8 8 0 010 6h-3.4z" />
  ),
};

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Roadmap" },
  { id: "table", label: "Projects" },
  { id: "sites", label: "Sites & Cookiebot" },
];

function NavIcon({ name }) {
  return (
    <svg className="sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function Sidebar({
  view,
  onNavigate,
  collapsed = false,
  themePreference,
  onThemeChange,
  onAddClick,
  onManageTeamsClick,
}) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true" />
        <span className="sidebar__brand-text">{ROADMAP_TITLE}</span>
      </div>

      <nav className="sidebar__nav" aria-label="Primary">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            title={collapsed ? item.label : undefined}
            className={`sidebar__link${view === item.id ? " is-active" : ""}`}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <NavIcon name={item.id} />
            <span className="sidebar__link-text">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        {onAddClick ? (
          <button
            type="button"
            title={collapsed ? "Add project" : undefined}
            className="sidebar__action sidebar__action--primary"
            onClick={onAddClick}
          >
            <span className="sidebar__action-full">+ Add project</span>
            <span className="sidebar__action-short" aria-hidden="true">+</span>
          </button>
        ) : null}
        {onManageTeamsClick ? (
          <button
            type="button"
            title={collapsed ? "Manage teams" : undefined}
            className="sidebar__action sidebar__action--hide-collapsed"
            onClick={onManageTeamsClick}
          >
            Manage teams
          </button>
        ) : null}

        {onThemeChange ? (
          <div className="sidebar__theme">
            <ThemeSwitcher preference={themePreference} onChange={onThemeChange} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
