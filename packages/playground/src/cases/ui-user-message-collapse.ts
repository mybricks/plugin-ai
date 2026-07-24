import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTurn } from "../lib/fixtures";

// ─── 用于测试的长消息 ──────────────────────────────────────────────────────────

const SHORT_USER_TEXT = "帮我优化一下这段代码";

const LONG_USER_TEXT = `请帮我做以下几件事：

1. 分析这段 React 代码的性能问题
   - 是否存在不必要的重渲染？
   - useEffect 依赖项是否正确？
   - 是否有昂贵计算没有被 useMemo 缓存？

2. 审查组件结构
   - 组件职责是否清晰单一？
   - props 透传是否过深（超过 3 层）？
   - 是否有可以拆解的复合组件？

3. 检查状态管理
   - 哪些 state 可以下沉到子组件？
   - 哪些 state 应该提升到全局 store？
   - 是否有派生状态被存为 state（应改用 useMemo）？

4. 代码可读性
   - 函数和变量命名是否语义化？
   - 是否有过长的函数需要拆分？
   - 注释是否充分描述了"为什么"而不只是"是什么"？

5. 类型安全
   - 是否有 any 类型可以消除？
   - 接口定义是否完整覆盖了所有字段？
   - 泛型使用是否合理？

6. 其他
   - 有没有死代码（未使用的变量/函数/组件）？
   - 依赖版本是否需要升级？
   - 有没有已知的安全漏洞？

代码如下：

\`\`\`tsx
const MyComponent = ({ data, onUpdate }) => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchData().then(res => {
      setCount(res.count);
      setVisible(res.visible);
    });
  });

  const result = data.map(item => heavyCompute(item));

  return (
    <div>
      {result.map((r, i) => (
        <div key={i} onClick={() => onUpdate(r)}>{r.name}</div>
      ))}
    </div>
  );
};
\`\`\`

请逐条给出修改建议，并提供修复后的代码示例。`;

const VERY_LONG_USER_TEXT = `这是一条非常非常非常非常非常非常非常长的消息，用来测试折叠功能是否能正常工作。\n`.repeat(30) + "这是结尾。";

// ─── Test Cases ───────────────────────────────────────────────────────────────

/** 短消息：不应触发折叠 */
export const userMessageShortCase: TestCase = {
  id: "ui-user-message-short",
  name: "用户消息（短）- 不折叠",
  group: "UI / 用户消息折叠",
  priority: "P1",
  description: "短消息不触发折叠，直接全量展示。",
  expectedBehavior: "消息气泡正常展示，无折叠按钮",
  initialTurns: [
    makeTurn({
      userText: SHORT_USER_TEXT,
      content: "好的，我来帮你优化这段代码。",
    }),
  ],
  request: makeScriptedRequest([
    { type: "content", chunks: ["好的，我来帮你看看。"], chunkDelayMs: 30 },
  ]),
};

/** 长消息（包含代码块）：应触发折叠，默认收起 */
export const userMessageLongCase: TestCase = {
  id: "ui-user-message-long",
  name: "用户消息（长）- 默认收起",
  group: "UI / 用户消息折叠",
  priority: "P1",
  description: "超过折叠高度阈值的用户消息，默认收起，底部渐隐遮罩，显示「展开」按钮。",
  expectedBehavior: "消息气泡截断显示，底部有渐隐遮罩和「展开」按钮；点击展开后可查看全部内容；点击「收起」恢复折叠",
  initialTurns: [
    makeTurn({
      userText: LONG_USER_TEXT,
      content: "收到，我逐条分析：\n\n1. **性能**：`useEffect` 缺少依赖数组，每次渲染都会触发请求……",
    }),
  ],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，我来逐条给出建议。"],
      chunkDelayMs: 30,
    },
  ]),
};

/** 纯重复文本的极长消息：测试折叠边界 */
export const userMessageVeryLongCase: TestCase = {
  id: "ui-user-message-very-long",
  name: "用户消息（极长纯文本）- 折叠压力测试",
  group: "UI / 用户消息折叠",
  priority: "P2",
  description: "重复文本组成的超长用户消息，确保折叠高度裁切正确，不出现布局溢出。",
  expectedBehavior: "消息折叠收起，布局不溢出；展开后可滚动查看全部",
  initialTurns: [
    makeTurn({
      userText: VERY_LONG_USER_TEXT,
      content: "我收到了你的消息。",
    }),
  ],
  request: makeScriptedRequest([
    { type: "content", chunks: ["收到了。"], chunkDelayMs: 30 },
  ]),
};

/** 多轮对话：短 + 长交替，验证折叠状态互不干扰 */
export const userMessageMixedCase: TestCase = {
  id: "ui-user-message-mixed",
  name: "用户消息（多轮混合长短）- 折叠状态隔离",
  group: "UI / 用户消息折叠",
  priority: "P1",
  description: "多轮对话中，长消息和短消息交替出现，折叠状态应相互独立。",
  expectedBehavior: "短消息正常展示，长消息独立折叠/展开，互不影响",
  initialTurns: [
    makeTurn({
      userText: SHORT_USER_TEXT,
      content: "好的，我来帮你优化。",
    }),
    makeTurn({
      userText: LONG_USER_TEXT,
      content: "这是针对你详细需求的回复……",
    }),
    makeTurn({
      userText: "好的，明白了，谢谢！",
      content: "不客气，有问题随时来找我。",
    }),
    makeTurn({
      userText: VERY_LONG_USER_TEXT,
      content: "已经处理完了。",
    }),
  ],
  request: makeScriptedRequest([
    { type: "content", chunks: ["好的。"], chunkDelayMs: 30 },
  ]),
};
