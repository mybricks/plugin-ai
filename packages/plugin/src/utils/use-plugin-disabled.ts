import { useEffect, useState } from "react";
import { context } from "../context";

/** 订阅 plugin-ai 的全局禁用状态。 */
export function usePluginDisabled(): boolean {
  const [disabled, setDisabled] = useState(() => context.disabled);

  useEffect(() => context.events.on("disabled", (value: boolean) => setDisabled(value)), []);

  return disabled;
}
