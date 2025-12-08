import { jsonrepair } from 'jsonrepair'

export function getFiles(files: RxFiles, {
  extName
}: {
  extName?: string
}): RxFile | undefined {
  let result: RxFile | undefined
  Object.keys(files).forEach((fileName) => {
    const file = files[fileName] as RxFile;
    if (file.extension === extName) {
      result = file
    }
  })
  return result
}


export function getPageHierarchy(outlineInfo: any, currentFocus: any) {
  // 获取完整的页面结构
  const pageOutline = outlineInfo;

  // 检查组件树中是否包含目标组件
  function containsComponent(data: any, targetId: string): boolean {
    if (!data) return false;
    if (data.id === targetId) return true;

    if (data.slots && Array.isArray(data.slots)) {
      return data.slots.some((slot: any) => {
        if (slot.components && Array.isArray(slot.components)) {
          return slot.components.some(component => containsComponent(component, targetId));
        }
        return false;
      });
    }
    return false;
  }

  // 检查组件是否有子组件
  function hasChildren(data: any): boolean {
    if (!data || !data.slots || !Array.isArray(data.slots)) {
      return false;
    }
    return data.slots.some((slot: any) => {
      return slot.components && Array.isArray(slot.components) && slot.components.length > 0;
    });
  }

  // 生成树形描述
  function generateTreeDescription(data: any, level = 0): string {
    const indent = '  '.repeat(level);
    let result = '';

    if (!data || Object.keys(data).length === 0) {
      return '无内容，代表内容为空';
    }

    // 如果是数组，遍历每个元素
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '无内容，代表内容为空';
      }
      data.forEach(item => {
        result += generateTreeDescription(item, level);
      });
      return result;
    }

    // 处理当前节点
    if (data.title) {
      const namespace = data.def?.namespace;
      const isFocused = (currentFocus?.type === 'uiCom' && data.id === currentFocus?.comId) ||
        (currentFocus?.type === 'page' && data.id === currentFocus?.pageId);
      const focusMarker = isFocused ? ' 【当前聚焦】' : '';
      const collapsedMarker = data._hasCollapsedChildren ? ' 【子组件已折叠】' : '';

      result += `${indent}- ${data.title}[id=${data.id}]${namespace ? `(${namespace})` : ''}${focusMarker}${collapsedMarker}\n`;
    }

    // 处理slots中的组件
    if (data.slots && Array.isArray(data.slots)) {
      data.slots.forEach((slot: any) => {
        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            result += generateTreeDescription(component, level + 1);
          });
        }
      });
    }

    return result;
  }

  // 根据聚焦类型处理数据
  let processedData;

  if (currentFocus?.type === 'uiCom') {
    // 聚焦组件时，过滤出从页面到当前组件的路径
    function filterToFocusedComponent(data: any): any {
      if (!data) return null;

      // 如果当前节点就是目标组件，返回完整的当前节点
      if (data.id === currentFocus.comId) {
        return data;
      }

      // 检查子组件中是否包含目标组件
      if (data.slots && Array.isArray(data.slots)) {
        const filteredSlots = data.slots.map((slot: any) => {
          if (slot.components && Array.isArray(slot.components)) {
            const filteredComponents = slot.components.map(component => {
              // 如果这个组件包含目标组件，则递归过滤
              if (containsComponent(component, currentFocus.comId)) {
                return filterToFocusedComponent(component);
              } else {
                // 如果这个组件不在路径上，只保留基本信息，不展开子组件
                const hasChildComponents = hasChildren(component);
                return {
                  title: component.title,
                  id: component.id,
                  def: component.def,
                  _hasCollapsedChildren: hasChildComponents
                };
              }
            }).filter(Boolean);

            return filteredComponents.length > 0 ? { ...slot, components: filteredComponents } : null;
          }
          return null;
        }).filter(Boolean);

        if (filteredSlots.length > 0) {
          return { ...data, slots: filteredSlots };
        }
      }
      return null;
    }

    const filteredOutline = filterToFocusedComponent(pageOutline);
    processedData = {
      title: '页面',
      id: currentFocus?.pageId,
      slots: [{ components: [filteredOutline] }]
    };
  } else {
    // 聚焦页面时，获取完整的页面层级关系
    processedData = {
      title: '页面',
      id: currentFocus?.pageId,
      slots: [{ components: [pageOutline] }]
    };
  }

  return generateTreeDescription(processedData);
}

