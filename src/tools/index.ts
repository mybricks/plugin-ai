import GenerateUiContent, { GenerateUiContent as GenerateUiContentParamsTool } from './generate-ui-content';
import AnalyzeRequirementAndComponents, { AnalyzeRequirementAndComponents as AnalyzeRequirementAndComponentsParamsTool } from './analyze-requirement-and-components';
import RefactorUiContent, { RefactorUiContent as RefactorUiContentParamsTool } from './refactor-ui-content'
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';
import OpenDsl from './open-dsl';
import Answer from './answer';
import BuildProcess, { BuildProcess as BuildProcessParamsTool } from "./build-process";
import CodingSubagentAsTool from './coding-subagent-as-tool';

export const MYBRICKS_TOOLS = {
  GenerateUiContent,
  AnalyzeRequirementAndComponents,
  RefactorUiContent,
  AnalyzeAndExpandPrd,
  OpenDsl,
  Answer,
  BuildProcess,
  CodingSubagentAsTool
}

export const MyBricksParamsTools = {
  GenerateUiContent: GenerateUiContentParamsTool,
  AnalyzeRequirementAndComponents: AnalyzeRequirementAndComponentsParamsTool,
  RefactorUiContent: RefactorUiContentParamsTool,
  BuildProcess: BuildProcessParamsTool,
}

export * from './utils'