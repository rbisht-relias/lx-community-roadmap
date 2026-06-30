import { useCallback, useEffect, useRef, useState } from "react";
import AdminModal from "./components/AdminModal";
import TeamsAdminModal from "./components/TeamsAdminModal";
import {
  applyAdminTokenFromUrl,
  clearStoredAdminTokens,
  getStoredAdminToken,
  setStoredAdminToken,
} from "./utils/adminAuth";
import Sidebar from "./components/Sidebar";
import DeleteOverlay from "./components/DeleteOverlay";
import LoadingScreen from "./components/LoadingScreen";
import Filters from "./components/Filters";
import RoadmapGrid from "./components/RoadmapGrid";
import ProjectsTable from "./components/ProjectsTable";
import OverviewView from "./components/views/OverviewView";
import SitesView from "./components/views/SitesView";
import SettingsView from "./components/views/SettingsView";
import ProjectDetail from "./components/ProjectDetail";
import InitiativeTooltip from "./components/InitiativeTooltip";
import { useRoadmapData } from "./hooks/useRoadmapData";
import { useTheme } from "./hooks/useTheme";
import { resolveStatus } from "./config/statusConfig";
import {
  deleteInitiative,
  getTeamOptionsForAdmin,
  getValidTeamIds,
  getValidStatusLabels,
  hasSheetsApi,
  isLocalMode,
  updateInitiativeStatus,
} from "./services/sheetsApi";
import {
  getQuarterRangeLabel,
  getDomainKeys,
  INITIAL_FILTER_STATE,
} from "./utils/roadmapUtils";

const VIEW_TITLES = {
  overview: "Overview",
  timeline: "Roadmap",
  table: "Projects",
  sites: "Sites & Cookiebot",
  settings: "Settings",
};

const VIEW_STORAGE_KEY = "roadmap_active_view";
const SIDEBAR_STORAGE_KEY = "roadmap_sidebar_collapsed";

function getInitialView() {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved && VIEW_TITLES[saved]) return saved;
  } catch {
    /* ignore */
  }
  return "overview";
}

function getInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const { preference: themePreference, setThemePreference } = useTheme();
  const { data, quarters, loading, error, refetch, patchInitiative } = useRoadmapData();
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialCollapsed);
  const [view, setView] = useState(getInitialView);
  const [selectedProject, setSelectedProject] = useState(null);
  const [filterState, setFilterState] = useState(INITIAL_FILTER_STATE);
  const [tooltip, setTooltip] = useState({ item: null, target: null, domain: null });
  const hideTooltipTimerRef = useRef(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [teamsAdminOpen, setTeamsAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState(
    () => applyAdminTokenFromUrl() || getStoredAdminToken() || (isLocalMode() ? "local" : "")
  );
  const [deleteOverlayVisible, setDeleteOverlayVisible] = useState(false);

  const handleAdminUnlock = useCallback((token) => {
    const trimmed = String(token || "").trim();
    setAdminToken(trimmed);
    setStoredAdminToken(trimmed);
  }, []);

  const handleAdminLock = useCallback(() => {
    setAdminToken("");
    clearStoredAdminTokens();
  }, []);

  const handleDomainChange = useCallback((domainId) => {
    setFilterState((prev) => ({ ...prev, domain: domainId }));
  }, []);

  const handleInitiativeChange = useCallback((initiativeId) => {
    setFilterState((prev) => ({
      ...prev,
      initiatives: initiativeId ? new Set([initiativeId]) : null,
    }));
  }, []);

  const handleTeamsChange = useCallback((teams) => {
    setFilterState((prev) => ({ ...prev, teams }));
  }, []);

  const handleStatusesChange = useCallback((statuses) => {
    setFilterState((prev) => ({ ...prev, statuses }));
  }, []);

  const handlePrioritiesChange = useCallback((priorities) => {
    setFilterState((prev) => ({ ...prev, priorities }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterState(INITIAL_FILTER_STATE);
  }, []);

  const clearHideTooltipTimer = useCallback(() => {
    if (hideTooltipTimerRef.current) {
      clearTimeout(hideTooltipTimerRef.current);
      hideTooltipTimerRef.current = null;
    }
  }, []);

  const handleShowTooltip = useCallback(
    (item, target, domain) => {
      clearHideTooltipTimer();
      setTooltip({ item, target, domain: domain || null });
    },
    [clearHideTooltipTimer]
  );

  const handleHideTooltip = useCallback(() => {
    clearHideTooltipTimer();
    hideTooltipTimerRef.current = setTimeout(() => {
      setTooltip({ item: null, target: null, domain: null });
    }, 150);
  }, [clearHideTooltipTimer]);

  const handleTooltipEnter = useCallback(() => {
    clearHideTooltipTimer();
  }, [clearHideTooltipTimer]);

  const handleDeleteStart = useCallback(() => {
    setDeleteOverlayVisible(true);
  }, []);

  const handleDeleteError = useCallback(() => {
    setDeleteOverlayVisible(false);
  }, []);

  const handleDeleteInitiative = useCallback(
    async ({ team, id }) => {
      if (!adminToken) {
        throw new Error("Admin token required to delete initiatives.");
      }
      await deleteInitiative({ adminToken, team, id });
      window.location.reload();
    },
    [adminToken]
  );

  const handleDeleteFromTable = useCallback(
    async ({ team, id }) => {
      if (!window.confirm(`Delete "${id}"? This cannot be undone.`)) return;
      try {
        await handleDeleteInitiative({ team, id });
      } catch (err) {
        window.alert(err.message || "Failed to delete.");
      }
    },
    [handleDeleteInitiative]
  );

  const handleAdminSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleCreateRange = useCallback(({ domain, timelineStart, timelineEnd }) => {
    setAddPrefill({ domain, timelineStart, timelineEnd });
    setAdminOpen(true);
  }, []);

  const handleCloseAdd = useCallback(() => {
    setAdminOpen(false);
    setAddPrefill(null);
  }, []);

  const handleSelectProject = useCallback(({ domain, id }) => {
    setSelectedProject({ domain, id });
  }, []);

  const handleEditInitiative = useCallback(({ domain, item }) => {
    if (!domain || !item) return;
    setEditTarget({
      domain,
      values: {
        domain,
        id: item.id || "",
        name: item.name || "",
        description: item.description || "",
        timelineStart: item.timeline?.[0] || "",
        timelineEnd: item.timeline?.[1] || "",
        status: item.status || "",
        owner: item.owner || "",
        priority: item.priority || "",
        link: item.link || "",
        teams: Array.isArray(item.teams) ? [...item.teams] : [],
      },
    });
  }, []);

  useEffect(() => {
    if (loading) setLoaderVisible(true);
  }, [loading]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => () => clearHideTooltipTimer(), [clearHideTooltipTimer]);

  const showAdmin = hasSheetsApi();
  const adminUnlocked = Boolean(showAdmin && adminToken);
  const canDeleteInitiatives = adminUnlocked;
  const canEditStatus = adminUnlocked;

  const openAddModal = useCallback(() => {
    setAddPrefill(null);
    setAdminOpen(true);
  }, []);

  const handleStatusChange = useCallback(
    async ({ domain, id, status }) => {
      if (!adminToken) {
        throw new Error("Admin token required to update status.");
      }

      const rows = data?.[domain];
      const previous = Array.isArray(rows) ? rows.find((row) => row.id === id) : null;
      const snapshot = {
        status: previous?.status || "",
        color: previous?.color || "#64748b",
      };

      const resolved = resolveStatus(status, data?.statuses);
      const optimistic = { status: resolved.label, color: resolved.color };

      patchInitiative(domain, id, optimistic);
      setTooltip((prev) => {
        if (!prev.item || prev.item.id !== id || prev.domain !== domain) return prev;
        return { ...prev, item: { ...prev.item, ...optimistic } };
      });

      try {
        await updateInitiativeStatus({ adminToken, team: domain, id, status });
      } catch (err) {
        patchInitiative(domain, id, snapshot);
        setTooltip((prev) => {
          if (!prev.item || prev.item.id !== id || prev.domain !== domain) return prev;
          return { ...prev, item: { ...prev.item, ...snapshot } };
        });
        throw err;
      }
    },
    [adminToken, data, patchInitiative]
  );

  if (loaderVisible) {
    return <LoadingScreen pending={loading} onFinish={() => setLoaderVisible(false)} />;
  }

  const pageTitle = VIEW_TITLES[view] || "Roadmap";
  const subtitle =
    view === "timeline" && quarters.length ? getQuarterRangeLabel(quarters) : "";
  const showFilters = view === "timeline" || view === "table";
  const showTopbarAdd = showAdmin && view !== "sites" && view !== "settings";

  return (
    <div className="app">
      {deleteOverlayVisible ? <DeleteOverlay /> : null}

      <Sidebar
        view={view}
        onNavigate={setView}
        collapsed={sidebarCollapsed}
        themePreference={themePreference}
        onThemeChange={setThemePreference}
        onAddClick={showAdmin ? openAddModal : undefined}
        onManageTeamsClick={showAdmin ? () => setTeamsAdminOpen(true) : undefined}
      />

      <main className="app__main">
        <header className="app__topbar">
          <div className="app__topbar-text">
            <button
              type="button"
              className="app__sidebar-toggle"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={sidebarCollapsed}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18M3 12h18M3 19h18" />
              </svg>
            </button>
            <div>
              <h1 className="app__page-title">{pageTitle}</h1>
              {subtitle ? <p className="app__page-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          {showTopbarAdd ? (
            <button type="button" className="app__add-btn" onClick={openAddModal}>
              + Add project
            </button>
          ) : null}
        </header>

        <div className="app__content theme-scroll">
          {error ? <p className="roadmap__error">{error}</p> : null}

          {data && !error ? (
            view === "overview" ? (
              <OverviewView data={data} onSelectProject={handleSelectProject} />
            ) : view === "sites" ? (
              <SitesView adminUnlocked={adminUnlocked} />
            ) : view === "settings" ? (
              <SettingsView onChange={refetch} />
            ) : (
              <>
                {showFilters ? (
                  <Filters
                    data={data}
                    filterState={filterState}
                    onDomainChange={handleDomainChange}
                    onInitiativeChange={handleInitiativeChange}
                    onTeamsChange={handleTeamsChange}
                    onStatusesChange={handleStatusesChange}
                    onPrioritiesChange={handlePrioritiesChange}
                    onClear={handleClearFilters}
                  />
                ) : null}

                {view === "timeline" ? (
                  <div className="roadmap__scroll">
                    <RoadmapGrid
                      data={data}
                      quarters={quarters}
                      filterState={filterState}
                      onShowTooltip={handleShowTooltip}
                      onHideTooltip={handleHideTooltip}
                      onSelect={handleSelectProject}
                      canCreate={canEditStatus}
                      onCreateRange={canEditStatus ? handleCreateRange : undefined}
                    />
                  </div>
                ) : (
                  <ProjectsTable
                    data={data}
                    filterState={filterState}
                    canEdit={canEditStatus}
                    canDelete={canDeleteInitiatives}
                    onSelect={handleSelectProject}
                    onEdit={canEditStatus ? handleEditInitiative : undefined}
                    onDelete={canDeleteInitiatives ? handleDeleteFromTable : undefined}
                  />
                )}
              </>
            )
          ) : null}
        </div>
      </main>

      {data ? (
        <ProjectDetail
          data={data}
          selected={selectedProject}
          canEdit={canEditStatus}
          canDelete={canDeleteInitiatives}
          onEdit={handleEditInitiative}
          onDelete={handleDeleteFromTable}
          onClose={() => setSelectedProject(null)}
        />
      ) : null}

      <InitiativeTooltip
        item={tooltip.item}
        target={tooltip.target}
        domain={tooltip.domain}
        statuses={data?.statuses || []}
        priorities={data?.priorities || []}
        canEditStatus={canEditStatus}
        canEdit={canEditStatus}
        canDelete={canDeleteInitiatives}
        onStatusChange={canEditStatus ? handleStatusChange : undefined}
        onEdit={canEditStatus ? handleEditInitiative : undefined}
        onDelete={canDeleteInitiatives ? handleDeleteInitiative : undefined}
        onDeleteStart={canDeleteInitiatives ? handleDeleteStart : undefined}
        onDeleteError={canDeleteInitiatives ? handleDeleteError : undefined}
        onTooltipEnter={handleTooltipEnter}
        onTooltipLeave={handleHideTooltip}
      />

      {adminOpen && data ? (
        <AdminModal
          initialValues={addPrefill}
          domains={getDomainKeys(data)}
          teamOptions={getTeamOptionsForAdmin(data)}
          validTeamIds={getValidTeamIds(data)}
          statusOptions={data.statuses || []}
          validStatusLabels={getValidStatusLabels(data)}
          priorityOptions={data.priorities || []}
          validPriorityLabels={(data.priorities || []).map((p) => p.label)}
          adminToken={adminToken}
          onUnlock={handleAdminUnlock}
          onLock={handleAdminLock}
          onClose={handleCloseAdd}
          onSuccess={handleAdminSuccess}
        />
      ) : null}

      {editTarget && data ? (
        <AdminModal
          mode="edit"
          initialValues={editTarget.values}
          domains={getDomainKeys(data)}
          teamOptions={getTeamOptionsForAdmin(data)}
          validTeamIds={getValidTeamIds(data)}
          statusOptions={data.statuses || []}
          validStatusLabels={getValidStatusLabels(data)}
          priorityOptions={data.priorities || []}
          validPriorityLabels={(data.priorities || []).map((p) => p.label)}
          adminToken={adminToken}
          onUnlock={handleAdminUnlock}
          onLock={handleAdminLock}
          onClose={() => setEditTarget(null)}
          onSuccess={handleAdminSuccess}
        />
      ) : null}

      {teamsAdminOpen && data ? (
        <TeamsAdminModal
          teams={data.teams || []}
          adminToken={adminToken}
          onUnlock={handleAdminUnlock}
          onLock={handleAdminLock}
          onClose={() => setTeamsAdminOpen(false)}
          onSuccess={handleAdminSuccess}
        />
      ) : null}
    </div>
  );
}