export function getComponentIdToTitleMap(outlineInfo: any) {
  const componentMap = new Map();

  // 递归遍历函数
  function traverse(data: any) {
    if (!data) return;

    // 如果是数组，遍历每个元素
    if (Array.isArray(data)) {
      data.forEach(item => traverse(item));
      return;
    }

    // 如果当前节点有id和title，添加到映射中
    if (data.id && data.title) {
      componentMap.set(data.id, data.title);
    }

    // 递归遍历slots中的组件
    if (data.slots && Array.isArray(data.slots)) {
      data.slots.forEach(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            traverse(component);
          });
        }
      });
    }
  }

  // 开始遍历
  traverse(outlineInfo);


  return componentMap;
}

export function getComponentOperationSummary(operations = [], componentIdToTitleMap = new Map()) {
  const componentActions: any = {};
  const results: any = [];

  // 收集组件title信息（补充传入映射中没有的新组件）
  operations.forEach(operation => {
    if (operation.type === 'addChild' && operation.params.title) {
      componentIdToTitleMap.set(operation.params.comId, operation.params.title)
    }
  });

  operations.forEach(operation => {
    const { comId, type, target, params } = operation;

    switch (type) {
      case 'doConfig':
        const configTitle = componentIdToTitleMap.get(comId) || comId;
        if (!componentActions[configTitle]) {
          componentActions[configTitle] = { configs: [] };
        }
        const simplifiedPath = params.path.split('/').pop();
        componentActions[configTitle].configs.push(simplifiedPath);
        break;

      case 'addChild':
        const parentTitle = componentIdToTitleMap.get(comId) || comId;

        // 1. 先记录添加组件的操作
        results.push(`• 在【${parentTitle}】的 ${target} 插槽中新增了「${params.title}」`);

        // 2. 如果新组件有配置，单独记录配置操作
        if (params.configs && params.configs.length > 0) {
          const childConfigs = params.configs.map(config => config.path.split('/').pop());
          results.push(`• 配置【${params.title}】：设置了 ${childConfigs.join('、')} 等属性`);
        }
        break;

      case 'move':
        const moveTitle = componentIdToTitleMap.get(comId);
        const targetTitle = componentIdToTitleMap.get(params.to?.comId);
        const slotId = params.to?.slotId;

        if (moveTitle && targetTitle) {
          results.push(`• 将【${moveTitle}】移动至【${targetTitle}】的 ${slotId} 插槽中`);
        }
        break;

      case 'delete':
        const deleteTitle = componentIdToTitleMap.get(comId);
        if (deleteTitle) {
          results.push(`• 删除了【${deleteTitle}】组件`);
        } else {
          // 如果没有title，可能是删除了一个没有被记录的组件
          results.push(`• 删除了组件 ${comId}`);
        }
        break;
    }
  });

  // 处理独立的配置操作（doConfig类型）
  Object.keys(componentActions).forEach(title => {
    const actions = componentActions[title];
    if (actions.configs.length > 0) {
      results.push(`• 配置【${title}】：调整了 ${actions.configs.join('、')} 等属性`);
    }
  });

  return results.join('\n');
}

interface Config {
  path: string;
  value: any;
  style: any;
}

interface AddChildActionParams {
  namespace?: string;
  ns?: string;
  layout?: any;
  configs: Config[];
}

interface DoConfigActionParams {
  path: string;
  value: any;
}

type ActionParams = AddChildActionParams | DoConfigActionParams;

interface Action {
  comId: string;
  type: string;
  target: string;
  params: ActionParams;
}

