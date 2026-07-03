/**
 * 注册所有内置工具的渲染函数。
 * 在应用入口处 import 此文件即可完成内置渲染器的注册。
 */
import React from "react";
import { registerToolRenderer } from "./index";
import {
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  MULTI_WRITE_TOOL_NAME,
  EDIT_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  DELETE_TOOL_NAME,
  CALL_SUB_AGENT_TOOL_NAME,
  GREP_TOOL_NAME,
  USE_SKILL_TOOL_NAME,
  BASH_TOOL_NAME,
} from "../../../../../../agent/src";
import { CHECK_STATUS_TOOL_NAME } from "../../../../sandbox/tools/check-status";
import { INIT_PROJECT_TOOL_NAME } from "../../../../sandbox/tools/init-project";
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

registerToolRenderer(READ_TOOL_NAME, (tool) => <ReadFileRenderer tool={tool} />);
registerToolRenderer(WRITE_TOOL_NAME, (tool) => <WriteFileRenderer tool={tool} />);
registerToolRenderer(MULTI_WRITE_TOOL_NAME, (tool) => <MultiWriteRenderer tool={tool} />);
registerToolRenderer(EDIT_TOOL_NAME, (tool) => <EditFileRenderer tool={tool} />);
registerToolRenderer(MULTI_EDIT_TOOL_NAME, (tool) => <MultiEditRenderer tool={tool} />);
registerToolRenderer(DELETE_TOOL_NAME, (tool) => <DeleteFileRenderer tool={tool} />);
registerToolRenderer(CHECK_STATUS_TOOL_NAME, (tool) => <CheckStatusRenderer tool={tool} />);
registerToolRenderer(CALL_SUB_AGENT_TOOL_NAME, (tool) => <SubAgentRenderer tool={tool} />);
registerToolRenderer(INIT_PROJECT_TOOL_NAME, (tool) => <InitProjectRenderer tool={tool} />);
registerToolRenderer(GREP_TOOL_NAME, (tool) => <GrepSearchRenderer tool={tool} />);
registerToolRenderer(USE_SKILL_TOOL_NAME, (tool) => <SkillRenderer tool={tool} />);
registerToolRenderer(BASH_TOOL_NAME, (tool) => <BashRenderer tool={tool} />);
