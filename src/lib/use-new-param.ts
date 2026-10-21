import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Calls `onNew` once when the URL carries `?new=1` (used by the global
 * quick-add and command palette to deep-link straight into an "add" dialog).
 */
export function useNewParam(onNew: () => void) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("new") === "1") onNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
