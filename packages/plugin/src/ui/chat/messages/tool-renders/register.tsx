/**
 * 注册所有内置工具的渲染函数。
 * 在应用入口处 import 此文件即可完成内置渲染器的注册。
 *
 * render / summaryRender 是两个独立的函数（详见 tool-renders/index.ts）：
 *   render        始终返回完整展示用的 React 元素，和聚合开关无关。
 *   summaryRender 可选，返回聚合折叠行里的一句话摘要文案（string）；不传表示该工具
 *                 不支持被聚合——折叠时会单独成一段，也会打断前后相邻工具的聚合。
 *   两者物理上互不调用，不会出现"摘要探测时意外执行到 render 内部 hooks"之类的问题。
 *   目前为适合单行描述的文件、搜索、命令和 Skill 工具添加摘要。
 */
import React from "react";
import { registerToolRenderer, registerToolRenderersFromTools } from "./index";
import {
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  MULTI_WRITE_TOOL_NAME,
  EDIT_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  DELETE_TOOL_NAME,
  GLOB_TOOL_NAME,
  CALL_SUB_AGENT_TOOL_NAME,
  GREP_TOOL_NAME,
  USE_SKILL_TOOL_NAME,
  BASH_TOOL_NAME,
  ASK_QUESTIONS_TOOL_NAME,
} from "../../../../../../agent/src";
import { CHECK_STATUS_TOOL_NAME } from "../../../../sandbox/tools/check-status";
import { INIT_PROJECT_TOOL_NAME } from "../../../../../../agent/src/code-agent/tools";
import { ReadFileRenderer } from "./built-ins/read-file";
import { WriteFileRenderer } from "./built-ins/write-file";
import { MultiWriteRenderer } from "./built-ins/multi-write";
import { EditFileRenderer } from "./built-ins/edit-file";
import { MultiEditRenderer } from "./built-ins/multi-edit";
import { DeleteFileRenderer } from "./built-ins/delete-file";
import { CheckStatusRenderer } from "./built-ins/check-status";
import { SubAgentRenderer } from "./built-ins/sub-agent";
import { GrepSearchRenderer } from "./built-ins/grep-search";
import { SkillRenderer } from "./built-ins/skill";
import { InitProjectRenderer } from "./built-ins/init-project";
import { BashRenderer } from "./built-ins/bash";
import { AskQuestionsRenderer } from "./built-ins/ask-questions";
import { isPlanFilePath } from "../../../components/plan";
import { lang } from "../../../../i18n";

registerToolRenderer(
  READ_TOOL_NAME,
  (tool) => <ReadFileRenderer tool={tool} />,
  (tool) => lang.tool.readFile(tool.args?.path),
);
registerToolRenderer(
  WRITE_TOOL_NAME,
  (tool, ctx) => <WriteFileRenderer tool={tool} configDirName={ctx.configDirName} />,
  (tool, ctx) => {
    // 计划文件有自己的完整卡片展示（PlanToolCard），不应该被摘要成一行文案、也不参与聚合折叠。
    if (isPlanFilePath(tool.args?.path ?? "", ctx.configDirName)) return null;
    return lang.tool.writeFile(tool.args?.path);
  },
);
registerToolRenderer(
  MULTI_WRITE_TOOL_NAME,
  (tool) => <MultiWriteRenderer tool={tool} />,
  () => lang.tool.batchWriteFiles(),
);
registerToolRenderer(
  EDIT_TOOL_NAME,
  (tool, ctx) => <EditFileRenderer tool={tool} configDirName={ctx.configDirName} />,
  (tool, ctx) => {
    if (isPlanFilePath(tool.args?.path ?? "", ctx.configDirName)) return null;
    return lang.tool.editFile(tool.args?.path);
  },
);
registerToolRenderer(
  MULTI_EDIT_TOOL_NAME,
  (tool) => <MultiEditRenderer tool={tool} />,
  () => lang.tool.batchEdit(),
);
registerToolRenderer(
  DELETE_TOOL_NAME,
  (tool) => <DeleteFileRenderer tool={tool} />,
  (tool) => lang.tool.deleteFile(tool.args?.path),
);
registerToolRenderer(
  CHECK_STATUS_TOOL_NAME,
  (tool) => <CheckStatusRenderer tool={tool} />,
  () => lang.tool.viewStatus(),
);
registerToolRenderer(CALL_SUB_AGENT_TOOL_NAME, (tool) => <SubAgentRenderer tool={tool} />);
registerToolRenderer(INIT_PROJECT_TOOL_NAME, (tool) => <InitProjectRenderer tool={tool} />);
registerToolRenderer(
  GREP_TOOL_NAME,
  (tool) => <GrepSearchRenderer tool={tool} />,
  (tool) => lang.tool.searchContent(tool.args?.pattern),
);
registerToolRenderersFromTools([
  {
    name: GLOB_TOOL_NAME,
    summaryRender: (tool) => lang.tool.searchFiles(tool.args?.pattern),
  },
]);
registerToolRenderer(
  USE_SKILL_TOOL_NAME,
  (tool) => <SkillRenderer tool={tool} />,
  (tool) => lang.tool.useSkill(tool.args?.skill),
);
registerToolRenderer(
  BASH_TOOL_NAME,
  (tool) => <BashRenderer tool={tool} />,
  (tool) => tool.args?.command ?? lang.tool.command(),
);
registerToolRenderer(ASK_QUESTIONS_TOOL_NAME, (tool, ctx) => AskQuestionsRenderer(tool, ctx));
