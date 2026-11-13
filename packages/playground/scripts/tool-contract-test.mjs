import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  configFile: "vite.config.ts",
  // This is an SSR module loader, never an HTTP/HMR server. Disabling HMR keeps
  // the test runnable in restricted CI sandboxes that cannot bind a port.
  server: { middlewareMode: true, hmr: false, ws: false, host: "127.0.0.1", open: false },
});

try {
  const lab = await server.ssrLoadModule("/src/tool-contract-runtime.ts");
  let completed = 0;

  const recordsBySandbox = new Map();
  for (const sandbox of ["v1", "agent", "agent-native", "agent-host", "agent-restricted"]) {
    const records = new Map();
    for (const contract of lab.TOOL_CONTRACTS.filter((item) =>
      sandbox === "v1" || sandbox === "agent"
        ? !item.sandboxKinds || item.sandboxKinds.includes(sandbox)
        : item.sandboxKinds?.includes(sandbox)
    )) {
      const record = await lab.runToolContract(sandbox, contract);
      const label = `${sandbox}/${contract.id}`;

      if (contract.assertError) {
        assert.ok(record.error, `${label}: expected an error`);
      } else {
        assert.equal(record.error, undefined, `${label}: ${record.error ?? "unexpected error"}`);
        assert.ok(record.result?.metadata, `${label}: result.metadata is required for regression inspection`);
      }
      assert.equal(record.pass, true, `${label}: output or filesystem assertion failed`);
      if (contract.tool === "bash" && record.result?.metadata) {
        for (const duplicateKey of ["command", "description", "stdout", "stderr", "structured", "timeoutMs"]) {
          assert.equal(
            duplicateKey in record.result.metadata,
            false,
            `${label}: bash metadata must not duplicate ${duplicateKey}`,
          );
        }
      }

      // CI logs retain the exact input, complete tool result (including metadata),
      // and filesystem before/after snapshots for a failed-contract investigation.
      console.log(JSON.stringify({
        sandbox,
        tool: contract.tool,
        args: record.args,
        result: record.result,
        error: record.error,
        progress: record.progress,
        filesystem: { before: record.before, after: record.after },
      }));
      records.set(contract.id, record);
      completed++;
    }
    recordsBySandbox.set(sandbox, records);
  }

  // The V1 adapter and the native AgentSandbox must retain the same direct-tool
  // contract for every common case. This detects accidental output or metadata
  // drift, not merely independent pass/fail outcomes.
  for (const contract of lab.TOOL_CONTRACTS.filter((item) => !item.sandboxKinds)) {
    const v1 = recordsBySandbox.get("v1").get(contract.id);
    const agent = recordsBySandbox.get("agent").get(contract.id);
    assert.deepEqual(
      { result: v1.result, error: v1.error, after: v1.after },
      { result: agent.result, error: agent.error, after: agent.after },
      `v1/agent compatibility drift: ${contract.id}`,
    );
  }

  assert.deepEqual(await lab.verifyRecursiveFileBatching(), {
    listCalls: 1,
    readFilesCalls: 1,
    readCalls: 0,
  }, "default files grep must use one recursive list and one bulk read");

  const history = await lab.verifyHistoryReadContracts();
  const historyRecords = (result) => result.output
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const historyPage = (result) => JSON.parse(result.output.split("\n")[0])._page;
  assert.deepEqual(history.searchFirst.metadata, { returned: 1, next_index: 2 });
  assert.deepEqual(historyRecords(history.searchFirst).map((record) => record.index), [1]);
  assert.equal(historyRecords(history.searchFirst)[0].turnId, "turn-one");
  assert.equal(historyRecords(history.searchFirst)[0].matches[0].field, "toolCalls[0].result.output");
  assert.equal(historyPage(history.searchFirst).has_more, true);
  assert.equal(historyPage(history.searchFirst).next_index, 2);
  assert.deepEqual(historyRecords(history.searchNext).map((record) => record.index), [2]);
  assert.equal(historyRecords(history.searchNext)[0].turnId, "turn-two");
  assert.equal(historyPage(history.searchNext).has_more, false);

  const standardAssistant = historyRecords(history.standard)[0];
  assert.equal(standardAssistant.index, 1);
  assert.equal(standardAssistant.turnId, "turn-one");
  assert.equal("reasoning" in standardAssistant, false);
  assert.equal("result" in standardAssistant.toolCalls[0], false);
  assert.equal(standardAssistant.toolCalls[0].metadata.transport, "host");

  const fullAssistant = historyRecords(history.full)[0];
  assert.equal(fullAssistant.turnId, "turn-one");
  assert.equal(fullAssistant.reasoning, "先从宿主输出中寻找问题。");
  assert.equal(fullAssistant.toolCalls[0].result.output, "Host output mentions AgentSandbox batching.");

  const turnRecords = historyRecords(history.turn);
  assert.deepEqual(turnRecords.map((record) => record.index), [2, 3, 4]);
  assert.deepEqual(turnRecords.map((record) => record.turnId), ["turn-two", "turn-two", "turn-two"]);
  assert.deepEqual(turnRecords[0].turn, { index: 2, limit: 3 });
  assert.deepEqual(historyRecords(history.usersInRange).map((record) => record.index), [2]);
  assert.equal(historyRecords(history.usersInRange)[0].turnId, "turn-two");
  assert.equal(historyRecords(history.usersInRange)[0].sender.userId, "history-user");

  console.log(JSON.stringify({ tool: "history_read", contracts: history }));

  const pluginHooks = await lab.verifyPluginHooksContracts();
  assert.deepEqual(pluginHooks.first, [
    "base:beforeTurn",
    "one:beforeTurn",
    "base:beforeRequest",
    "one:beforeRequest",
    "request",
    "base:afterTurn",
    "one:afterTurn",
    "base:afterTurnSettled",
    "one:afterTurnSettled",
  ]);
  assert.deepEqual(pluginHooks.second, [
    "base:beforeTurn",
    "one:beforeTurn",
    "two:beforeTurn",
    "base:beforeRequest",
    "one:beforeRequest",
    "two:beforeRequest",
    "request",
    "base:afterTurn",
    "one:afterTurn",
    "two:afterTurn",
    "base:afterTurnSettled",
    "one:afterTurnSettled",
    "two:afterTurnSettled",
  ]);
  assert.deepEqual(pluginHooks.third, [
    "base:beforeTurn",
    "two:beforeTurn",
    "base:beforeRequest",
    "two:beforeRequest",
    "request",
    "base:afterTurn",
    "two:afterTurn",
    "base:afterTurnSettled",
    "two:afterTurnSettled",
  ]);
  assert.deepEqual(pluginHooks.requestContexts, [
    ["base:context", "one:context"],
    ["base:context", "one:context", "two:context"],
    ["base:context", "two:context"],
  ]);
  assert.deepEqual(pluginHooks.requestToolNames, [
    ["one_tool"],
    ["one_tool", "two_tool"],
    ["two_tool"],
  ]);
  assert.deepEqual(pluginHooks.errorIsolation.calls, [
    "broken:beforeTurn",
    "survivor:beforeTurn",
    "broken:beforeRequest",
    "survivor:beforeRequest",
    "request",
    "broken:afterTurn",
    "survivor:afterTurn",
    "broken:afterTurnSettled",
    "survivor:afterTurnSettled",
  ]);
  assert.equal(pluginHooks.errorIsolation.warnings.length, 4);
  for (const hookName of ["beforeTurn", "beforeRequest", "afterTurn", "afterTurnSettled"]) {
    assert.ok(
      pluginHooks.errorIsolation.warnings.some((warning) =>
        warning.includes(`plugin \"broken\".hooks.${hookName} failed`)
      ),
      `missing isolated warning for ${hookName}`,
    );
  }
  console.log(JSON.stringify({ feature: "plugin_hooks", contracts: pluginHooks }));

  console.log(`Tool contracts passed: ${completed}`);
} finally {
  await server.close();
}
