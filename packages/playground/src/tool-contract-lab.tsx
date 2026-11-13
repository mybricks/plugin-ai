import { useMemo, useState } from "react";
import type { FsFile } from "./lib/mem-fs";
import {
  createToolContractRuntime,
  runToolContract,
  TOOL_CONTRACTS,
  type ToolContractSandboxKind,
  type ToolContractRecord,
  type ToolContractProgress,
} from "./tool-contract-runtime";

export function ToolContractLab({ initialFiles }: { initialFiles: FsFile[] }) {
  const [kind, setKind] = useState<ToolContractSandboxKind>("v1");
  const [revision, setRevision] = useState(0);
  const [contractId, setContractId] = useState(TOOL_CONTRACTS[0].id);
  const [argsText, setArgsText] = useState(JSON.stringify(TOOL_CONTRACTS[0].args, null, 2));
  const [record, setRecord] = useState<ToolContractRecord | null>(null);
  const [suiteRecords, setSuiteRecords] = useState<ToolContractRecord[]>([]);

  const runtime = useMemo(() => {
    return createToolContractRuntime(kind, initialFiles);
  }, [initialFiles, kind, revision]);
  const contract = TOOL_CONTRACTS.find((item) => item.id === contractId) ?? TOOL_CONTRACTS[0];
  const availableContracts = TOOL_CONTRACTS.filter((item) => kind === "agent-host" || kind === "agent-restricted"
    ? item.sandboxKinds?.includes(kind)
    : !item.sandboxKinds || item.sandboxKinds.includes(kind));

  const selectContract = (id: string) => {
    const next = TOOL_CONTRACTS.find((item) => item.id === id) ?? TOOL_CONTRACTS[0];
    setContractId(next.id);
    setArgsText(JSON.stringify(next.args, null, 2));
    setRecord(null);
  };
  const run = async () => {
    const before = runtime.fs.snapshot();
    try {
      const args = JSON.parse(argsText);
      const tool = runtime.tools[contract.tool];
      if (!tool) throw new Error(`Unknown tool: ${contract.tool}`);
      tool.validate?.(args);
      const progress: ToolContractProgress[] = [];
      const result = await tool.execute(args, contract.tool === "bash" ? {
        signal: new AbortController().signal,
        emitProgress: (item: ToolContractProgress) => progress.push(item),
      } as any : undefined);
      const after = runtime.fs.snapshot();
      const nextRecord: ToolContractRecord = { contract, args, before, after, result, progress, pass: !!result.metadata && contract.assert(after, result as any) };
      nextRecord.pass = nextRecord.pass && (contract.assertRecord?.(nextRecord) ?? true);
      setRecord(nextRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecord({ contract, args: argsText, before, after: runtime.fs.snapshot(), error: message, progress: [], pass: contract.assertError?.(message) ?? false });
    }
  };

  const runSuite = async () => {
    const records = await Promise.all(availableContracts.map((item) => runToolContract(kind, item, initialFiles)));
    setSuiteRecords(records);
    const firstFailure = records.find((item) => !item.pass);
    const selected = firstFailure ?? records[0];
    if (selected) {
      setContractId(selected.contract.id);
      setArgsText(JSON.stringify(selected.contract.args, null, 2));
      setRecord(selected);
    }
  };

  return <div className="tool-contract-lab">
    <div className="tool-contract-controls">
      <label>Sandbox <select value={kind} onChange={(event) => { const next = event.target.value as ToolContractSandboxKind; const nextContracts = TOOL_CONTRACTS.filter((item) => next === "agent-host" || next === "agent-restricted" ? item.sandboxKinds?.includes(next) : !item.sandboxKinds || item.sandboxKinds.includes(next)); setKind(next); setContractId((nextContracts[0] ?? TOOL_CONTRACTS[0]).id); setRecord(null); }}><option value="v1">Sandbox V1 adapter</option><option value="agent">AgentSandbox</option><option value="agent-host">AgentSandbox custom host</option><option value="agent-restricted">AgentSandbox restricted proxies</option></select></label>
      <label>Tool <select value={contractId} onChange={(event) => selectContract(event.target.value)}>{availableContracts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <button onClick={run}>执行工具</button><button onClick={runSuite}>执行全部契约</button><button onClick={() => { setRevision((value) => value + 1); setRecord(null); setSuiteRecords([]); }}>重置文件系统</button>
    </div>
    {suiteRecords.length > 0 && <div className="tool-contract-suite">
      <strong>全套结果：{suiteRecords.filter((item) => item.pass).length}/{suiteRecords.length} 通过</strong>
      {suiteRecords.map((item) => <button key={item.contract.id} className={item.pass ? "contract-pass" : "contract-fail"} onClick={() => {
        setContractId(item.contract.id);
        setArgsText(JSON.stringify(item.contract.args, null, 2));
        setRecord(item);
      }}>{item.contract.label}</button>)}
    </div>}
    <div className="tool-contract-grid">
      <section><h3>参数</h3><textarea value={argsText} onChange={(event) => setArgsText(event.target.value)} spellCheck={false} /></section>
      <section><h3>返回值 {record && <span className={record.pass ? "contract-pass" : "contract-fail"}>{record.pass ? "PASS" : "FAIL"}</span>}</h3><pre>{record ? JSON.stringify(record.error ? { error: record.error, progress: record.progress } : { result: record.result, progress: record.progress }, null, 2) : "等待执行"}</pre></section>
      <section><h3>文件系统变化</h3><pre>{JSON.stringify(record ? { before: record.before, after: record.after } : runtime.fs.snapshot(), null, 2)}</pre></section>
    </div>
  </div>;
}
