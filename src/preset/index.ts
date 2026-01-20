import { user } from "./user"
import { prompts } from "./prompts"
import { requestAsStream } from "./requestAsStream"
import { createTemplates } from './createTemplates'
import { agents } from "./agents"

export default {
  name: '智能助手',
  user,
  prompts,
  requestAsStream,
  createTemplates,
  agents
}
