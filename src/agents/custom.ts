
import { context } from '../context'
import { AbstractAgent } from "./utils/config"

export function requestVibeCodingAgent(params: any, focus: any) {
  const agent = context.agents!.find((agent) => agent instanceof AbstractAgent && agent.type === "vibeCoding");
  if (agent) {
    return (agent as AbstractAgent).request({
      key: params.key,
      params,
      focus
    });
  }
}