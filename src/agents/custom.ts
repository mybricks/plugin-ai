
import { context } from '../context'
import { AbstractAgent } from "./utils/config"

export function requestVibeCodingAgent(params: any, {
  pageId,
  comId,
}: {
  pageId: string;
  comId?: string;
}) {
  const agent = context.agents!.find((agent) => agent instanceof AbstractAgent && agent.type === "vibeCoding");
  if (agent) {
    return (agent as AbstractAgent).request({
      key: params.key,
      params,
      focus: {
        comId,
        pageId
      }
    });
  }
}