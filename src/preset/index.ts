import { user } from "./user"
import { prompts } from "./prompts"
import { createTemplates } from './createTemplates'
import { browserDownload } from './onDownload'

export { type OnDownloadParams } from './onDownload'

export default {
  name: '智能助手',
  user,
  prompts,
  createTemplates,
  onDownload: browserDownload,
}
