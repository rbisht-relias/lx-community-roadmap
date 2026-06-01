import { useCallback, useEffect, useRef, useState } from "react";
import { formatTimelineRange } from "../utils/roadmapUtils";

function positionTooltip(tooltipEl, target) {
  const rect = target.getBoundingClientRect();
  const gap = 8;
  const margin = 12;
  const tipRect = tooltipEl.getBoundingClientRect();
  let top = rect.top - tipRect.height - gap;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;

  if (top < margin) {
    top = rect.bottom + gap;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

export default function InitiativeTooltip({
  item,
  target,
  domain,
  statuses = [],
  canEditStatus,
  canDelete,
  onStatusChange,
  onDelete,
  onDeleteStart,
  onDeleteError,
  onTooltipEnter,
  onTooltipLeave,
}) {
  const tooltipRef = useRef(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [localStatus, setLocalStatus] = useState("");

  useEffect(() => {
    if (!item || !target || !tooltipRef.current) return;

    positionTooltip(tooltipRef.current, target);

    const handleScroll = () => {
      if (tooltipRef.current && target) {
        positionTooltip(tooltipRef.current, target);
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [item, target, canDelete, canEditStatus, deleteError, statusError, localStatus]);

  useEffect(() => {
    setDeleteError("");
    setDeleting(false);
    setStatusError("");
    setLocalStatus(item?.status || "");
  }, [item?.id, domain, item?.status]);

  const handleDelete = useCallback(async () => {
    if (!item || !domain || !onDelete || deleting) return;
    const label = item.name || item.id;
    const confirmed = window.confirm(
      `Delete "${label}" (${item.id}) from the Google Sheet? This cannot be undone from the app.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    onDeleteStart?.();
    try {
      await onDelete({ team: domain, id: item.id });
    } catch (err) {
      onDeleteError?.();
      setDeleteError(err.message || "Failed to delete initiative.");
      setDeleting(false);
    }
  }, [deleting, domain, item, onDelete, onDeleteError, onDeleteStart]);

  const handleStatusSelect = useCallback(
    (e) => {
      const nextStatus = e.target.value;
      const currentStatus = localStatus || item?.status || "";
      if (!item || !domain || !onStatusChange || nextStatus === currentStatus) {
        return;
      }

      setLocalStatus(nextStatus);
      setStatusError("");

      void onStatusChange({ domain, id: item.id, status: nextStatus }).catch((err) => {
        setLocalStatus(item?.status || "");
        setStatusError(err.message || "Failed to update status.");
      });
    },
    [domain, item, localStatus, onStatusChange]
  );

  const displayStatus = localStatus || item?.status || "";

  const visible = Boolean(item && target);
  const interactive = visible && (canDelete || canEditStatus);

  return (
    <div
      ref={tooltipRef}
      className={[
        "initiative-tooltip",
        visible && "is-visible",
        interactive && "initiative-tooltip--interactive",
      ]
        .filter(Boolean)
        .join(" ")}
      role="tooltip"
      hidden={!visible}
      onMouseEnter={onTooltipEnter}
      onMouseLeave={onTooltipLeave}
    >
      {item && (
        <>
          <span className="initiative-tooltip__name">{item.name}</span>
          {item.timeline ? (
            <span className="initiative-tooltip__timeline">
              {formatTimelineRange(item.timeline)}
            </span>
          ) : null}
          {displayStatus ? (
            <span className="initiative-tooltip__status-label">{displayStatus}</span>
          ) : null}
          {item.description ? (
            <span className="initiative-tooltip__desc">{item.description}</span>
          ) : null}
          {canEditStatus && statuses.length > 0 ? (
            <label className="initiative-tooltip__status-field">
              <span className="initiative-tooltip__status-field-label">Status</span>
              <select
                className="initiative-tooltip__status-select"
                value={localStatus}
                onChange={handleStatusSelect}
              >
                <option value="">—</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
              {statusError ? (
                <span className="initiative-tooltip__error">{statusError}</span>
              ) : null}
            </label>
          ) : null}
          {canDelete ? (
            <div className="initiative-tooltip__actions">
              <button
                type="button"
                className="initiative-tooltip__delete"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              {deleteError ? (
                <span className="initiative-tooltip__error">{deleteError}</span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
