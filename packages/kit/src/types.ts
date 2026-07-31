import type { UnifiedFile } from "../../agent/src";
import type { PromptSections } from "./prompts";

export interface PluginAIPresetVirtualFilesContext {
  getEffectiveLibrariesSection(): Promise<string>;
}

export interface PluginAIPreset {
  promptSections?: PromptSections;
  virtualFiles?: (context: PluginAIPresetVirtualFilesContext) => Promise<UnifiedFile[]>;
  disallowedDebugEnvs?: string[];
}
