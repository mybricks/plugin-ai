import { Rxai, Events, IDB } from "@mybricks/rxai"
import { RequestStatusTracker } from "./RequestStatusTracker";
import { DeviceType } from './../types';
import type { AgentConfigParams } from '../agents/utils/config';

class Context {

  /** UI展示名称 */
  name!: string

  rxai!: Rxai
  globalRxai!: Rxai
  currentFocus?: AiServiceFocusParams;
  api!: AiServiceAPI;
  aiViewAPI!: AiViewApi;

  /** 设计器 API（带记录功能） */
  designer?: {
    createPage?: (id: string, title: string, config?: any) => Promise<{ id: string; onProgress: Function; }>;
    createCanvas?: () => Promise<{ id: string; title: string; }>;
    updatePage?: (...params: any[]) => Promise<void>;
    updateUiCom?: (...params: any[]) => Promise<void>;
    updateLogicCom?: (...params: any[]) => Promise<void>;
    createDiagram?: (...params: any[]) => Promise<{ id: string; title: string }>;
    updateDiagram?: (...params: any[]) => Promise<void>;
    getDiagramInfo?: (...params: any[]) => any;
    getDiagramInfoByVarId?: (...params: any[]) => any;
    getDiagramInfoByListenerInfo?: (...params: any[]) => any;
    getAllComDefPrompts: () => string;
  };

  /** Agent 配置 */
  agents: AgentConfigParams[] = [];

  /** 是否多画布 */
  isMutiCanvas: boolean = true

  userConfig?: {
    useCloudComponents: boolean;
    enabledActionTags: boolean;
  }

  get useCloudComponents() {
    return this.userConfig?.useCloudComponents ?? false;
  }

  get enabledActionTags() {
    return this.userConfig?.enabledActionTags ?? true;
  }

  deviceType: DeviceType = DeviceType.Mobile

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

  pluginParams: any = {};
}

const context = new Context();

export { context };
