import { useRef, useState, useCallback } from "react";
import type { RequestAsStreamFn, RequestAsStreamParams } from "@request/types";

export interface RequestSnapshot {
  index: number;
  /** 完整请求参数（messages、tools、aiRole 等） */
  params: Omit<RequestAsStreamParams, "emits">;
  timestamp: number;
}

export function useRequestInspector(originalRequest: RequestAsStreamFn | null) {
  const [snapshots, setSnapshots] = useState<RequestSnapshot[]>([]);
  const indexRef = useRef(0);

  const wrappedRequest: RequestAsStreamFn = useCallback(
    async (params) => {
      const { emits, ...rest } = params;
      const snap: RequestSnapshot = {
        index: ++indexRef.current,
        params: rest,
        timestamp: Date.now(),
      };
      setSnapshots((prev) => [...prev, snap]);
      return originalRequest!(params);
    },
    [originalRequest]
  );

  const reset = useCallback(() => {
    indexRef.current = 0;
    setSnapshots([]);
  }, []);

  return { wrappedRequest: originalRequest ? wrappedRequest : null, snapshots, reset };
}
