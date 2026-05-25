import { Fragment } from "react";
import {
  buildYearSpans,
  getRoadmapRows,
  isFilterActive,
  rowMatchesTeamFilter,
} from "../utils/roadmapUtils";
import InitiativeBar from "./InitiativeBar";

const HEADER_ROWS = 2;

export default function RoadmapGrid({
  data,
  quarters,
  filterState,
  onShowTooltip,
  onHideTooltip,
}) {
  const rows = getRoadmapRows(data, quarters);
  const quarterCount = quarters.length;
  const totalCols = 1 + quarterCount;
  const yearSpans = buildYearSpans(quarters);
  const filterActive = isFilterActive(filterState);

  return (
    <div
      className="roadmap__grid"
      style={{
        gridTemplateColumns: `var(--label-width) repeat(${quarterCount}, minmax(var(--quarter-min), 1fr))`,
        gridTemplateRows: `auto auto repeat(${rows.length}, minmax(60px, auto))`,
      }}
    >
      <div
        className="roadmap__corner"
        style={{ gridColumn: "1", gridRow: `1 / ${HEADER_ROWS + 1}` }}
      />

      {yearSpans.map(({ year, count, startCol }) => (
        <div
          key={year}
          className="year-cell"
          style={{ gridColumn: `${startCol} / span ${count}`, gridRow: "1" }}
        >
          {year}
        </div>
      ))}

      {quarters.map((q, i) => (
        <div
          key={`${q.year}-${q.label}-${i}`}
          className="quarter-cell"
          style={{ gridColumn: String(i + 2), gridRow: "2" }}
        >
          {q.label}
        </div>
      ))}

      {rows.map((row, rowIndex) => {
        const gridRow = HEADER_ROWS + rowIndex + 1;
        const laneCount = Math.max(1, ...row.initiatives.map((item) => item.lane + 1));
        const labelDimmed =
          filterActive && !rowMatchesTeamFilter(row.id, filterState);

        return (
          <Fragment key={row.id}>
            <div
              className={`roadmap__row-label${labelDimmed ? " roadmap__row-label--dimmed" : ""}`}
              style={{ gridColumn: "1", gridRow: String(gridRow) }}
            >
              {row.label}
            </div>
            <div
              className="roadmap__track"
              style={{
                gridColumn: `2 / ${totalCols + 1}`,
                gridRow: String(gridRow),
                "--quarter-count": quarterCount,
                gridTemplateColumns: `repeat(${quarterCount}, minmax(var(--quarter-min), 1fr))`,
                gridTemplateRows: `repeat(${laneCount}, minmax(44px, auto))`,
              }}
            >
              {row.initiatives.map((item) => (
                <InitiativeBar
                  key={item.id}
                  item={item}
                  category={row.id}
                  filterState={filterState}
                  onShowTooltip={onShowTooltip}
                  onHideTooltip={onHideTooltip}
                />
              ))}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
