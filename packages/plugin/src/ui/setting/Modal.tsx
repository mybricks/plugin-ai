import React, { useRef, useState } from "react";
import { Modal as AntModal } from "antd";
import { About } from "./About";
import { ModelService } from "./ModelService";
import css from "./index.less";

export type ChannelType = "infra" | "mybricks" | "custom";
export const ALL_CHANNEL_TYPES: ChannelType[] = ["infra", "mybricks", "custom"];

export function resolveChannel(saved: ChannelType | undefined, allowed?: ChannelType[]): ChannelType {
  const list = allowed?.length ? allowed : ALL_CHANNEL_TYPES;
  if (saved && list.includes(saved)) return saved;
  return list[0] ?? "infra";
}

export function getChannelLabel(c: ChannelType): string {
  switch (c) {
    case "mybricks":
      return "MyBricks";
    case "custom":
      return "自定义";
    default:
      return "默认渠道";
  }
}

export interface SettingValue {
  channel?: ChannelType;
  mybricksAiToken?: string;
  customProvider?: "openai" | "anthropic";
  customApiUrl?: string;
  customApiKey?: string;
  customModel?: string;
}

export interface AboutItem {
  label: string;
  value: string;
  type: "text" | "link";
}

export interface SettingModalProps {
  open: boolean;
  onClose: () => void;
  afterClose?: () => void;
  value?: SettingValue;
  onChange?: (value: SettingValue) => void;
  onSave?: (value: SettingValue) => void;
  channels?: ChannelType[];
  version?: string;
  aboutItems?: AboutItem[];
}

type TabKey = "about" | "model";

export const SettingModal: React.FC<SettingModalProps> = ({
  open,
  onClose,
  afterClose,
  value = {},
  onChange,
  onSave,
  channels,
  version,
  aboutItems,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("about");
  const [localValue, setLocalValue] = useState<SettingValue>(value);
  const localValueRef = useRef(localValue);
  const effectiveChannel = resolveChannel(localValue.channel, channels);

  const handleValueChange = (newValue: SettingValue) => {
    localValueRef.current = newValue;
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  const handleClose = () => {
    onSave?.(localValueRef.current);
    onClose();
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "about", label: "关于" },
    { key: "model", label: "模型服务" },
  ];

  return (
    <AntModal
      title={null}
      open={open}
      visible={open}
      onCancel={handleClose}
      afterClose={afterClose}
      footer={null}
      width={700}
      centered
      closable={false}
      destroyOnClose
      className={css.settingModal}
    >
      <div className={css.modalHeader}>
        <span className={css.modalTitle}>设置</span>
        <div className={css.modalClose} onClick={handleClose}>
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
            <path d="M557.312 513.248l265.28-263.904c12.544-12.48 12.608-32.704 0.128-45.248-12.512-12.576-32.704-12.608-45.248-0.128L512.128 467.904 246.944 203.936c-12.48-12.544-32.704-12.608-45.248-0.128-12.576 12.512-12.608 32.704-0.128 45.248l265.216 263.84L201.6 776.8c-12.544 12.48-12.608 32.704-0.128 45.248 6.24 6.272 14.464 9.44 22.688 9.44 8.16 0 16.32-3.104 22.56-9.312l265.216-263.872 265.152 263.872c6.24 6.208 14.4 9.312 22.56 9.312 8.224 0 16.448-3.168 22.688-9.44 12.48-12.544 12.416-32.768-0.128-45.248L557.312 513.248z" fill="currentColor" />
          </svg>
        </div>
      </div>
      <div className={css.modalContent}>
        <div className={css.sidebar}>
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className={`${css.sidebarItem} ${activeTab === tab.key ? css.active : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>
        <div className={css.mainContent}>
          {activeTab === "about" && (
            <About
              version={version}
              items={aboutItems}
              channel={effectiveChannel}
              onGoToModelService={() => setActiveTab("model")}
            />
          )}
          {activeTab === "model" && (
            <ModelService value={localValue} onChange={handleValueChange} channels={channels} />
          )}
        </div>
      </div>
    </AntModal>
  );
};
