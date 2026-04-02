import React from 'react';
import { AboutItem, ChannelType, getChannelLabel } from './Modal';
import css from './index.less';

interface AboutProps {
  version?: string;
  items?: AboutItem[];
  /** 当前生效的请求渠道 */
  channel?: ChannelType;
  /** 点击进入「模型服务」Tab */
  onGoToModelService?: () => void;
}

export const About: React.FC<AboutProps> = ({
  version,
  items = [],
  channel = 'infra',
  onGoToModelService,
}) => {
  return (
    <div className={css.about}>
      <div className={css.aboutLogo}>
        <span className={css.aboutLogoText}>Vibe<em>UI</em></span>
        {version && <span className={css.aboutLogoVersion}>{version}</span>}
      </div>

      <div className={`${css.section} ${css.aboutModelChannelSection}`}>
        <div className={css.sectionTitle}>模型渠道</div>
        <button
          type="button"
          className={css.modelChannelCard}
          onClick={() => onGoToModelService?.()}
        >
          <div className={css.modelChannelCardMain}>
            <span className={css.modelChannelCurrentLabel}>当前请求渠道</span>
            <span className={css.modelChannelCurrentValue}>{getChannelLabel(channel)}</span>
          </div>
          <span className={css.modelChannelChevron} aria-hidden>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>

      {items.length > 0 && (
        <>
          <div className={css.section}>
          <div className={css.sectionTitle}>依赖库信息</div>
          <div className={css.aboutInfo}>
            {items.map((item, index) => (
              <div key={index} className={css.aboutItem}>
                <span className={css.aboutLabel}>{item.label}</span>
                {item.type === 'link' ? (
                  <a
                    className={`${css.aboutValue} ${css.url}`}
                    href={item.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.value}
                  >
                    {item.value || '—'}
                  </a>
                ) : (
                  <span className={`${css.aboutValue} ${css.highlight}`}>
                    {item.value || '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
          </div>
        </>
      )}
    </div>
  );
};
