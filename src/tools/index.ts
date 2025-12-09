import GeneratePage from './generate-page';
import GetComponentsDocAndPrd from './get-components-doc-and-prd';
import ModifyComponent from './modify-component'
import RefactorComponent from './refactor-component'
import GetFocusMybricksDSL from './get-focus-mybricks-dsl';
import FocusElement from './focus-element'
import GetComponentsInfoByIds from './get-component-info-by-ids';
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';
import OpenDsl from './open-dsl';
import Answer from './answer';

export const MYBRICKS_TOOLS = {
  GeneratePage,
  GetComponentsDocAndPrd,
  ModifyComponent,
  RefactorComponent,
  // ModifyComponentPlus,
  GetFocusMybricksDSL,
  GetComponentsInfoByIds,
  AnalyzeAndExpandPrd,
  OpenDsl,
  Answer,
  // FocusElement
}

export * from './utils'