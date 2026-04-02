import React from 'react';
import ReactDOM from 'react-dom';
import { SettingModal, SettingModalProps } from './Modal';

let modalContainer: HTMLDivElement | null = null;

/**
 * 打开设置弹窗
 */
export function openSetting(props?: Omit<SettingModalProps, 'open' | 'onClose'>) {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'mybricks-ai-setting-container';
    document.body.appendChild(modalContainer);
  }

  const handleClose = () => {
    if (modalContainer) {
      const container = modalContainer;
      modalContainer = null;
      ReactDOM.render(
        <SettingModal
          open={false}
          onClose={() => {}}
          {...props}
          afterClose={() => {
            ReactDOM.unmountComponentAtNode(container);
            if (document.body.contains(container)) {
              document.body.removeChild(container);
            }
          }}
        />,
        container
      );
    }
  };

  ReactDOM.render(<SettingModal open={true} onClose={handleClose} {...props} />, modalContainer);
}

/**
 * 关闭设置弹窗
 */
export function closeSetting() {
  if (modalContainer) {
    const container = modalContainer;
    modalContainer = null;
    ReactDOM.render(
      <SettingModal
        open={false}
        onClose={() => {}}
        afterClose={() => {
          ReactDOM.unmountComponentAtNode(container);
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }}
      />,
      container
    );
  }
}

/**
 * 受控模式的设置弹窗组件
 */
export { SettingModal as SettingModal };
export type { SettingModalProps };

/**
 * 导出自定义请求创建函数
 */
export { createCustomRequest } from './createCustomRequest';
