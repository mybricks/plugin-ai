import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { Popup } from "../popup";
import { Check } from "../icons";
import type { ModelSelection } from "../../../../../request/src/providers";
import css from "./index.less";

export interface ModelSelectorProps {
  modelSelector: {
    models: Array<ModelSelection & { modelName: string }>;
    selected?: ModelSelection | null;
    onSelect: (selection: ModelSelection) => void;
  };
  disabled?: boolean;
}

export const ModelSelector = ({ modelSelector, disabled }: ModelSelectorProps) => {
  const { models, selected: initialSelected, onSelect } = modelSelector;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ModelSelection | null | undefined>(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  const currentModelName = selected 
    ? models.find(m => m.providerId === selected.providerId && m.modelId === selected.modelId)?.modelName || selected.modelId
    : '选择模型';

  const handleSelect = (model: ModelSelection) => {
    setSelected(model);
    onSelect(model);
    setOpen(false);
  };

  // 按照 provider 分组
  const providerGroups = models.reduce((acc, model) => {
    const pId = model.providerId || 'Other';
    if (!acc[pId]) acc[pId] = [];
    acc[pId].push(model);
    return acc;
  }, {} as Record<string, typeof models>);

  return (
    <Popup
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      placement="top-start"
      className={css.triggerContainer}
      trigger={
        <div className={classNames(css.trigger, { [css.disabled]: disabled })}>
          <span className={css.triggerText}>{currentModelName}</span>
          <svg className={css.arrow} viewBox="0 0 1024 1024" width="10" height="10" fill="currentColor">
            <path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" />
          </svg>
        </div>
      }
    >
      <div className={css.menu}>
        {Object.entries(providerGroups).map(([providerId, groupModels], groupIdx, arr) => (
          <div key={providerId} className={css.group}>
            {arr.length > 1 && <div className={css.groupTitle}>{providerId}</div>}
            {groupModels.map(m => {
              const isSelected = selected?.providerId === m.providerId && selected?.modelId === m.modelId;
              return (
                <div 
                  key={`${m.providerId}|${m.modelId}`} 
                  className={classNames(css.item, { [css.selected]: isSelected })}
                  onClick={() => handleSelect(m)}
                >
                  <div className={css.iconSlot}>
                    {isSelected && <Check />}
                  </div>
                  <div className={css.itemTitle}>{m.modelName}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Popup>
  );
};