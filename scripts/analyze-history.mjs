import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_CONTEXT_WINDOW = 200_000;
const COMPACT_RESERVE_OUTPUT = 20_000;
const COMPACT_BUFFER = 13_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    file: null,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    threshold: null,
    minJump: 10_000,
    ratio: 1.5,
    lowPrompt: 60_000,
    highPrompt: 100_000,
    ineffectiveDropRatio: 0.7,
    longTurnMs: 300_000,
    longIterMs: 60_000,
    top: 10,
    json: false,
    all: false,
    verbose: false,
    thresholdOverridden: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const [key, inlineValue] = arg.slice(2).split('=');
      const value = inlineValue ?? argv[++i];
      if (value == null) throw new Error(`Missing value for --${key}`);
      switch (key) {
        case 'context-window':
          options.contextWindow = readPositiveNumber(value, key);
          break;
        case 'threshold':
          options.threshold = readPositiveNumber(value, key);
          options.thresholdOverridden = true;
          break;
        case 'min-jump':
          options.minJump = readPositiveNumber(value, key);
          break;
        case 'ratio':
          options.ratio = readPositiveNumber(value, key);
          break;
        case 'low':
          options.lowPrompt = readPositiveNumber(value, key);
          break;
        case 'high':
          options.highPrompt = readPositiveNumber(value, key);
          break;
        case 'ineffective-drop-ratio':
          options.ineffectiveDropRatio = readPositiveNumber(value, key);
          break;
        case 'long-turn-ms':
          options.longTurnMs = readPositiveNumber(value, key);
          break;
        case 'long-iter-ms':
          options.longIterMs = readPositiveNumber(value, key);
          break;
        case 'top':
          options.top = readPositiveNumber(value, key);
          break;
        default:
          throw new Error(`Unknown option: --${key}`);
      }
      continue;
    }
    if (!options.file) {
      options.file = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  options.file ??= path.resolve(root, 'rxai-1782461060284.json');
  options.threshold ??= options.contextWindow - COMPACT_RESERVE_OUTPUT - COMPACT_BUFFER;
  return options;
}

function readPositiveNumber(value, key) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`--${key} must be a positive number, got ${value}`);
  }
  return num;
}

function printHelp() {
  console.log(`Usage:
  node scripts/analyze-history.mjs [history.json] [options]

Options:
  --context-window <n>          Model context window. Default: 200000
  --threshold <n>               Compact trigger threshold. Default: contextWindow - 20000 - 13000
  --min-jump <n>                Min absolute promptTokens jump to flag. Default: 10000
  --ratio <n>                   Min promptTokens ratio to flag. Default: 1.5
  --low <n>                     "previous prompt is low" boundary. Default: 60000
  --high <n>                    "current prompt is high" boundary. Default: 100000
  --ineffective-drop-ratio <n>  After warmup, prompt should be lower than previous * ratio. Default: 0.7
  --long-turn-ms <n>            Flag turns whose wall time is at least this value. Default: 300000
  --long-iter-ms <n>            Flag iterations whose wall time is at least this value. Default: 60000
  --top <n>                     Max rows per section. Default: 10
  --all                         Print all rows in each section
  --verbose, -v                 Include auxiliary diagnostics such as missing usage and warmup timeline
  --json                        Print machine-readable JSON
  --help                        Show this help

Examples:
  node scripts/analyze-history.mjs rxai-1782461060284.json
  node scripts/analyze-history.mjs rxai-1782461060284.json --threshold 160000 --top 80
`);
}

function loadHistory(file) {
  const resolved = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(resolved, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.turns)) {
    throw new Error(`Invalid history file: ${resolved}, expected top-level turns[]`);
  }
  return { data, resolved };
}

function isLLMIter(iter) {
  return iter && iter.type !== 'warmup';
}

