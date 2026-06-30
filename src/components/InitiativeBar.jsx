import {
  formatTimelineRange,
  initiativeMatchesFilter,
  isFilterActive,
} from "../utils/roadmapUtils";

/** Align bar edges with header quarter columns (1px border between each column). */
export function timelinePositionToCss(position, quarterCount) {
  const n = Math.max(1, quarterCount);
  const full = Math.floor(position);
  const frac = position - full;
  const colExpr = `((100% - ${Math.max(0, n - 1)}px) / ${n})`;
  if (n === 1) return `calc(${position} * 100%)`;
  return `calc(${full} * (${colExpr} + 1px) + ${frac} * ${colExpr})`;
}

export default function InitiativeBar({ item, category, filterState, onShowTooltip, onHideTooltip, onSelect }) {
  const filterActive = isFilterActive(filterState);
  const matched = filterActive && initiativeMatchesFilter(item, category, filterState);
  const dimmed = filterActive && !matched;

  const className = [
    "initiative",
    matched && "initiative--matched",
    dimmed && "initiative--dimmed",
  ]
    .filter(Boolean)
    .join(" ");

  const description = item.description || "";
  const timeline = formatTimelineRange(item.timeline);
  const ariaParts = [item.name, timeline, description].filter(Boolean);
  const ariaLabel = ariaParts.join(" — ");

  const quarterCount = item.span.quarterCount || 1;
  const startPos = item.span.startPos ?? 0;
  const endPos = item.span.endPos ?? 1;
  const left = timelinePositionToCss(startPos, quarterCount);
  const width = `calc(${timelinePositionToCss(endPos, quarterCount)} - ${left})`;

  return (
    <div
      className={className}
      style={{
        "--accent": item.color,
        "--lane": item.lane,
        left,
        width,
      }}
      tabIndex={0}
      role={onSelect ? "button" : undefined}
      aria-label={ariaLabel}
      onMouseEnter={(e) => onShowTooltip(item, e.currentTarget, category)}
      onMouseLeave={onHideTooltip}
      onFocus={(e) => onShowTooltip(item, e.currentTarget, category)}
      onBlur={onHideTooltip}
      onClick={onSelect ? () => onSelect({ domain: category, id: item.id }) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect({ domain: category, id: item.id });
              }
            }
          : undefined
      }
    >
      {item.name}
    </div>
  );
}
