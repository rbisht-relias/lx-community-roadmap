import { useCallback, useEffect, useRef, useState } from "react";
import AdminModal from "./components/AdminModal";
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
import {
  deleteInitiative,
  getGoogleSheetUrl,
  hasSheetsApi,
} from "./services/sheetsApi";
import {
  getSubtitle,
  getTeamKeys,
  INITIAL_FILTER_STATE,
} from "./utils/roadmapUtils";

export default function App() {
  const { preference: themePreference, setThemePreference } = useTheme();
  const { data, quarters, loading, error, refetch } = useRoadmapData();
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [filterState, setFilterState] = useState(INITIAL_FILTER_STATE);
  const [tooltip, setTooltip] = useState({ item: null, target: null, team: null });
  const hideTooltipTimerRef = useRef(null);
  const [adminOpen, setAdminOpen] = useState(false);
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

  const handleTeamChange = useCallback((teamId) => {
    setFilterState((prev) => ({ ...prev, team: teamId }));
  }, []);

  const handleInitiativeChange = useCallback((initiativeId) => {
    setFilterState((prev) => ({
      ...prev,
      initiatives: initiativeId ? new Set([initiativeId]) : null,
    }));
  }, []);

  const handleCohortChange = useCallback((cohortId) => {
    setFilterState((prev) => ({ ...prev, cohort: cohortId }));
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
    (item, target, team) => {
      clearHideTooltipTimer();
      setTooltip({ item, target, team: team || null });
    },
    [clearHideTooltipTimer]
  );

  const handleHideTooltip = useCallback(() => {
    clearHideTooltipTimer();
    hideTooltipTimerRef.current = setTimeout(() => {
      setTooltip({ item: null, target: null, team: null });
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
        onAddClick={showAdmin ? () => setAdminOpen(true) : undefined}
        googleSheetUrl={showGoogleSheetLink ? googleSheetUrl : undefined}
      />

      {error && <p className="roadmap__error">{error}</p>}

      {data && !error && (
        <>
          <Filters
            data={data}
            filterState={filterState}
            onTeamChange={handleTeamChange}
            onInitiativeChange={handleInitiativeChange}
            onCohortChange={handleCohortChange}
            onClear={handleClearFilters}
          />
          <div className="roadmap__scroll">
            <RoadmapGrid
              data={data}
              quarters={quarters}
              filterState={filterState}
              onShowTooltip={handleShowTooltip}
              onHideTooltip={handleHideTooltip}
            />
          </div>
          <InitiativeTooltip
            item={tooltip.item}
            target={tooltip.target}
            team={tooltip.team}
            canDelete={canDeleteInitiatives}
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
          teams={getTeamKeys(data)}
          adminToken={adminToken}
          onUnlock={handleAdminUnlock}
          onLock={handleAdminLock}
          onClose={() => setAdminOpen(false)}
          onSuccess={handleAdminSuccess}
        />
      ) : null}
    </div>
  );
}
