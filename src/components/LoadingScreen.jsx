import { useEffect, useState } from "react";

const TICK_MS = 100;
const CREEP_CAP = 88;
const FINISH_MS = 320;
const FADE_MS = 200;

export default function LoadingScreen({ pending, onFinish }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!pending) {
      return undefined;
    }

    setFading(false);
    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= CREEP_CAP) return prev;
        const step = Math.max(0.6, (CREEP_CAP - prev) * 0.12);
        return Math.min(CREEP_CAP, prev + step);
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [pending]);

  useEffect(() => {
    if (pending) return undefined;

    setProgress(100);

    const fadeTimer = window.setTimeout(() => setFading(true), FINISH_MS);
    const doneTimer = window.setTimeout(() => onFinish?.(), FINISH_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [pending, onFinish]);

  const displayPercent = Math.min(100, Math.round(progress));

  return (
    <div
      className={`loading-screen${fading ? " loading-screen--fade-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={pending}
    >
      <div className="loading-screen__content">
        <p className="loading-screen__label">LOADING...</p>
        <div
          className="loading-screen__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPercent}
          aria-label="Loading roadmap"
        >
          <div
            className="loading-screen__fill"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
        <p className="loading-screen__percent">{displayPercent} %</p>
      </div>
    </div>
  );
}
