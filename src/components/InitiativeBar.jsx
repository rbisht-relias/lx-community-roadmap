import {
  formatTimelineRange,
  initiativeMatchesFilter,
  isFilterActive,
} from "../utils/roadmapUtils";

export default function InitiativeBar({ item, category, filterState, onShowTooltip, onHideTooltip }) {
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

  return (
    <div
      className={className}
      style={{
        "--accent": item.color,
        gridColumn: `${item.span.start} / ${item.span.end}`,
        gridRow: String(item.lane + 1),
      }}
      tabIndex={0}
      aria-label={ariaLabel}
      onMouseEnter={(e) => onShowTooltip(item, e.currentTarget, category)}
      onMouseLeave={onHideTooltip}
      onFocus={(e) => onShowTooltip(item, e.currentTarget, category)}
      onBlur={onHideTooltip}
    >
      {item.name}
    </div>
  );
}