function getPromptTokens(iter) {
  const value = iter?.usage?.promptTokens;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getCompletionTokens(iter) {
  const value = iter?.usage?.completionTokens;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function textSize(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return value.length;
  try {
    return JSON.stringify(value).length;
  } catch {
    return String(value).length;
  }
}

function approxTokensFromChars(chars) {
  return Math.ceil(chars / 4);
}

function summarizeToolCalls(iter) {
  const toolCalls = Array.isArray(iter.toolCalls) ? iter.toolCalls : [];
  let resultChars = 0;
  let argChars = 0;
  const names = [];

  for (const toolCall of toolCalls) {
    names.push(toolCall.name ?? 'unknown');
    argChars += textSize(toolCall.args);
    if (toolCall.status === 'error') {
      resultChars += textSize(toolCall.error);
    } else {
      resultChars += textSize(toolCall.result?.output);
    }
    resultChars += textSize(toolCall.attachments);
  }

  return {
    count: toolCalls.length,
    names,
    argChars,
    resultChars,
    resultApproxTokens: approxTokensFromChars(resultChars),
  };
}

function flattenHistory(turns) {
  const entries = [];
  const llmRows = [];
  const warmups = [];

  turns.forEach((turn, turnIndex) => {
    const iterations = Array.isArray(turn.iterations) ? turn.iterations : [];
    iterations.forEach((iter, iterIndex) => {
      const entry = {
        entryIndex: entries.length,
        turnIndex,
        iterIndex,
        turnNo: turnIndex + 1,
        iterNo: iterIndex + 1,
        turnId: turn.id,
        turnStatus: turn.status,
        startTime: iter.startTime ?? turn.startTime,
        endTime: iter.endTime,
        type: iter.type,
        mode: iter.mode,
        userText: turn.userText ?? '',
        content: iter.content ?? '',
        usage: iter.usage,
        toolSummary: summarizeToolCalls(iter),
      };
      entries.push(entry);

      if (iter.type === 'warmup') {
        warmups.push({
          ...entry,
          status: iter.status,
          content: iter.content ?? '',
        });
        return;
      }

      const promptTokens = getPromptTokens(iter);
      if (isLLMIter(iter) && promptTokens != null) {
        const completionTokens = getCompletionTokens(iter);
        llmRows.push({
          ...entry,
          llmIndex: llmRows.length,
          promptTokens,
          completionTokens,
          totalTokens: Number(iter.usage?.totalTokens) || null,
          cachedTokens: Number(iter.usage?.promptTokensDetails?.cachedTokens) || 0,
          assistantChars: textSize(iter.content) + textSize(iter.thinkingContent),
          assistantApproxTokens: approxTokensFromChars(textSize(iter.content) + textSize(iter.thinkingContent)),
        });
      }
    });
  });

  return { entries, llmRows, warmups };
}

function hasWarmupBetween(warmups, prevRow, row) {
  const between = warmups.filter((warmup) => (
    warmup.entryIndex > prevRow.entryIndex
    && warmup.entryIndex < row.entryIndex
    && (warmup.status === 'success' || warmup.status === 'error')
  ));
  return between.find((warmup) => warmup.status === 'success') ?? between[0] ?? null;
}

function nextWarmupAfter(warmups, row) {
  return warmups.find((warmup) => warmup.entryIndex > row.entryIndex) ?? null;
}

function lastWarmupBefore(warmups, row) {
  for (let i = warmups.length - 1; i >= 0; i--) {
    if (warmups[i].entryIndex < row.entryIndex) return warmups[i];
  }
  return null;
}

function compactTurnNo(data) {
  const upToTurnId = data.compactRecord?.upToTurnId;
  if (!upToTurnId) return null;
  const index = data.turns.findIndex((turn) => turn.id === upToTurnId);
  return index === -1 ? null : index + 1;
}

function analyze(data, options) {
  const { entries, llmRows, warmups } = flattenHistory(data.turns);
  const anomalies = [];
  const warmupGaps = [];
  const ineffectiveCompacts = [];
  const thresholdCrossings = [];
  const missingUsage = [];

  for (const [turnIndex, turn] of data.turns.entries()) {
    const iterations = Array.isArray(turn.iterations) ? turn.iterations : [];
    iterations.forEach((iter, iterIndex) => {
      if (iter.type === 'warmup') return;
      if (!iter.usage) {
        missingUsage.push({
          turnNo: turnIndex + 1,
          iterNo: iterIndex + 1,
          turnId: turn.id,
          reason: 'LLM iter has no usage',
          contentPreview: preview(iter.content),
        });
      }
    });
  }

  for (let i = 1; i < llmRows.length; i++) {
    const prev = llmRows[i - 1];
    const row = llmRows[i];
    const delta = row.promptTokens - prev.promptTokens;
    const ratio = row.promptTokens / prev.promptTokens;
    const warmup = hasWarmupBetween(warmups, prev, row);
    const prevOutputApprox = Math.max(
      prev.completionTokens ?? 0,
      prev.assistantApproxTokens,
      prev.toolSummary.resultApproxTokens,
    );
    const unexplainedDelta = delta - prevOutputApprox;

    if (prev.promptTokens < options.threshold && row.promptTokens >= options.threshold) {
      thresholdCrossings.push(formatIssue(row, prev, {
        reason: `promptTokens crossed compact threshold ${formatNumber(options.threshold)}`,
        delta,
        ratio,
        warmup,
        prevOutputApprox,
        unexplainedDelta,
      }));
    }

    const isLowToHigh = prev.promptTokens <= options.lowPrompt && row.promptTokens >= options.highPrompt;
    const isSuddenJump = delta >= options.minJump && ratio >= options.ratio;
    const isTooLargeForPrevOutput = delta >= options.minJump && unexplainedDelta >= options.minJump;

    if (isLowToHigh || isSuddenJump || isTooLargeForPrevOutput) {
      const reasons = [];
      if (isLowToHigh) {
        reasons.push(`low-to-high (${formatNumber(prev.promptTokens)} -> ${formatNumber(row.promptTokens)})`);
      }
      if (isSuddenJump) {
        reasons.push(`jump +${formatNumber(delta)} (${ratio.toFixed(2)}x)`);
      }
      if (isTooLargeForPrevOutput) {
        reasons.push(`delta exceeds previous output estimate by ${formatNumber(unexplainedDelta)}`);
      }
      anomalies.push(formatIssue(row, prev, {
        reason: reasons.join('; '),
        delta,
        ratio,
        warmup,
        prevOutputApprox,
        unexplainedDelta,
      }));
    }

    if (prev.promptTokens >= options.threshold && !warmup && row.promptTokens >= options.threshold) {
      warmupGaps.push(formatIssue(row, prev, {
        reason: `previous promptTokens >= threshold but no warmup before this LLM iter`,
        delta,
        ratio,
        warmup,
        prevOutputApprox,
        unexplainedDelta,
        nextWarmup: nextWarmupAfter(warmups, prev),
      }));
    }

    if (warmup?.status === 'success') {
      const expectedMax = Math.floor(prev.promptTokens * options.ineffectiveDropRatio);
      if (row.promptTokens >= options.threshold || row.promptTokens > expectedMax) {
        ineffectiveCompacts.push(formatIssue(row, prev, {
          reason: `warmup success did not reduce promptTokens enough (expected <= ${formatNumber(expectedMax)})`,
          delta,
          ratio,
          warmup,
          prevOutputApprox,
          unexplainedDelta,
        }));
      }
    }
  }

  const tokenHotspots = llmRows
    .map((row) => ({
      severity: scoreTokenHotspot(row, options),
      turnNo: row.turnNo,
      iterNo: row.iterNo,
      turnId: row.turnId,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      cachedTokens: row.cachedTokens,
      overThreshold: row.promptTokens >= options.threshold,
      currentToolCalls: row.toolSummary.names,
      currentUserText: preview(row.userText, 100),
      currentContentPreview: preview(row.content),
    }))
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.promptTokens - a.promptTokens;
    });

  const longTurns = data.turns
    .map((turn, index) => {
      const durationMs = durationOf(turn);
      const iterations = Array.isArray(turn.iterations) ? turn.iterations : [];
      const llmIterations = iterations.filter((iter) => iter.type !== 'warmup');
      const maxPrompt = llmIterations.reduce((max, iter) => {
        const prompt = getPromptTokens(iter);
        return prompt == null ? max : Math.max(max, prompt);
      }, 0);
      const toolCalls = iterations.flatMap((iter) => (
        Array.isArray(iter.toolCalls) ? iter.toolCalls.map((toolCall) => toolCall.name ?? 'unknown') : []
      ));
      return {
        turnNo: index + 1,
        turnId: turn.id,
        status: turn.status,
        durationMs,
        startISO: toISO(turn.startTime),
        endISO: toISO(turn.endTime),
        iterCount: iterations.length,
        llmIterCount: llmIterations.length,
        maxPromptTokens: maxPrompt || null,
        toolCalls: [...new Set(toolCalls)],
        userText: preview(turn.userText, 120),
      };
    })
    .filter((turn) => turn.durationMs != null && turn.durationMs >= options.longTurnMs)
    .sort((a, b) => b.durationMs - a.durationMs);

  const longIterations = entries
    .map((entry) => ({
      turnNo: entry.turnNo,
      iterNo: entry.iterNo,
      turnId: entry.turnId,
      type: entry.type ?? 'llm',
      mode: entry.mode,
      durationMs: durationOf(entry),
      startISO: toISO(entry.startTime),
      endISO: toISO(entry.endTime),
      promptTokens: getPromptTokens(entry),
      completionTokens: getCompletionTokens(entry),
      toolCalls: entry.toolSummary.names,
      toolResultApproxTokens: entry.toolSummary.resultApproxTokens,
      userText: preview(entry.userText, 120),
      contentPreview: preview(entry.content),
    }))
    .filter((entry) => entry.durationMs != null && entry.durationMs >= options.longIterMs)
    .sort((a, b) => b.durationMs - a.durationMs);

  return {
    fileMeta: {
      agentKey: data.agentKey,
      exportedAt: data.exportedAt,
      turnCount: data.turns.length,
      llmIterCount: llmRows.length,
      warmupCount: warmups.length,
      compactRecord: data.compactRecord
        ? {
            upToTurnId: data.compactRecord.upToTurnId,
            upToTurnNo: compactTurnNo(data),
            createdAt: data.compactRecord.createdAt,
            createdISO: data.compactRecord.createdAt ? new Date(data.compactRecord.createdAt).toISOString() : null,
            contentChars: textSize(data.compactRecord.content),
            contentApproxTokens: approxTokensFromChars(textSize(data.compactRecord.content)),
          }
        : null,
    },
    options: {
      threshold: options.threshold,
      thresholdOverridden: options.thresholdOverridden,
      contextWindow: options.contextWindow,
      minJump: options.minJump,
      ratio: options.ratio,
      lowPrompt: options.lowPrompt,
      highPrompt: options.highPrompt,
      ineffectiveDropRatio: options.ineffectiveDropRatio,
      longTurnMs: options.longTurnMs,
      longIterMs: options.longIterMs,
    },
    stats: buildStats(llmRows, warmups, options),
    tokenHotspots,
    anomalies: sortIssues(anomalies),
    thresholdCrossings: sortIssues(thresholdCrossings),
    warmupGaps: sortIssues(warmupGaps),
    ineffectiveCompacts: sortIssues(ineffectiveCompacts),
    longTurns,
    longIterations,
    missingUsage,
    warmups: warmups.map((warmup) => ({
      turnNo: warmup.turnNo,
      iterNo: warmup.iterNo,
      turnId: warmup.turnId,
      status: warmup.status,
      content: warmup.content,
      startISO: toISO(warmup.startTime),
      durationMs: warmup.endTime && warmup.startTime ? warmup.endTime - warmup.startTime : null,
    })),
  };
}