const formatAction = (_action: string) => {
  let action;
  try {
    action = JSON.parse(_action);
  } catch (error) {
    try {
      const repairedAction = jsonrepair(_action)
      action = JSON.parse(repairedAction)
    } catch (error) {
      console.error("repair action error", error);
    }
  }

  if (!Array.isArray(action)) {
    return action;
  }

  const [comId, target, type, params] = action;
  const newAct: Action = {
    comId,
    type,
    target,
    params,
  };

  if (newAct.type === "delete") {
    if (!newAct.params) {
      return {
        ...newAct,
        params: {}
      }
    }
  }

  if (newAct.type === 'move') {
    if (newAct.params) {
      return {
        ...newAct,
        params: {
          to: newAct.params
        }
      }
    }
  }

  // ns => namespace
  if (newAct.type === "addChild") {
    if (newAct.params?.ns) {
      newAct.params.namespace = newAct.params.ns;
      delete newAct.params.ns;
    }
  }

  // absolute 布局的转化
  if (newAct.params?.value?.display === "absolute") {
    newAct.params.value.position = "smart";
    delete newAct.params.value.display;
  }

  // absolute 布局的转化
  if (newAct.type === "addChild" && Array.isArray(newAct.params?.configs)) {
    newAct.params.configs.forEach((config) => {
      if (config?.value?.display === "absolute") {
        config.value.position = "smart";
        delete config.value.display;
      }

      if (config?.style) {
        // 兼容background
        transformToValidBackground(config?.style);
      }
    });
  }

  // flex布局幻觉的兼容
  if (newAct.type === "doConfig") {
    if (newAct.params?.display === 'flex' && !newAct.params?.flexDirection) {
      newAct.params.flexDirection = 'column';
    }
    if (newAct.params?.flexDirection && !newAct.params?.display) {
      newAct.params.display = 'flex';
    }
  }

  // 对样式幻觉的兼容
  if (newAct.type === "doConfig" && newAct.params?.style) {
    // 兼容background
    transformToValidBackground(newAct.params?.style);
  }
  if (newAct.type === "addChild" && newAct.params?.layout) {
    // 兼容margin
    transformToValidMargins(newAct.params?.layout);
  }

  return newAct;
};

/**
 * 将background转换为有效的backgroundColor和backgroundImage
 * @param styles 需要转换的样式对象
 */
function transformToValidBackground(styles: any): void {
  // 兼容下把渐变色配置到backgroundColor的情况
  if (
    styles?.backgroundColor &&
    styles?.backgroundColor?.indexOf("gradient") > -1
  ) {
    const imageRegex =
      /(url\([^)]+\)|linear-gradient\([^)]+\)|radial-gradient\([^)]+\)|conic-gradient\([^)]+\))/;
    const imageMatch = styles.backgroundColor.match(imageRegex);

    if (imageMatch && !styles.backgroundImage) {
      styles.backgroundImage = imageMatch[0];
    }

    delete styles.backgroundColor;
  }

  // 兼容，配置backgroundColor的话记得去除渐变色
  if (styles.backgroundColor && !styles.backgroundImage) {
    styles.backgroundColor = styles.backgroundColor
    styles.backgroundImage = 'none'
  }

  // 如果没有background属性,直接返回
  if (!styles.background) {
    return;
  }

  const background = styles.background.toString();

  // 删除原有的background属性
  delete styles.background;

  // 处理特殊值
  if (background === 'transparent' || background === 'none') {
    styles.backgroundColor = 'transparent';
    styles.backgroundImage = 'none';
    return;
  }

  // 提取图片url或渐变
  // 匹配url()或各种渐变函数，优先检查是否为图片url或渐变（避免被颜色正则误匹配）
  const imageRegex =
    /(url\([^)]+\)|linear-gradient\([^)]+\)|radial-gradient\([^)]+\)|conic-gradient\([^)]+\))/;
  const imageMatch = background.match(imageRegex);

  // 如果找到图片或渐变,设置backgroundImage
  if (imageMatch && !styles.backgroundImage) {
    styles.backgroundColor = 'transparent';
    styles.backgroundImage = imageMatch[0];
    return;
  }

  // 提取颜色值
  // 匹配颜色格式: #XXX, #XXXXXX, rgb(), rgba(), hsl(), hsla(), 颜色关键字
  const colorRegex =
    /(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)/;
  const colorMatch = background.match(colorRegex);

  // 如果找到颜色值,设置backgroundColor
  if (colorMatch && !styles.backgroundColor) {
    styles.backgroundColor = colorMatch[0];
    styles.backgroundImage = 'none'
    return;
  }
}

