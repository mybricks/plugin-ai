import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodeAgent } from "../../../../../agent/src";
import type { ActivePlanFile } from "../../../../../agent/src/mode-manager";

type PlanStore = {
  activePlan: ActivePlanFile | null;
  listeners: Set<() => void>;
};

const stores = new Map<string, PlanStore>();

function getStore(agentKey: string): PlanStore {
  let store = stores.get(agentKey);
  if (!store) {
    store = {
      activePlan: null,
      listeners: new Set(),
    };
    stores.set(agentKey, store);
  }
  return store;
}

function notify(store: PlanStore) {
  for (const listener of store.listeners) {
    listener();
  }
}

function setActivePlan(agentKey: string, plan: ActivePlanFile | null) {
  const store = getStore(agentKey);
  if (store.activePlan?.path === plan?.path && store.activePlan?.content === plan?.content) return;
  store.activePlan = plan;
  notify(store);
}

export function usePlanState(agent?: CodeAgent) {
  const agentKey = agent?.key ?? "";
  const store = useMemo(() => getStore(agentKey), [agentKey]);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!agentKey) return;
    const nextStore = getStore(agentKey);
    const listener = () => forceUpdate((n) => n + 1);
    nextStore.listeners.add(listener);
    return () => {
      nextStore.listeners.delete(listener);
    };
  }, [agentKey]);

  const refreshActivePlan = useCallback(() => {
    if (!agent || !agentKey) return;
    void agent.getPlanFile().then((plan) => {
      setActivePlan(agentKey, plan);
    }).catch(() => {});
  }, [agent, agentKey]);

  useEffect(() => {
    if (!agent || !agentKey) return;
    refreshActivePlan();

    const unsubTurnStart = agent.events.on("turn:start", refreshActivePlan);
    const unsubTurn = agent.events.on("turn:complete", refreshActivePlan);

    return () => {
      unsubTurnStart();
      unsubTurn();
    };
  }, [agent, agentKey, refreshActivePlan]);

  const abandonPlan = useCallback(async (plan: ActivePlanFile) => {
    if (!agent || !agentKey) return;
    await agent.abandonPlan(plan.path, plan.content);
    refreshActivePlan();
  }, [agent, agentKey, refreshActivePlan]);

  return {
    activePlan: store.activePlan,
    abandonPlan,
    refreshActivePlan,
  };
}
