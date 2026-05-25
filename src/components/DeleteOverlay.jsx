const DOT_COUNT = 12;

export default function DeleteOverlay() {
  return (
    <div className="delete-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="delete-overlay__scrim" aria-hidden="true" />
      <div className="delete-overlay__panel">
        <div className="delete-overlay__spinner-wrap">
          <div className="delete-overlay__spinner-glow" aria-hidden="true" />
          <div className="delete-overlay__spinner" aria-hidden="true">
            {Array.from({ length: DOT_COUNT }, (_, i) => (
              <span
                key={i}
                className="delete-overlay__dot"
                style={{ "--dot-index": i }}
              />
            ))}
          </div>
        </div>
        <p className="delete-overlay__label">
          <span className="delete-overlay__label-text">Deleting</span>
        </p>
        <p className="delete-overlay__hint">Updating roadmap</p>
      </div>
    </div>
  );
}
