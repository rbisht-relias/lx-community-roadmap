import { useCallback, useEffect, useRef, useState } from "react";
import AdminModal from "./components/AdminModal";
import TeamsAdminModal from "./components/TeamsAdminModal";
import {
  applyAdminTokenFromUrl,
  clearStoredAdminTokens,
  getStoredAdminToken,
  setStoredAdminToken,
} from "./utils/adminAuth";
import Header from "./components/Header";
import DeleteOverlay from "./components/DeleteOverlay";
import LoadingScreen from "./components/LoadingScreen";
import Filters from "./components/Filters";
import RoadmapGrid from "./components/RoadmapGrid";
import InitiativeTooltip from "./components/InitiativeTooltip";
import { useRoadmapData } from "./hooks/useRoadmapData";
import { useTheme } from "./hooks/useTheme";
import { resolveStatus } from "./config/statusConfig";
import {
  deleteInitiative,
  getGoogleSheetUrl,
  getTeamOptionsForAdmin,
  getValidTeamIds,
  getValidStatusLabels,
  hasSheetsApi,
  updateInitiativeStatus,
} from "./services/sheetsApi";
import {
  getSubtitle,
  getDomainKeys,
  INITIAL_FILTER_STATE,
} from "./utils/roadmapUtils";

export default function App() {
  const { preference: themePreference, setThemePreference } = useTheme();
  const { data, quarters, loading, error, refetch, patchInitiative } = useRoadmapData();
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [filterState, setFilterState] = useState(INITIAL_FILTER_STATE);
  const [tooltip, setTooltip] = useState({ item: null, target: null, domain: null });
  const hideTooltipTimerRef = useRef(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [teamsAdminOpen, setTeamsAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState(
    () => applyAdminTokenFromUrl() || getStoredAdminToken()
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

  useEffect(() => () => clearHideTooltipTimer(), [clearHideTooltipTimer]);

  const subtitle =
    data && quarters.length ? getSubtitle(quarters, filterState) : "";
  const showAdmin = hasSheetsApi();
  const googleSheetUrl = getGoogleSheetUrl();
  const showGoogleSheetLink = Boolean(adminToken && googleSheetUrl);
  const canDeleteInitiatives = Boolean(showAdmin && adminToken);
  const canEditStatus = Boolean(showAdmin && adminToken);

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
      const optimistic = {
        status: resolved.label,
        color: resolved.color,
      };

      patchInitiative(domain, id, optimistic);
      setTooltip((prev) => {
        if (!prev.item || prev.item.id !== id || prev.domain !== domain) {
          return prev;
        }
        return {
          ...prev,
          item: { ...prev.item, ...optimistic },
        };
      });

      try {
        await updateInitiativeStatus({
          adminToken,
          team: domain,
          id,
          status,
        });
      } catch (err) {
        patchInitiative(domain, id, snapshot);
        setTooltip((prev) => {
          if (!prev.item || prev.item.id !== id || prev.domain !== domain) {
            return prev;
          }
          return {
            ...prev,
            item: { ...prev.item, ...snapshot },
          };
        });
        throw err;
      }
    },
    [adminToken, data, patchInitiative]
  );

  if (loaderVisible) {
    return (
      <LoadingScreen
        pending={loading}
        onFinish={() => setLoaderVisible(false)}
      />
    );
  }

  return (
    <div className="roadmap">
      {deleteOverlayVisible ? <DeleteOverlay /> : null}
      <Header
        subtitle={subtitle}
        themePreference={themePreference}
        onThemeChange={setThemePreference}
        onAddClick={
          showAdmin
            ? () => {
                setAddPrefill(null);
                setAdminOpen(true);
              }
            : undefined
        }
        onManageTeamsClick={showAdmin ? () => setTeamsAdminOpen(true) : undefined}
        googleSheetUrl={showGoogleSheetLink ? googleSheetUrl : undefined}
      />

      {error && <p className="roadmap__error">{error}</p>}

      {data && !error && (
        <>
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
          <div className="roadmap__scroll">
            <RoadmapGrid
              data={data}
              quarters={quarters}
              filterState={filterState}
              onShowTooltip={handleShowTooltip}
              onHideTooltip={handleHideTooltip}
              canCreate={canEditStatus}
              onCreateRange={canEditStatus ? handleCreateRange : undefined}
            />
          </div>
          <InitiativeTooltip
            item={tooltip.item}
            target={tooltip.target}
            domain={tooltip.domain}
            statuses={data.statuses || []}
            priorities={data.priorities || []}
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
        </>
      )}

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
