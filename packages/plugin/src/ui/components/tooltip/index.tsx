import React from "react";
import classNames from "classnames";
import { Tooltip as AntTooltip } from "antd";
import css from "./index.less";

export type TooltipProps = React.ComponentProps<typeof AntTooltip>;

/** placement → 箭头定位类（与 index.less 中的类一一对应） */
const PLACEMENT_CLASS: Record<string, string> = {
  top: "top",
  topLeft: "topLeft",
  topRight: "topRight",
  bottom: "bottom",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
  left: "left",
  leftTop: "leftTop",
  leftBottom: "leftBottom",
  right: "right",
  rightTop: "rightTop",
  rightBottom: "rightBottom",
};

/** 气泡与目标之间的最终间距（px）：antd 默认 4px，按视觉微调 */
const CLOSE_GAP = 6;

type PlacementEntry = {
  points: string[];
  offset: [number, number];
  targetOffset: number[];
  overflow: { adjustX: number; adjustY: number };
  ignoreShake: boolean;
};

const mk = (points: string[], offset: [number, number]): PlacementEntry => ({
  points,
  offset,
  targetOffset: [0, 0],
  overflow: { adjustX: 1, adjustY: 1 },
  ignoreShake: true,
});

/** 覆盖 antd 内置对齐：把各方向的保留间距换成 CLOSE_GAP。
    注意不能用 overlayStyle margin 调间距——dom-align 每次定位会按元素实际矩形
    自我补偿 margin，改多少都被吸收。 */
const BUILTIN_PLACEMENTS: Record<string, PlacementEntry> = {
  top: mk(["bc", "tc"], [0, -CLOSE_GAP]),
  topLeft: mk(["bl", "tl"], [0, -CLOSE_GAP]),
  topRight: mk(["br", "tr"], [0, -CLOSE_GAP]),
  bottom: mk(["tc", "bc"], [0, CLOSE_GAP]),
  bottomLeft: mk(["tl", "bl"], [0, CLOSE_GAP]),
  bottomRight: mk(["tr", "br"], [0, CLOSE_GAP]),
  left: mk(["cr", "cl"], [-CLOSE_GAP, 0]),
  leftTop: mk(["tr", "cl"], [-CLOSE_GAP, 0]),
  leftBottom: mk(["br", "cl"], [-CLOSE_GAP, 0]),
  right: mk(["cl", "cr"], [CLOSE_GAP, 0]),
  rightTop: mk(["tl", "tr"], [CLOSE_GAP, 0]),
  rightBottom: mk(["bl", "br"], [CLOSE_GAP, 0]),
};

/**
 * antd Tooltip 的 mybricks 皮肤封装。
 *
 * 宿主 data-mybricks-tip 在嵌入面板有定位漂移，故 plugin-ai UI 内统一使用本组件。
 * 样式对齐宿主 tooltip：深灰底 + 同色小三角、12px 文案、无阴影。
 *
 * 箭头定位不能依赖 antd 的 .ant-tooltip-placement-* 规则（宿主管道里不生效，
 * 见 index.less 注释），这里按 placement 附加本地类，由 index.less 完成定位。
 */
// TODO: 调试用——defaultVisible 让所有气泡常显，方便随时在 DevTools 里检查定位；验证完删掉这个默认值
export const Tooltip = ({ placement = "top", defaultVisible = false, children, ...rest }: TooltipProps) => (
  <AntTooltip
    mouseEnterDelay={0.3}
    defaultVisible={defaultVisible}
    placement={placement}
    builtinPlacements={BUILTIN_PLACEMENTS as TooltipProps["builtinPlacements"]}
    overlayClassName={classNames(css.tooltipOverlay, css[PLACEMENT_CLASS[placement] ?? "top"])}
    {...rest}
  >
    {children}
  </AntTooltip>
);
