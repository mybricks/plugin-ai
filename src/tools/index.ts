import GeneratePage from './generate-page';
import GetComponentsDocAndPrd from './get-components-doc-and-prd';
import ModifyComponent from './modify-component'
// import ModifyComponentPlus from './modify-component-plus'
import GetMybricksDSL from './get-mybricks-dsl';
import GetFocusMybricksDSL from './get-focus-mybricks-dsl';
import FocusElement from './focus-element'
import GetComponentInfo from './get-component-info'
import GetComponentsInfoByIds from './get-component-info-by-ids';
import AnswerUser from './answer-user';
import AnalyzeAndExpandPrd from './analyze-and-expand-prd';

export const MYBRICKS_TOOLS = {
  GeneratePage,
  GetComponentsDocAndPrd,
  ModifyComponent,
  // ModifyComponentPlus,
  // GetMybricksDSL,
  GetFocusMybricksDSL,
  GetComponentInfo,
  GetComponentsInfoByIds,
  AnalyzeAndExpandPrd,
  // AnswerUser
  // FocusElement
}

export { MyBricksHelper } from './utils'