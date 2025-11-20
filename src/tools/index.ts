import GeneratePage from './generate-page';
import GetComponentsDocAndPrd from './get-components-doc-and-prd';
import ModifyComponent from './modify-component'
import GetMybricksDSL from './get-mybricks-dsl';
import GetFocusMybricksDSL from './get-focus-mybricks-dsl';
import FocusElement from './focus-element'
import GetComponentInfo from './get-component-info'
import AnswerUser from './answer-user';
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';

export const MYBRICKS_TOOLS = {
  GeneratePage,
  GetComponentsDocAndPrd,
  ModifyComponent,
  // GetMybricksDSL,
  GetFocusMybricksDSL,
  GetComponentInfo,
  AnalyzeAndExpandPrd,
  // AnswerUser
  // FocusElement
}

export { MyBricksHelper } from './utils'