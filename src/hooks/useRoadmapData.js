import { useCallback, useEffect, useState } from "react";
import { fetchRoadmap } from "../services/sheetsApi";
import { setQuartersFromData } from "../utils/roadmapUtils";

export function useRoadmapData() {
  const [data, setData] = useState(null);
  const [quarters, setQuarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const json = await fetchRoadmap();
      if (signal?.aborted) return;
      const parsedQuarters = setQuartersFromData(json);
      setData(json);
      setQuarters(parsedQuarters);
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        `Could not load roadmap from Google Sheets (${err.message}). See README.md for setup.`
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    return load(controller.signal);
  }, [load]);

  return { data, quarters, loading, error, refetch };
}