function durationOf(value) {
  const start = Number(value?.startTime);
  const end = Number(value?.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

function buildStats(llmRows, warmups, options) {
  const prompts = llmRows.map((row) => row.promptTokens).sort((a, b) => a - b);
  const overThreshold = llmRows.filter((row) => row.promptTokens >= options.threshold);
  const maxRow = llmRows.reduce((max, row) => (!max || row.promptTokens > max.promptTokens ? row : max), null);

  return {
    minPromptTokens: prompts[0] ?? null,
    p50PromptTokens: percentile(prompts, 0.5),
    p90PromptTokens: percentile(prompts, 0.9),
    p99PromptTokens: percentile(prompts, 0.99),
    maxPromptTokens: maxRow?.promptTokens ?? null,
    maxPromptAt: maxRow ? locationOf(maxRow) : null,
    overThresholdCount: overThreshold.length,
    overThresholdTurns: [...new Set(overThreshold.map((row) => row.turnNo))],
    warmupSuccessCount: warmups.filter((warmup) => warmup.status === 'success').length,
    warmupErrorCount: warmups.filter((warmup) => warmup.status === 'error').length,
  };
}

function scoreTokenHotspot(row, options) {
  let score = row.promptTokens;
  if (row.promptTokens >= options.threshold) score += 1_000_000;
  if (row.promptTokens >= options.threshold * 0.95) score += 500_000;
  if (row.totalTokens != null) score += row.totalTokens / 10;
  return score;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[index];
}

function formatIssue(row, prev, extra) {
  const lastWarmup = extra.lastWarmup ?? null;
  return {
    severity: scoreSeverity(row, prev, extra),
    reason: extra.reason,
    turnNo: row.turnNo,
    iterNo: row.iterNo,
    turnId: row.turnId,
    promptTokens: row.promptTokens,
    previous: {
      turnNo: prev.turnNo,
      iterNo: prev.iterNo,
      turnId: prev.turnId,
      promptTokens: prev.promptTokens,
      completionTokens: prev.completionTokens,
      toolResultApproxTokens: prev.toolSummary.resultApproxTokens,
      toolCalls: prev.toolSummary.names,
    },
    delta: extra.delta,
    ratio: Number(extra.ratio.toFixed(3)),
    previousOutputApproxTokens: extra.prevOutputApprox,
    unexplainedDelta: extra.unexplainedDelta,
    warmupBetween: extra.warmup
      ? {
          turnNo: extra.warmup.turnNo,
          iterNo: extra.warmup.iterNo,
          status: extra.warmup.status,
          content: extra.warmup.content,
          durationMs: extra.warmup.endTime && extra.warmup.startTime ? extra.warmup.endTime - extra.warmup.startTime : null,
        }
      : null,
    nextWarmup: extra.nextWarmup
      ? {
          turnNo: extra.nextWarmup.turnNo,
          iterNo: extra.nextWarmup.iterNo,
          status: extra.nextWarmup.status,
          content: extra.nextWarmup.content,
        }
      : null,
    currentToolCalls: row.toolSummary.names,
    currentUserText: preview(row.userText, 100),
    currentContentPreview: preview(row.content),
    previousContentPreview: preview(prev.content),
    lastWarmupBefore: lastWarmup
      ? {
          turnNo: lastWarmup.turnNo,
          iterNo: lastWarmup.iterNo,
          status: lastWarmup.status,
          content: lastWarmup.content,
        }
      : null,
  };
}

function scoreSeverity(row, prev, extra) {
  let score = 0;
  if (row.promptTokens >= 400_000) score += 5;
  else if (row.promptTokens >= 200_000) score += 4;
  else if (row.promptTokens >= 160_000) score += 3;
  if (extra.ratio >= 5) score += 4;
  else if (extra.ratio >= 2) score += 2;
  if (extra.delta >= 100_000) score += 3;
  else if (extra.delta >= 50_000) score += 2;
  if (!extra.warmup && prev.promptTokens >= 160_000) score += 2;
  return score;
}

function sortIssues(issues) {
  return [...issues].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
}

function preview(value, max = 80) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function toISO(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Date(num).toISOString();
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function locationOf(row) {
  return `turn ${row.turnNo} / iter ${row.iterNo}`;
}

function printReport(report, options, file) {
  const limit = options.all ? Number.POSITIVE_INFINITY : options.top;
  console.log(`Token and latency anomaly report`);
  console.log(`File: ${file}`);
  console.log(`Agent: ${report.fileMeta.agentKey ?? '-'}`);
  console.log(`Turns: ${report.fileMeta.turnCount}, LLM iters: ${report.fileMeta.llmIterCount}, warmups: ${report.fileMeta.warmupCount}`);
  const thresholdNote = report.options.thresholdOverridden
    ? 'manual override'
    : `contextWindow ${formatNumber(report.options.contextWindow)} - 20,000 - 13,000`;
  console.log(`Threshold: ${formatNumber(report.options.threshold)} (${thresholdNote})`);
  if (report.fileMeta.compactRecord) {
    const compact = report.fileMeta.compactRecord;
    console.log(`Compact record: upTo turn ${compact.upToTurnNo ?? '?'} (${compact.upToTurnId}), created ${compact.createdISO ?? '-'}`);
    console.log(`Compact summary approx tokens: ${formatNumber(compact.contentApproxTokens)}`);
  } else {
    console.log(`Compact record: none`);
  }
  console.log('');

  console.log(`Overview`);
  console.table([{
    min: report.stats.minPromptTokens,
    p50: report.stats.p50PromptTokens,
    p90: report.stats.p90PromptTokens,
    p99: report.stats.p99PromptTokens,
    max: report.stats.maxPromptTokens,
    maxAt: report.stats.maxPromptAt,
    overThreshold: report.stats.overThresholdCount,
    suddenJumps: report.anomalies.length,
    longTurns: report.longTurns.length,
    longIters: report.longIterations.length,
    warmupSuccess: report.stats.warmupSuccessCount,
    warmupError: report.stats.warmupErrorCount,
  }]);

  printTokenHotspots('Top token hotspots', report.tokenHotspots, limit);
  printSection('Sudden prompt jumps', report.anomalies, limit);
  printLongTurns('Long turns', report.longTurns, limit);
  printLongIterations('Long iterations', report.longIterations, limit);
  printCompactHealth(report, limit, options);

  if (options.verbose && report.missingUsage.length) {
    console.log(`\nLLM iters missing usage (${report.missingUsage.length})`);
    console.table(report.missingUsage.slice(0, limit).map((issue) => ({
      turn: issue.turnNo,
      iter: issue.iterNo,
      reason: issue.reason,
      content: issue.contentPreview,
    })));
  }

  if (options.verbose && report.warmups.length) {
    console.log(`\nWarmup timeline (${report.warmups.length})`);
    console.table(report.warmups.slice(0, limit).map((warmup) => ({
      turn: warmup.turnNo,
      iter: warmup.iterNo,
      status: warmup.status,
      durationMs: warmup.durationMs,
      content: warmup.content,
    })));
  }
}

function printTokenHotspots(title, rows, limit) {
  console.log(`\n${title} (${rows.length})`);
  if (!rows.length) {
    console.log('No rows found.');
    return;
  }
  console.table(rows.slice(0, limit).map((row) => ({
    turn: row.turnNo,
    iter: row.iterNo,
    prompt: row.promptTokens,
    total: row.totalTokens,
    completion: row.completionTokens,
    cached: row.cachedTokens,
    overThreshold: row.overThreshold,
    tools: row.currentToolCalls.join(','),
    user: row.currentUserText,
  })));
}

function printSection(title, rows, limit) {
  console.log(`\n${title} (${rows.length})`);
  if (!rows.length) {
    console.log('No issues found.');
    return;
  }
  console.table(rows.slice(0, limit).map((issue) => ({
    sev: issue.severity,
    turn: issue.turnNo,
    iter: issue.iterNo,
    prompt: issue.promptTokens,
    prev: issue.previous.promptTokens,
    delta: issue.delta,
    ratio: issue.ratio,
    prevOutEst: issue.previousOutputApproxTokens,
    warmup: issue.warmupBetween ? `${issue.warmupBetween.status}@${issue.warmupBetween.turnNo}/${issue.warmupBetween.iterNo}` : '',
    reason: issue.reason,
    tools: issue.currentToolCalls.join(','),
    user: issue.currentUserText,
  })));
}

function printLongTurns(title, rows, limit) {
  console.log(`\n${title} (${rows.length})`);
  if (!rows.length) {
    console.log('No long turns found.');
    return;
  }
  console.table(rows.slice(0, limit).map((row) => ({
    turn: row.turnNo,
    duration: formatDuration(row.durationMs),
    iterCount: row.iterCount,
    llmIters: row.llmIterCount,
    maxPrompt: row.maxPromptTokens,
    status: row.status,
    tools: row.toolCalls.join(','),
    user: row.userText,
  })));
}

function printLongIterations(title, rows, limit) {
  console.log(`\n${title} (${rows.length})`);
  if (!rows.length) {
    console.log('No long iterations found.');
    return;
  }
  console.table(rows.slice(0, limit).map((row) => ({
    turn: row.turnNo,
    iter: row.iterNo,
    type: row.type,
    duration: formatDuration(row.durationMs),
    prompt: row.promptTokens,
    completion: row.completionTokens,
    toolOutEst: row.toolResultApproxTokens,
    tools: row.toolCalls.join(','),
    user: row.userText,
  })));
}

function printCompactHealth(report, limit, options) {
  const hasIssues = report.warmupGaps.length
    || report.ineffectiveCompacts.length;

  console.log(`\nCompact health`);
  console.table([{
    thresholdCrossings: report.thresholdCrossings.length,
    missingWarmupAfterThreshold: report.warmupGaps.length,
    ineffectiveCompact: report.ineffectiveCompacts.length,
  }]);

  if (!hasIssues && !options.verbose) return;
  if (options.verbose) {
    printSection('Threshold crossings', report.thresholdCrossings, limit);
  }
  printSection('Missing warmup after threshold', report.warmupGaps, limit);
  printSection('Ineffective compact/warmup', report.ineffectiveCompacts, limit);
}

function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds % 60);
  return `${minutes}m ${restSeconds}s`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const { data, resolved } = loadHistory(options.file);
  const report = analyze(data, options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, options, resolved);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
