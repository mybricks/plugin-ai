import GeneratePage from './generate-page';
import GetComponentsDocAndPrd from './get-components-doc-and-prd';
import RefactorComponent from './refactor-component'
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';
import OpenDsl from './open-dsl';
import Answer from './answer';
import buildProcess from "./build-process";

export const MYBRICKS_TOOLS = {
  GeneratePage,
  GetComponentsDocAndPrd,
  RefactorComponent,
  AnalyzeAndExpandPrd,
  OpenDsl,
  Answer,
  buildProcess
}

export * from './utils'