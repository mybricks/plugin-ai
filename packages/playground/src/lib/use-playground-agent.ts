import { useEffect, useRef, useState, useCallback } from "react";
import { CodeAgent } from "@agent/code-agent";
import type { RequestAsStreamFn } from "@request/types";
import { MockHistory } from "./mock-history";
import { MemFS } from "./mem-fs";
import type { TestCase } from "../cases/types";
import { context } from "@plugin/context";

const AGENT_KEY = "playground_agent";

export function usePlaygroundAgent(
  activeCase: TestCase | null,
  overrideRequest?: RequestAsStreamFn | null
) {
  const [agent, setAgent] = useState<CodeAgent | null>(null);
  const [memFS, setMemFS] = useState<MemFS | null>(null);
  const agentRef = useRef<CodeAgent | null>(null);

  const resetAgent = useCallback(async (
    testCase: TestCase,
    reqFn?: RequestAsStreamFn | null
  ) => {
    agentRef.current?.abort();
    context.agentMap.delete(AGENT_KEY);

    const fs = new MemFS(testCase.initialFiles);
    const mockHistory = new MockHistory(testCase.initialTurns, null, testCase.historyOptions);

    const newAgent = new CodeAgent({
      key: AGENT_KEY,
      history: mockHistory,
      llm: testCase.llm,
      request: reqFn ?? testCase.request,
      sandbox: fs,
      tools: testCase.tools ?? [],
      skills: testCase.skills,
      summary: testCase.summaryOptions ?? { enabled: false },
      compact: testCase.compactOptions ?? { enabled: false },
      ...(testCase.maskOptions ? { mask: testCase.maskOptions } : {}),
      ...(testCase.handoffOptions ? { handoff: testCase.handoffOptions } : {}),
      ...(testCase.agentOptions?.retry ? { retry: testCase.agentOptions.retry } : {}),
      ...(testCase.agentOptions?.maxSteps ? { maxSteps: testCase.agentOptions.maxSteps } : {}),
      ...(testCase.agentOptions?.doomLoopThreshold ? { doomLoopThreshold: testCase.agentOptions.doomLoopThreshold } : {}),
      ...(testCase.disabledModes ? { disabledModes: testCase.disabledModes } : {}),
    });
    testCase.mentions?.forEach((mention) => newAgent.chipRegistry.register(mention.chip));

    agentRef.current = newAgent;
    context.agentMap.set(AGENT_KEY, newAgent as any);

    setMemFS(fs);
    setAgent(newAgent);
  }, []);

  useEffect(() => {
    if (!activeCase) return;
    resetAgent(activeCase, overrideRequest);
  }, [activeCase, overrideRequest, resetAgent]);

  return { agent, memFS, resetAgent };
}
