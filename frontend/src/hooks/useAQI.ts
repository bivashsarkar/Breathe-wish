import { useAir } from "../context/AirContext";

/**
 * Backwards-compatible hook used by dashboard widgets.
 * All data now comes from the shared AirProvider so pages do not refetch.
 */
export const useAQI = () => useAir();
