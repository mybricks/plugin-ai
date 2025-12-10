import { Rxai, Events, IDB } from "@mybricks/rxai"
import { RequestStatusTracker } from "./RequestStatusTracker";

class Context {
  rxai!: Rxai
  globalRxai!: Rxai
  currentFocus?: AiServiceFocusParams;
  api!: AiServiceAPI;
  aiViewAPI!: AiViewApi;

  /** 应用传入的系统提示词 */
  prompts?: any;

  /** 应用传入的创建页面模板 */
  createTemplates?: {
    page: any
  }

  events = new Events<{
    aiViewDisplay: boolean;
    focus: AiServiceFocusParams | undefined;
  }>();

  createRxai(options: ConstructorParameters<typeof Rxai>[0] & { key: number }) {
    if (!this.rxai) {
      this.rxai = new Rxai({
        ...options,
        idb: options.key ? new IDB({
          dbName: "@mybricks/plugin-ai/messages",
          key: options.key
        }) : undefined
      })
      this.globalRxai = new Rxai(options)
    }
  }

  requestStatusTracker = new RequestStatusTracker();
}

const context = new Context();

export { context };
