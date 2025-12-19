import GeneratePage from './generate-page';
import GetComponentsDocAndPrd from './generate-prd-and-require-component';
import RefactorComponent from './refactor-component'
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';
import OpenDsl from './open-dsl';
import Answer from './answer';
import BuildProcess from "./build-process";

export const MYBRICKS_TOOLS = {
  GeneratePage,
  GetComponentsDocAndPrd,
  RefactorComponent,
  AnalyzeAndExpandPrd,
  OpenDsl,
  Answer,
  BuildProcess
}

export * from './utils'