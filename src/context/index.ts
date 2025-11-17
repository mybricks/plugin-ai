import { Rxai } from "@mybricks/rxai"

class Context {
  rxai!: Rxai
  currentFocus?: AiServiceFocusParams;
  api!: AiServiceAPI;

  createRxai(options: ConstructorParameters<typeof Rxai>[0]) {
    if (!this.rxai) {
      this.rxai = new Rxai(options)
    }
  }
}

const context = new Context();

export { context };

