import { useEffect, useState } from "react";

import { getApiHealth } from "../services/healthService";
import type { ApiHealth } from "../types";

export function useApiHealth() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getApiHealth(controller.signal)
      .then((data) => setHealth(data))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return { health, error };
}
