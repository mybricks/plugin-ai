import { Rxai, Events } from "@mybricks/rxai"

class Context {
  rxai!: Rxai
  currentFocus?: AiServiceFocusParams;
  api!: AiServiceAPI;

  /** 应用传入的系统提示词 */
  prompts?: any;

  events = new Events<{
    aiViewDisplay: boolean;
  }>();

  createRxai(options: ConstructorParameters<typeof Rxai>[0]) {
    if (!this.rxai) {
      this.rxai = new Rxai(options)
    }
  }
}

const context = new Context();

export { context };

