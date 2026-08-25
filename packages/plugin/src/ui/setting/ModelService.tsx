import React, { useEffect, useMemo, useState } from "react";
import {
  ALL_CHANNEL_TYPES,
  ChannelType,
  getChannelLabel,
  resolveChannel,
  SettingValue,
  ProviderConfig,
  ModelConfig,
} from "./Modal";
import css from "./index.less";

export interface ModelServiceProps {
  value: SettingValue;
  onChange?: (value: SettingValue) => void;
  onSave?: (value: SettingValue) => void;
  channels?: ChannelType[];
}

// 预置供应商配置
const PRESET_PROVIDERS: Array<{ key: string; label: string; logo?: string; apiKeyUrl?: string; config: Partial<ProviderConfig> }> = [
  {
    key: "openrouter",
    label: "OpenRouter",
    logo: "https://openrouter.ai/favicon.ico",
    apiKeyUrl: "https://openrouter.ai/keys",
    config: {
      providerId: "openrouter",
      baseUrl: "https://openrouter.ai/api",
      models: [
        { id: "z-ai/glm-5.1", name: "GLM 5.1" },
        { id: "z-ai/glm-5", name: "GLM 5" },
        { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
        { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
      ],
    },
  },
  {
    key: "kimi",
    label: "月之暗面",
    logo: "https://platform.kimi.com/favicon.ico",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    config: {
      providerId: "kimi",
      baseUrl: "https://api.moonshot.cn",
      models: [
        { id: "kimi-k2.6", name: "kimi-k2.6" },
      ],
    },
  },
];

const OPENAI_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const ANTHROPIC_MESSAGES_PATH = "/v1/messages";
const PROVIDER_ENDPOINTS: Record<ProviderConfig["format"], string> = {
  openai: OPENAI_CHAT_COMPLETIONS_PATH,
  anthropic: ANTHROPIC_MESSAGES_PATH,
};

function normalizeProviderRequestUrl(format: ProviderConfig["format"], url: string): string {
  const endpoint = PROVIDER_ENDPOINTS[format];
  const baseUrl = normalizeApiBaseUrl(url);
  if (!baseUrl) return "";
  if (baseUrl.endsWith("/v1")) return `${baseUrl}${endpoint.replace(/^\/v1/, "")}`;
  return `${baseUrl}${endpoint}`;
}

function normalizeApiBaseUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, "");
  Object.values(PROVIDER_ENDPOINTS).forEach((path) => {
    normalized = normalized.replace(new RegExp(`${path}$`), "");
  });
  return normalized;
}

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }: { visible: boolean }) =>
  visible ? (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

const PasswordInput: React.FC<{ placeholder?: string; value: string; onChange: (val: string) => void }> = ({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className={css.passwordWrapper}>
      <input
        type={visible ? "text" : "password"}
        className={css.nativeInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className={css.eyeButton} onClick={() => setVisible((v: boolean) => !v)} tabIndex={-1}>
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
};

// 模型编辑弹窗
const ModelEditModal: React.FC<{
  open: boolean;
  model?: ModelConfig;
  onSave: (model: ModelConfig) => void;
  onCancel: () => void;
}> = ({
  open,
  model,
  onSave,
  onCancel,
}: {
  open: boolean;
  model?: ModelConfig;
  onSave: (model: ModelConfig) => void;
  onCancel: () => void;
}) => {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (model) {
      setId(model.id);
      setName(model.name);
      setDescription(model.description || "");
    } else {
      setId("");
      setName("");
      setDescription("");
    }
  }, [model, open]);

  if (!open) return null;

  const handleSave = () => {
    if (!id.trim() || !name.trim()) return;
    onSave({ id: id.trim(), name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={css.modalDialogTitle}>{model ? "编辑模型" : "添加模型"}</div>
        <div className={css.formItem}>
          <label className={css.formLabel}>模型 ID</label>
          <input
            type="text"
            className={css.nativeInput}
            placeholder="发送给供应商的模型参数，如 gpt-4o、claude-sonnet-4"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </div>
        <div className={css.formItem}>
          <label className={css.formLabel}>模型名称</label>
          <input
            type="text"
            className={css.nativeInput}
            placeholder="下拉选择时展示的模型名，如 GPT-4o、Claude Sonnet 4"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={css.formItem}>
          <label className={css.formLabel}>模型描述 <span style={{ opacity: 0.5, fontWeight: 400 }}>(可选)</span></label>
          <input
            type="text"
            className={css.nativeInput}
            placeholder="在模型名后方展示的简介，如 高性能通用模型"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className={css.modalDialogActions}>
          <button className={css.cancelBtn} onClick={onCancel}>取消</button>
          <button className={css.confirmBtn} onClick={handleSave} disabled={!id.trim() || !name.trim()}>确定</button>
        </div>
      </div>
    </div>
  );
};

// 供应商编辑弹窗
const ProviderEditModal: React.FC<{
  open: boolean;
  provider?: ProviderConfig;
  onSave: (provider: ProviderConfig) => void;
  onCancel: () => void;
}> = ({
  open,
  provider,
  onSave,
  onCancel,
}: {
  open: boolean;
  provider?: ProviderConfig;
  onSave: (provider: ProviderConfig) => void;
  onCancel: () => void;
}) => {
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (provider) {
      setProviderId(provider.providerId);
      setBaseUrl(provider.baseUrl);
      setApiKey(provider.apiKey);
    } else {
      setProviderId("");
      setBaseUrl("");
      setApiKey("");
    }
  }, [provider, open]);

  if (!open) return null;

  const handleSave = () => {
    if (!providerId.trim() || !baseUrl.trim() || !apiKey.trim()) return;
    onSave({
      format: "openai",
      providerId: providerId.trim(),
      baseUrl: normalizeApiBaseUrl(baseUrl),
      apiKey: apiKey.trim(),
      models: provider?.models || [],
    });
  };

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={css.modalDialogTitle}>{provider ? "编辑供应商" : "添加供应商"}</div>
        <div className={css.formItem}>
          <label className={css.formLabel}>供应商 ID</label>
          <input
            type="text"
            className={css.nativeInput}
            placeholder="如 my-provider"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          />
        </div>
        <div className={css.formItem}>
          <label className={css.formLabel}>API 地址</label>
          <input
            type="text"
            className={css.nativeInput}
            placeholder="如 https://api.example.com/v1/chat/completions"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
        <div className={css.formItem}>
          <label className={css.formLabel}>API 密钥</label>
          <PasswordInput
            placeholder="请输入 API 密钥"
            value={apiKey}
            onChange={setApiKey}
          />
        </div>
        <div className={css.modalDialogActions}>
          <button className={css.cancelBtn} onClick={onCancel}>取消</button>
          <button className={css.confirmBtn} onClick={handleSave} disabled={!providerId.trim() || !baseUrl.trim() || !apiKey.trim()}>确定</button>
        </div>
      </div>
    </div>
  );
};