/**
 * 将margin简写转换为marginTop/Right/Bottom/Left
 * @param styles 需要转换的样式对象
 */
function transformToValidMargins(styles: any): void {
  // 如果没有margin属性,直接返回
  if (!styles.margin) {
    return;
  }

  const margin = styles.margin.toString().trim();
  const values = margin.split(/\s+/); // 按空格分割

  // 根据值的数量设置不同方向的margin
  switch (values.length) {
    case 1: // margin: 10px;
      styles.marginTop = values[0];
      styles.marginRight = values[0];
      styles.marginBottom = values[0];
      styles.marginLeft = values[0];
      break;
    case 2: // margin: 10px 20px;
      styles.marginTop = values[0];
      styles.marginRight = values[1];
      styles.marginBottom = values[0];
      styles.marginLeft = values[1];
      break;
    case 3: // margin: 10px 20px 30px;
      styles.marginTop = values[0];
      styles.marginRight = values[1];
      styles.marginBottom = values[2];
      styles.marginLeft = values[1];
      break;
    case 4: // margin: 10px 20px 30px 40px;
      styles.marginTop = values[0];
      styles.marginRight = values[1];
      styles.marginBottom = values[2];
      styles.marginLeft = values[3];
      break;
  }

  // 删除原有的margin属性
  delete styles.margin;
}

/**
 * 创建actions解析器
 * @returns {Function} 解析函数
 */
export function createActionsParser() {
  const processedLines = new Set();

  return function parseActions(text: string) {
    const newActions = [];
    const lines = text.split("\n").filter(line => line.trim() !== '');

    // 只处理除了最后一行之外的所有行（最后一行可能不完整）
    const linesToProcess = lines.slice(0, -1);
    const lastLine = lines[lines.length - 1];

    // 处理完整的行
    for (const line of linesToProcess) {
      const trimmedLine = line.trim();

      // 跳过空行和已处理的行
      if (!trimmedLine || processedLines.has(trimmedLine)) {
        continue;
      }

      try {
        const parsedAction = formatAction(trimmedLine);
        if (parsedAction.comId) {
          newActions.push(parsedAction);
          processedLines.add(trimmedLine);
        }
      } catch (error) {
        // 这是真正的解析错误（完整的行但格式错误）
        processedLines.add(trimmedLine); // 标记为已处理，避免重复尝试
      }
    }

    // 处理最后一行
    if (lastLine && lastLine.trim()) {
      const trimmedLastLine = lastLine.trim();

      // 如果文本以换行符结尾，说明最后一行是完整的
      if ((text.endsWith("\n")) && !processedLines.has(trimmedLastLine)) {
        try {
          const parsedAction = formatAction(trimmedLastLine);
          if (parsedAction.comId) {
            newActions.push(parsedAction);
            processedLines.add(trimmedLastLine);
          }
        } catch (error) {
          processedLines.add(trimmedLastLine);
        }
      }
    }

    return newActions;
  };
}

export function stripFileBlocks(raw: string) {
  if (typeof raw !== "string") {
    return ""
  }
  const fileBlockRegex = /```[^\n]*title\s*=\s*"[^"\n]*"?[\s\S]*?```/g;
  let cleaned = raw.replace(fileBlockRegex, '');

  // 去掉多余空行：连续空白行压缩为单个换行，再首尾 trim
  cleaned = cleaned
    .replace(/\n{2,}/g, '\n') // 多个换行压缩为一个
    .trim();

  return cleaned;
}