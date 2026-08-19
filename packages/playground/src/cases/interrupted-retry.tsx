import type { RequestAsStreamFn } from "@request/types";
import type { TurnRecord } from "@agent/types";
import type { TestCase, TestCaseAssertion } from "./types";

const INTERRUPTED_TURN_ID = "playground-interrupted-turn";
const CHECKPOINT_TOOL_RESULT = "INTERRUPTED_CHECKPOINT_TOOL_RESULT";

const interruptedAt = Date.now() - 60_000;
const interruptedTurn: TurnRecord = {
  id: INTERRUPTED_TURN_ID,
  startTime: interruptedAt,
  userText: "读取 src/App.tsx，然后继续分析组件结构",
  userFormattedText: "读取 src/App.tsx，然后继续分析组件结构",
  userAttachments: [],
  status: "success",
  // 故意不设置 endTime：模拟进程在第一个完整 iter 落盘后异常退出。
  iterations: [
    {
      iterId: "interrupted-iter-1",
      content: "我先读取入口组件，再继续分析。",
      startTime: interruptedAt,
      endTime: interruptedAt + 800,
      toolCalls: [
        {
          callId: "interrupted-read-call",
          name: "read_file",
          args: { path: "src/App.tsx" },
          status: "success",
          execStartTime: interruptedAt + 800,
          execEndTime: interruptedAt + 1_000,
          result: {
            output: `${CHECKPOINT_TOOL_RESULT}\nexport default function App() { return <main />; }`,
          },
        },
      ],
    },
  ],
};

const interruptedRetryRequest: RequestAsStreamFn = async (params) => {
  const step = Number((params as any)._step);
  const serializedMessages = JSON.stringify(params.messages ?? []);
  const restoredCheckpoint = serializedMessages.includes(CHECKPOINT_TOOL_RESULT);
  const content = [
    "中断恢复成功。",
    `本次从 Step ${step} 继续。`,
    `已恢复上一 iter 的工具结果：${restoredCheckpoint ? "是" : "否"}。`,
  ].join("\n");

  await new Promise((resolve) => setTimeout(resolve, 300));
  for (const chunk of content.match(/[\s\S]{1,16}/g) ?? [content]) {
    await new Promise((resolve) => setTimeout(resolve, 35));
    params.emits.write(chunk);
  }
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

function getFirstSnapshotAssertion(
  name: string,
  check: (params: Record<string, any>) => { pass: boolean; message: string },
): TestCaseAssertion {
  return {
    name,
    run: ({ snapshots }) => {
      if (snapshots.length === 0) return null;
      return check(snapshots[0].params as Record<string, any>);
    },
  };
}

export const interruptedTurnRetryCase: TestCase = {
  id: "code-agent-interrupted-turn-retry",
  name: "HttpAgent 服务端异常中断恢复",
  group: "异常检测",
  priority: "P0",
  description:
    "预置一个已落盘完整 iter、status=success 但无 endTime 的 turn，模拟服务进程在两次 iter 之间退出。",
  expectedBehavior:
    "进入后消息区自动显示“任务异常中断”和重试按钮；点击消息内的“重试”，同一 turn 保留 Iter 1 并从 Step 2 继续，最终显示恢复成功。",
  initialTurns: [interruptedTurn],
  // playground 直接运行服务端使用的 CodeAgent，因此让 History 显式声明 checkpoint 模式。
  historyOptions: { persistMode: "iter" },
  request: interruptedRetryRequest,
  compactOptions: { enabled: false },
  summaryOptions: { enabled: false },
  assertions: [
    getFirstSnapshotAssertion("从 Step 2 续跑", (params) => {
      const step = Number(params._step);
      return {
        pass: step === 2,
        message: `实际 Step ${Number.isFinite(step) ? step : "未知"}，预期 Step 2`,
      };
    }),
    getFirstSnapshotAssertion("恢复旧 iter 工具结果", (params) => {
      const restored = JSON.stringify(params.messages ?? []).includes(CHECKPOINT_TOOL_RESULT);
      return {
        pass: restored,
        message: restored ? "请求上下文包含旧工具结果" : "请求上下文缺少旧工具结果",
      };
    }),
    getFirstSnapshotAssertion("复用原 Turn ID", (params) => ({
      pass: params.turnId === INTERRUPTED_TURN_ID,
      message: `实际 turnId=${String(params.turnId)}`,
    })),
  ],
};