export const ModelService: React.FC<ModelServiceProps> = ({ value, onChange, onSave, channels }: ModelServiceProps) => {
  const channelsKey = channels?.length ? channels.join("|") : "";
  const allowedChannels = useMemo((): ChannelType[] => {
    if (!channelsKey) return ALL_CHANNEL_TYPES;
    return channelsKey.split("|") as ChannelType[];
  }, [channelsKey]);

  const [currentChannel, setCurrentChannel] = useState<ChannelType>(() =>
    resolveChannel(value.channel, allowedChannels)
  );

  const [localValue, setLocalValue] = useState<SettingValue>(value);

  // 供应商侧边栏状态
  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    const providers = value.providers || [];
    const configuredProvider = providers.find(p => p.apiKey && p.baseUrl);
    return configuredProvider?.providerId || providers[0]?.providerId || "openrouter";
  });

  // 弹窗状态
  const [editProviderOpen, setEditProviderOpen] = useState(false);
  const [editProviderData, setEditProviderData] = useState<ProviderConfig | undefined>();
  const [editModelOpen, setEditModelOpen] = useState(false);
  const [editModelIndex, setEditModelIndex] = useState<number | undefined>();
  const [deleteProviderId, setDeleteProviderId] = useState<string | undefined>();

  // 同步外部 value 变化
  useEffect(() => {
    setLocalValue(value);
    const resolved = resolveChannel(value.channel, allowedChannels);
    setCurrentChannel(resolved);
  }, [value, allowedChannels]);

  // 渠道变更处理（仅更新本地状态）
  const handleChannelChange = (channel: ChannelType) => {
    setCurrentChannel(channel);
    setLocalValue((prev: SettingValue) => ({ ...prev, channel }));
  };

  // 供应商变更处理
  const handleProviderChange = (providerId: string) => {
    setActiveProviderId(providerId);
  };

  const handleAddCustomProvider = () => {
    setEditProviderData(undefined);
    setEditProviderOpen(true);
  };

  const handleSaveProvider = (provider: ProviderConfig) => {
    setLocalValue((prev: SettingValue) => {
      const providers = [...(prev.providers || [])];
      const existingIndex = providers.findIndex((p: ProviderConfig) => p.providerId === provider.providerId);
      if (existingIndex >= 0) {
        providers[existingIndex] = provider;
      } else {
        providers.push(provider);
      }
      return { ...prev, providers };
    });
    setEditProviderOpen(false);
    setActiveProviderId(provider.providerId);
  };

  const requestDeleteProvider = (providerId: string) => {
    if (PRESET_PROVIDERS.some((provider) => provider.key === providerId)) return;
    setDeleteProviderId(providerId);
  };

  const handleDeleteProvider = () => {
    if (!deleteProviderId) return;
    if (PRESET_PROVIDERS.some((provider) => provider.key === deleteProviderId)) return;

    setLocalValue((prev: SettingValue) => {
      const providers = (prev.providers || []).filter((p: ProviderConfig) => p.providerId !== deleteProviderId);
      return { ...prev, providers };
    });
    if (activeProviderId === deleteProviderId) {
      setActiveProviderId("openrouter");
    }
    setDeleteProviderId(undefined);
  };

  const handleAddModel = () => {
    setEditModelIndex(undefined);
    setEditModelOpen(true);
  };

  const handleEditModel = (index: number) => {
    setEditModelIndex(index);
    setEditModelOpen(true);
  };

  const handleSaveModel = (model: ModelConfig) => {
    setLocalValue((prev: SettingValue) => {
      const providers = [...(prev.providers || [])];
      let providerIndex = providers.findIndex((p: ProviderConfig) => p.providerId === activeProviderId);
      
      if (providerIndex < 0) {
        const preset = PRESET_PROVIDERS.find(p => p.key === activeProviderId);
        if (preset) {
          providers.push({
            format: "openai",
            providerId: preset.config.providerId || activeProviderId,
            baseUrl: preset.config.baseUrl || "",
            apiKey: "",
            models: preset.config.models || [],
          });
          providerIndex = providers.length - 1;
        } else {
          return prev;
        }
      }
      
      const models = [...(providers[providerIndex].models || [])];
      if (editModelIndex !== undefined) {
        models[editModelIndex] = model;
      } else {
        models.push(model);
      }
      providers[providerIndex] = { ...providers[providerIndex], models };
      return { ...prev, providers };
    });
    setEditModelOpen(false);
  };

  const handleDeleteModel = (index: number) => {
    setLocalValue((prev: SettingValue) => {
      const providers = [...(prev.providers || [])];
      const providerIndex = providers.findIndex((p: ProviderConfig) => p.providerId === activeProviderId);
      if (providerIndex < 0) return prev;
      const models = providers[providerIndex].models.filter((_: ModelConfig, i: number) => i !== index);
      providers[providerIndex] = { ...providers[providerIndex], models };
      return { ...prev, providers };
    });
  };

  // 更新供应商配置（仅更新本地状态）
  const updateProviderConfig = (providerId: string, updates: Partial<ProviderConfig>) => {
    setLocalValue((prev: SettingValue) => {
      const providers = (prev.providers || []).map((p: ProviderConfig) => {
        if (p.providerId === providerId) {
          return { ...p, ...updates };
        }
        return p;
      });
      
      if (!providers.some((p: ProviderConfig) => p.providerId === providerId)) {
        const preset = PRESET_PROVIDERS.find(p => p.key === providerId);
        providers.push({
          format: "openai",
          providerId: preset?.config.providerId || providerId,
          baseUrl: preset?.config.baseUrl || "",
          apiKey: "",
          models: preset?.config.models || [],
          ...updates,
        });
      }
      
      return { ...prev, providers };
    });
  };

  // 保存按钮点击（全量合并 preset 模型）
  const handleSave = () => {
    // 在保存前，确保所有 preset providers 的模型都被完整保存
    const mergedProviders = (localValue.providers || []).map((p: ProviderConfig) => {
      const preset = PRESET_PROVIDERS.find(pr => pr.key === p.providerId);
      const normalizedProvider = {
        ...p,
        baseUrl: normalizeApiBaseUrl(p.baseUrl),
      };
      if (preset) {
        // 全量替换：用户模型 + preset 模型（去重）
        const userModelIds = new Set((normalizedProvider.models || []).map((m: ModelConfig) => m.id));
        const presetModels = (preset.config.models || []).filter(
          (m: ModelConfig) => !userModelIds.has(m.id)
        );
        return {
          ...normalizedProvider,
          models: [...(normalizedProvider.models || []), ...presetModels]
        };
      }
      return normalizedProvider;
    });
    
    const valueToSave = { ...localValue, providers: mergedProviders };
    onSave?.(valueToSave);
    onChange?.(valueToSave);
  };

  // 获取当前供应商配置（合并preset和用户配置，按providerId+modelId去重，优先用户配置）
  const activeProvider = useMemo(() => {
    const providers = localValue.providers || [];
    const existing = providers.find((p: ProviderConfig) => p.providerId === activeProviderId);
    const preset = PRESET_PROVIDERS.find(p => p.key === activeProviderId);
    
    // 获取当前 provider 的所有 preset model IDs（用于判断 isPreset）
    const presetModelIds = new Set((preset?.config.models || []).map((m: ModelConfig) => m.id));
    
    if (existing && preset) {
      // 用户已保存此preset供应商，需要合并：优先用户配置的模型，preset模型仅作为补充
      const userModelIds = new Set((existing.models || []).map((m: ModelConfig) => m.id));
      const presetModels = (preset.config.models || [])
        .filter((m: ModelConfig) => !userModelIds.has(m.id))
        .map((m: ModelConfig) => ({ ...m, isPreset: true }));
      const userModels = (existing.models || []).map((m: ModelConfig) => ({ 
        ...m, 
        isPreset: presetModelIds.has(m.id) // 即使用户保存过，如果是 preset 中定义的，也算 preset
      }));
      return {
        ...existing,
        models: [...userModels, ...presetModels],
      };
    }
    
    if (existing) {
      return {
        ...existing,
        models: (existing.models || []).map((m: ModelConfig) => ({ 
          ...m, 
          isPreset: presetModelIds.has(m.id) // 即使用户保存过，如果是 preset 中定义的，也算 preset
        })),
      };
    }
    
    if (preset) {
      return {
        format: "openai" as const,
        providerId: preset.config.providerId || activeProviderId,
        baseUrl: preset.config.baseUrl || "",
        apiKey: "",
        models: (preset.config.models || []).map((m: ModelConfig) => ({ ...m, isPreset: true })),
      };
    }
    
    return undefined;
  }, [localValue.providers, activeProviderId]);

  // 获取所有供应商列表
  const allProviders = useMemo(() => {
    const customProviders = (localValue.providers || []).filter(
      (p: ProviderConfig) => !PRESET_PROVIDERS.some(preset => preset.key === p.providerId)
    );
    return [...PRESET_PROVIDERS, ...customProviders.map((p: ProviderConfig) => ({
      key: p.providerId,
      label: p.providerId,
      logo: p.logo,
      isCustom: true,
      config: p,
    }))];
  }, [localValue.providers]);

  return (
    <div className={css.modelService}>
      {/* 头部：渠道选择 - 固定 */}
      <div className={css.channelHeader}>
        <div className={css.channelTabs}>
          {allowedChannels.map((c: ChannelType) => (
            <div
              key={c}
              className={`${css.channelTab} ${currentChannel === c ? css.active : ""}`}
              onClick={() => handleChannelChange(c)}
            >
              {getChannelLabel(c)}
              {currentChannel === c && (
                <svg className={css.checkIcon} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 中间：可滚动内容区域 */}
      <div className={css.scrollContent}>
        {/* MyBricks 渠道配置 */}
        {currentChannel === "mybricks" && (
          <div className={css.configSection}>
            <div className={css.serviceInfo}>
              所有 AI 服务将由 MyBricks 提供，在请求中自动选择使用。
            </div>
            <div className={css.formItem}>
              <label className={css.formLabel}>API 密钥</label>
              <PasswordInput
                placeholder="请输入 MyBricks AI Token"
                value={localValue.mybricksAiToken || ""}
                onChange={(val: string) => setLocalValue((prev: SettingValue) => ({ ...prev, mybricksAiToken: val }))}
              />
            </div>
          </div>
        )}

        {/* infra 渠道配置 */}
        {currentChannel === "infra" && (
          <div className={css.configSection}>
            <div className={css.serviceInfo}>
              此渠道仅供内部使用，由系统统一管理配置。
            </div>
          </div>
        )}

        {/* 自定义渠道配置 - 左右独立滚动 */}
        {currentChannel === "custom" && (
          <div className={css.customLayout}>
            {/* 供应商侧边栏 - 独立滚动 */}
            <div className={css.providerSidebar}>
              {allProviders.map((provider: typeof allProviders[0]) => {
                const isActive = activeProviderId === provider.key;
                return (
                  <div
                    key={provider.key}
                    className={`${css.providerSidebarItem} ${isActive ? css.active : ""}`}
                    onClick={() => handleProviderChange(provider.key)}
                  >
                    {provider.logo && (
                      <img className={css.providerLogo} src={provider.logo} alt={provider.label} />
                    )}
                    <span className={css.providerSidebarLabel}>
                      {provider.label}
                    </span>
                    {provider.isCustom && (
                      <button
                        type="button"
                        className={css.providerDeleteBtn}
                        title="删除供应商"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteProvider(provider.key);
                        }}
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </div>
                );
              })}
              <div
                className={`${css.providerSidebarItem} ${css.addItem}`}
                onClick={handleAddCustomProvider}
              >
                + 添加供应商
              </div>
            </div>

            {/* 供应商配置内容 - 独立滚动 */}
            <div className={css.providerContent}>
              {activeProvider && (
                <>
                  <div className={css.formItem}>
                    <label className={css.formLabel}>API 地址</label>
                    <input
                      type="text"
                      className={css.nativeInput}
                      placeholder="请输入 API 基础地址，如 https://openrouter.ai/api"
                      value={normalizeApiBaseUrl(activeProvider.baseUrl || "")}
                      onChange={(e) => updateProviderConfig(activeProviderId, { baseUrl: normalizeApiBaseUrl(e.target.value) })}
                    />
                    {activeProvider.baseUrl && (
                      <div className={css.formTip}>
                        预览: {normalizeProviderRequestUrl(activeProvider.format, activeProvider.baseUrl)}
                      </div>
                    )}
                  </div>
                  <div className={css.formItem}>
                    <label className={css.formLabel}>API 密钥</label>
                    <PasswordInput
                      placeholder="请输入 API 密钥"
                      value={activeProvider.apiKey || ""}
                      onChange={(val: string) => updateProviderConfig(activeProviderId, { apiKey: val })}
                    />
                    {(() => {
                      const preset = PRESET_PROVIDERS.find(p => p.key === activeProviderId);
                      return preset?.apiKeyUrl ? (
                        <a className={css.formTipLink} href={preset.apiKeyUrl} target="_blank" rel="noopener noreferrer">
                          点击这里获取密钥
                        </a>
                      ) : null;
                    })()}
                  </div>

                  {/* 模型列表 */}
                  <div className={css.modelListSection}>
                    <div className={css.modelListHeader}>
                      <span className={css.modelListTitle}>模型列表</span>
                      <button className={css.addModelBtn} onClick={handleAddModel}>
                        + 添加模型
                      </button>
                    </div>
                    <div className={css.modelList}>
                      {(activeProvider.models || []).map((model: ModelConfig & { isPreset?: boolean }, index: number) => (
                        <div key={index} className={css.modelItem}>
                          <div className={css.modelItemMain}>
                            <span className={css.modelItemId}>{model.id}</span>
                            <span className={css.modelItemName}>{model.name}</span>
                            {(model as any).description && <span className={css.modelItemDesc}>{(model as any).description}</span>}
                          </div>
                          <div className={css.modelItemActions}>
                            {!model.isPreset && (
                              <>
                                <button className={css.modelItemBtn} onClick={() => handleEditModel(index)}>
                                  编辑
                                </button>
                                <button className={`${css.modelItemBtn} ${css.deleteBtn}`} onClick={() => handleDeleteModel(index)}>
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部：固定 */}
      <div className={css.footer}>
        <div className={css.footerLeft}>
          {currentChannel === "infra" ? (
            <>
              当前已选择：<span className={css.footerChannelValue}>默认渠道</span>，此渠道仅供内部使用，由系统统一管理配置。
            </>
          ) : currentChannel === "mybricks" ? (
            <>
              当前已选择：<span className={css.footerChannelValue}>MyBricks 渠道</span>，所有 AI 服务将由 MyBricks 提供，在请求中自动选择使用。
            </>
          ) : (
            <>
              当前已选择：<span className={css.footerChannelValue}>自定义渠道</span>
              {(() => {
                const configuredProviders = (localValue.providers || []).filter((p: ProviderConfig) => p.apiKey && p.baseUrl);
                const availableModels = configuredProviders.flatMap((p: ProviderConfig) => p.models || []).map((m: ModelConfig) => m.name);
                if (availableModels.length > 0) {
                  return (
                    <>
                      ，目前可用的模型有 {availableModels.slice(0, 3).join("、")}{availableModels.length > 3 ? " 等" : ""}，可以在使用中进行切换。
                    </>
                  );
                }
                return "，暂无可用模型，请先配置供应商。";
              })()}
            </>
          )}
        </div>
        <button className={css.saveBtn} onClick={handleSave}>保存</button>
      </div>

      {/* 弹窗 */}
      <ProviderEditModal
        open={editProviderOpen}
        provider={editProviderData}
        onSave={handleSaveProvider}
        onCancel={() => setEditProviderOpen(false)}
      />
      <ModelEditModal
        open={editModelOpen}
        model={editModelIndex !== undefined ? activeProvider?.models?.[editModelIndex] : undefined}
        onSave={handleSaveModel}
        onCancel={() => setEditModelOpen(false)}
      />
      {deleteProviderId && (
        <div className={css.modalOverlay} onClick={() => setDeleteProviderId(undefined)}>
          <div className={css.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={css.modalDialogTitle}>删除供应商</div>
            <div className={css.deleteConfirmText}>
              确定删除供应商「{deleteProviderId}」吗？删除后需要保存才会生效。
            </div>
            <div className={css.modalDialogActions}>
              <button className={css.cancelBtn} onClick={() => setDeleteProviderId(undefined)}>取消</button>
              <button className={css.dangerBtn} onClick={handleDeleteProvider}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
