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

function getTreeDescriptionByJson(data: any, level = 0) {
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
      result += getTreeDescriptionByJson(item, level);
    });
    return result;
  }

  // 处理当前节点
  if (data.title) {
    const namespace = data.def?.namespace ||
      data.def?.namespace ||
      'content';
    result += `${indent}- ${data.title}[id=${data.id}](${namespace})\n`;
  }

  // 处理slots中的组件
  if (data.slots && Array.isArray(data.slots)) {
    data.slots.forEach((slot: any) => {
      if (slot.components && Array.isArray(slot.components)) {
        slot.components.forEach(component => {
          result += getTreeDescriptionByJson(component, level + 1);
        });
      }
    });
  }

  return result;
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

  // 如果没有background属性,直接返回
  if (!styles.background) {
    return;
  }

  const background = styles.background.toString();

  // 提取颜色值
  // 匹配颜色格式: #XXX, #XXXXXX, rgb(), rgba(), hsl(), hsla(), 颜色关键字
  const colorRegex =
    /(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)/;
  const colorMatch = background.match(colorRegex);

  // 提取图片url或渐变
  // 匹配url()或各种渐变函数
  const imageRegex =
    /(url\([^)]+\)|linear-gradient\([^)]+\)|radial-gradient\([^)]+\)|conic-gradient\([^)]+\))/;
  const imageMatch = background.match(imageRegex);

  // 删除原有的background属性
  delete styles.background;

  // 如果找到颜色值,设置backgroundColor
  if (colorMatch && !styles.backgroundColor) {
    styles.backgroundColor = colorMatch[0];
  }

  // 如果找到图片或渐变,设置backgroundImage
  if (imageMatch && !styles.backgroundImage) {
    styles.backgroundImage = imageMatch[0];
  }

  if (background === 'transparent' || background === 'none') {
    styles.backgroundColor = 'transparent';
    styles.backgroundImage = 'none'
  }

  console.log('style', JSON.stringify(styles))
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


export const MyBricksHelper = {
  getTreeDescriptionByJson,
}