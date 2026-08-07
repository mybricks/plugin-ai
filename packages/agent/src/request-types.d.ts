/** Declaration-build shim for the request implementation bundled with agent. */
export type RequestAsStreamFn = any;
export type RequestAsStreamParams = any;
export type ModelSelection = any;
export type ToolDescriptor = any;
export type ProviderConfig = any;
export declare const createRequestAsStream: any;
export declare class LLMProviders {
  constructor(options: any);
  request: any;
  setSelected(providerId?: string, modelId?: string): void;
  restoreSelection(selection: any): void;
  onSelectionChange(listener: (selection: any) => void): void;
}
