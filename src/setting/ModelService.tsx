import React, { useState, useEffect, useMemo } from 'react';
import {
  SettingValue,
  ChannelType,
  ALL_CHANNEL_TYPES,
  resolveChannel,
  getChannelLabel,
} from './Modal';
import css from './index.less';

interface ModelServiceProps {
  value: SettingValue;
  onChange: (value: SettingValue) => void;
  /** 允许的请求渠道；不传或空数组表示全部渠道可选 */
  channels?: ChannelType[];
}

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

interface PasswordInputProps {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ placeholder, value, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className={css.passwordWrapper}>
      <input
        type={visible ? 'text' : 'password'}
        className={css.nativeInput}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className={css.eyeButton}
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
};

export const ModelService: React.FC<ModelServiceProps> = ({ value, onChange, channels }) => {
  const channelsKey = channels?.length ? channels.join('|') : '';
  const allowedChannels = useMemo((): ChannelType[] => {
    if (!channelsKey) return ALL_CHANNEL_TYPES;
    return channelsKey.split('|') as ChannelType[];
  }, [channelsKey]);

  const [currentChannel, setCurrentChannel] = useState<ChannelType>(() =>
    resolveChannel(value.channel, allowedChannels)
  );
  const [localValue, setLocalValue] = useState<SettingValue>(value);

  useEffect(() => {
    setLocalValue(value);
    const resolved = resolveChannel(value.channel, allowedChannels);
    setCurrentChannel(resolved);
    if (value.channel !== resolved) {
      onChange({ ...value, channel: resolved });
    }
  }, [value, allowedChannels, onChange]);

  const handleChange = (key: keyof SettingValue, val: string) => {
    const next = { ...localValue, [key]: val };
    setLocalValue(next);
    onChange(next);
    if (key === 'channel') setCurrentChannel(val as ChannelType);
  };

  const hasCallConfig = currentChannel === 'mybricks' || currentChannel === 'custom';

  return (
    <div className={css.modelService}>

      {/* 渠道选择 */}
      <div className={css.section}>
        <div className={css.sectionTitle}>渠道选择</div>
        <div className={css.formItem}>
          <select
            className={css.nativeSelect}
            value={currentChannel}
            onChange={e => handleChange('channel', e.target.value)}
          >
            {allowedChannels.map(c => (
              <option key={c} value={c}>
                {getChannelLabel(c)}
              </option>
            ))}
          </select>
        </div>
        {currentChannel === 'infra' && (
          <div className={css.channelDescription}>
            默认渠道无需任何配置，系统将自动使用默认的模型服务。
          </div>
        )}
      </div>

      {/* 调用配置 */}
      {hasCallConfig && (
        <div className={css.section}>
          <div className={css.sectionTitle}>调用配置</div>

          {currentChannel === 'mybricks' && (
            <div className={css.formItem}>
              <label className={css.formLabel}>API 密钥</label>
              <PasswordInput
                placeholder="请输入 MyBricks AI Token"
                value={localValue.mybricksAiToken || ''}
                onChange={val => handleChange('mybricksAiToken', val)}
              />
            </div>
          )}

          {currentChannel === 'custom' && (
            <>
              <div style={{ display: 'none' }}>
                <label className={css.formLabel}>服务商格式</label>
                <select
                  className={css.nativeSelect}
                  value={localValue.customProvider || 'openai'}
                  onChange={e => handleChange('customProvider', e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className={css.formItem}>
                <label className={css.formLabel}>API 地址</label>
                <input
                  type="text"
                  className={css.nativeInput}
                  placeholder="如 https://openrouter.ai/api/v1、https://api.moonshot.cn/v1"
                  value={localValue.customApiUrl || ''}
                  onChange={e => handleChange('customApiUrl', e.target.value)}
                />
                <div className={css.formTip}>目前仅支持 OpenAI 格式的 API 接口</div>
              </div>
              <div className={css.formItem}>
                <label className={css.formLabel}>API 密钥</label>
                <PasswordInput
                  placeholder="请输入 API 密钥"
                  value={localValue.customApiKey || ''}
                  onChange={val => handleChange('customApiKey', val)}
                />
              </div>
              <div className={css.formItem}>
                <label className={css.formLabel}>模型名称</label>
                <input
                  type="text"
                  className={css.nativeInput}
                  placeholder="如 claude-sonnet-4-5、kimi-k2.5"
                  value={localValue.customModel || ''}
                  onChange={e => handleChange('customModel', e.target.value)}
                />
                <div className={css.formTip}>
                  仅支持多模态模型。推荐使用 <em>claude-sonnet-4</em> 及以上版本，或 <em>kimi-k2.5</em>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};
