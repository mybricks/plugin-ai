import React from "react";
import ReactDOM from "react-dom";
import { SettingModal, SettingModalProps } from "./Modal";

let modalContainer: HTMLDivElement | null = null;

export function openSetting(props?: Omit<SettingModalProps, "open" | "onClose">) {
  if (!modalContainer) {
    modalContainer = document.createElement("div");
    modalContainer.id = "mybricks-ai-setting-container";
    document.body.appendChild(modalContainer);
  }

  const handleClose = () => {
    if (!modalContainer) return;
    const container = modalContainer;
    modalContainer = null;
    ReactDOM.render(
      <SettingModal
        open={false}
        onClose={() => {}}
        {...props}
        afterClose={() => {
          ReactDOM.unmountComponentAtNode(container);
          if (document.body.contains(container)) document.body.removeChild(container);
        }}
      />,
      container
    );
  };

  ReactDOM.render(<SettingModal open={true} onClose={handleClose} {...props} />, modalContainer);
}

export function closeSetting() {
  if (!modalContainer) return;
  const container = modalContainer;
  modalContainer = null;
  ReactDOM.render(
    <SettingModal
      open={false}
      onClose={() => {}}
      afterClose={() => {
        ReactDOM.unmountComponentAtNode(container);
        if (document.body.contains(container)) document.body.removeChild(container);
      }}
    />,
    container
  );
}

export { SettingModal };
export type { SettingModalProps };
export type { SettingValue, ChannelType, AboutItem } from "./Modal";
