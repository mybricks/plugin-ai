import { jsonrepair } from 'jsonrepair'
import { ComponentsManager } from './../agents/workspace/components-manager'

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
        const simplifiedPath = params.path?.split?.('/')?.pop?.();
        componentActions[configTitle].configs.push(simplifiedPath);
        break;

      case 'addChild':
        const parentTitle = componentIdToTitleMap.get(comId) || comId;

        // 1. 先记录添加组件的操作
        results.push(`• 在【${parentTitle}】的 ${target} 插槽中新增了「${params.title}」`);

        // 2. 如果新组件有配置，单独记录配置操作
        if (params.configs && params.configs.length > 0) {
          const childConfigs = params.configs.map(config => config.path?.split?.('/')?.pop?.());
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
  ignore?: boolean;
  enhance?: boolean;
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

// 第二个参数用于透传当前解析器实例内的 comId -> params 映射，方便后续 O(1) 快查
const formatAction = (
  _action: string,
  comIdToParamsMap?: Map<string, AddChildActionParams>,
  options?: { enabledActionTags?: boolean }
) => {
  const { enabledActionTags } = options ?? {};
  let action;
  try {
    // TODO，后面要提示词处理的，这样replace不合理
    const fixActionString = _action.replaceAll('{":parent/', '{"path":":parent/')
    action = JSON.parse(fixActionString);
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
      newAct.params.namespace = ComponentsManager.getFullNamespace(newAct.params.ns);
      delete newAct.params.ns;
    }
  }

  // 标记使用
  if (newAct.type === 'addChild') {
    if (enabledActionTags) {
      
      if (newAct.params?.ignore) {
        // TODO：标记的兼容，对于配置了ignore，但是有padding的组件，直接替换成enhance，因为直接去掉，底层的100%组件宽高会失效。
        if (newAct?.params?.configs?.some(config => Object.keys(config?.style ?? {}).some(key => key.startsWith('padding')))) {
          newAct.params.enhance = true;
          delete newAct.params.ignore;
        }

        // TODO：标记的兼容，如果配置了enhance或者ignore的不是布局组件，需要删除该标记
        if (!ComponentsManager.isLayoutComponent(newAct.params.namespace)) {
          delete newAct.params.enhance;
          delete newAct.params.ignore;
        }

        // TODO：标记的兼容，关注配置了ignore的父级元素是否为布局组件，如果不是，需要改成enhance而不是ignore，因为其他组件没有setLayout函数
        if (comIdToParamsMap) {
          const parentParams = comIdToParamsMap.get(newAct.comId);
          if (!parentParams) { // 没有父级组件，直接删除标记
            delete newAct.params.enhance;
            delete newAct.params.ignore;
          } else {
            // 有父级组件，判断父级组件是否为布局组件
            const parentNamespace = parentParams?.namespace;
            if (parentNamespace && !ComponentsManager.isLayoutComponent(parentNamespace)) {
              newAct.params.enhance = true;
              delete newAct.params.ignore;
            }
          }
        }
      }
    } else {
      if (newAct.params.enhance || newAct.params.ignore) {
        delete newAct.params.enhance;
        delete newAct.params.ignore;
      }
    }
  }

  // absolute 布局的转化
  if (newAct.params?.value?.display === "absolute") {
    newAct.params.value.position = "smart";
    delete newAct.params.value.display;
  }

  // flexDirection 的兼容
  if (newAct.params?.value && newAct.params.value.display === "flex" && !newAct.params.value.flexDirection) {
    newAct.params.value.flexDirection = "row";
  }

  // addChild兼容
  if (newAct.type === "addChild" && Array.isArray(newAct.params?.configs)) {
    newAct.params.configs.forEach((config) => {

      // path value幻觉，直接用key value的情况
      if (!config?.path && Object.keys(config).length === 1) {
        const firstKey = Object.keys(config)[0];
        const value = config[firstKey]
        delete config[firstKey];
        config.path = firstKey
        config.value = value
      }

      if (config.parent) {
        config.path = `:parent/${config.path}`;
        delete config.parent;
      }
      
      // absolute 布局的转化
      if (config?.value?.display === "absolute") {
        config.value.position = "smart";
        delete config.value.display;
      }

      // flexDirection 的兼容
      if (config.value && config.value?.display === "flex" && !config.value?.flexDirection) {
        config.value.flexDirection = "row";
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

    // 支持width=auto
    if (newAct.params?.layout?.width === 'auto') {
      newAct.params.layout.width = '100%';
    }
  }

  // 在所有兼容性处理之后，再记录 addChild 的配置，保证 namespace / layout 等信息已经就绪
  if (comIdToParamsMap && newAct.type === "addChild") {
    comIdToParamsMap.set(newAct.params.comId, JSON.parse(JSON.stringify(newAct.params)) as AddChildActionParams);
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

  const background = styles.background.toString().trim();

  // 删除原有的background属性
  delete styles.background;

  // 处理特殊值
  if (background === 'transparent' || background === 'none') {
    styles.backgroundColor = 'transparent';
    styles.backgroundImage = 'none';
    return;
  }

  // 解析复合背景
  const parsedBackground = parseComplexBackground(background);
  
  if (parsedBackground.hasImages && !styles.backgroundImage) {
    styles.backgroundColor = 'transparent';
    styles.backgroundImage = parsedBackground.images.join(', ');
    
    // 设置背景位置和尺寸
    if (parsedBackground.position && !styles.backgroundPosition) {
      styles.backgroundPosition = parsedBackground.position;
    }
    if (parsedBackground.size && !styles.backgroundSize) {
      styles.backgroundSize = parsedBackground.size;
    }

    return;
  }

  // 如果只有颜色
  if (parsedBackground.color && !styles.backgroundColor) {
    styles.backgroundColor = parsedBackground.color;
    if (!styles.backgroundImage) {
      styles.backgroundImage = 'none';
    }
    return;
  }

  // 如果没有找到颜色，但有backgroundImage，设置透明背景色
  if (styles.backgroundImage && !styles.backgroundColor) {
    styles.backgroundColor = 'transparent';
  }
}

/**
 * 解析复杂的background值
 * @param background 原始background字符串
 * @returns 解析后的对象
 */
function parseComplexBackground(background: string) {
  const result = {
    images: [] as string[],
    color: '',
    position: '',
    size: '',
    hasImages: false
  };

  // 使用更精确的方法来提取图片和渐变
  const images = extractBackgroundImages(background);
  
  if (images.length > 0) {
    result.hasImages = true;
    result.images = images;
    
    // 提取位置和尺寸信息
    const positionSizeInfo = extractPositionAndSize(background, images);
    result.position = positionSizeInfo.position;
    result.size = positionSizeInfo.size;
  }

  // 提取颜色值
  const color = extractBackgroundColor(background, images);
  if (color) {
    result.color = color;
  }

  return result;
}

/**
 * 提取背景图片和渐变
 */
function extractBackgroundImages(background: string): string[] {
  const images: string[] = [];
  let remaining = background;
  
  while (remaining.length > 0) {
    // 查找下一个函数的开始
    const urlMatch = remaining.match(/url\s*\(/);
    const gradientMatch = remaining.match(/(linear-gradient|radial-gradient|conic-gradient)\s*\(/);
    
    let nextMatch = null;
    let matchType = '';
    
    if (urlMatch && gradientMatch) {
      // 选择更早出现的匹配
      if (urlMatch.index! < gradientMatch.index!) {
        nextMatch = urlMatch;
        matchType = 'url';
      } else {
        nextMatch = gradientMatch;
        matchType = 'gradient';
      }
    } else if (urlMatch) {
      nextMatch = urlMatch;
      matchType = 'url';
    } else if (gradientMatch) {
      nextMatch = gradientMatch;
      matchType = 'gradient';
    }
    
    if (!nextMatch) {
      break;
    }
    
    const startIndex = nextMatch.index!;
    const functionStart = remaining.indexOf('(', startIndex) + 1;
    
    // 找到匹配的右括号
    let parenCount = 1;
    let endIndex = functionStart;
    
    while (endIndex < remaining.length && parenCount > 0) {
      if (remaining[endIndex] === '(') {
        parenCount++;
      } else if (remaining[endIndex] === ')') {
        parenCount--;
      }
      endIndex++;
    }
    
    if (parenCount === 0) {
      // 提取完整的函数
      const fullFunction = remaining.substring(startIndex, endIndex);
      images.push(fullFunction);
      
      // 移除已处理的部分
      remaining = remaining.substring(endIndex);
    } else {
      // 如果括号不匹配，跳过这个匹配
      remaining = remaining.substring(startIndex + 1);
    }
  }
  
  return images;
}

/**
 * 提取位置和尺寸信息
 */
function extractPositionAndSize(background: string, images: string[]): { position: string; size: string } {
  let cleanBackground = background;
  
  // 移除所有图片和渐变
  images.forEach(image => {
    cleanBackground = cleanBackground.replace(image, '');
  });
  
  // 清理多余的逗号和空格
  cleanBackground = cleanBackground.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
  
  // 匹配位置/尺寸模式 (如: center/cover, top left/contain)
  const positionSizeMatch = cleanBackground.match(/([^\/,]*?)\/([^\/,]*)/);
  
  let position = '';
  let size = '';
  
  if (positionSizeMatch) {
    const positionPart = positionSizeMatch[1]?.trim();
    const sizePart = positionSizeMatch[2]?.trim();
    
    if (positionPart && isValidBackgroundPosition(positionPart)) {
      position = positionPart;
    }
    
    if (sizePart && isValidBackgroundSize(sizePart)) {
      size = sizePart;
    }
  } else {
    // 如果没有找到 / 分隔符，尝试单独匹配位置或尺寸
    const parts = cleanBackground.split(/\s+/).filter(part => part.length > 0);
    
    for (const part of parts) {
      if (!position && isValidBackgroundPosition(part)) {
        position = part;
      } else if (!size && isValidBackgroundSize(part)) {
        size = part;
      }
    }
  }
  
  return { position, size };
}

/**
 * 提取背景颜色
 */
function extractBackgroundColor(background: string, images: string[]): string {
  let cleanBackground = background;
  
  // 移除所有图片和渐变
  images.forEach(image => {
    cleanBackground = cleanBackground.replace(image, '');
  });
  
  // 移除位置和尺寸信息
  cleanBackground = cleanBackground.replace(/\s*(center|top|bottom|left|right|\d+%|\d+px)\s*/g, ' ');
  cleanBackground = cleanBackground.replace(/\s*\/\s*(cover|contain|auto|\d+%|\d+px)\s*/g, ' ');
  cleanBackground = cleanBackground.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();

  // 匹配颜色格式
  const colorRegex = /(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)/;
  const colorMatch = cleanBackground.match(colorRegex);
  
  return colorMatch ? colorMatch[0] : '';
}

/**
 * 检查是否是有效的背景位置值
 */
function isValidBackgroundPosition(value: string): boolean {
  const positionKeywords = ['center', 'top', 'bottom', 'left', 'right'];
  const parts = value.split(/\s+/);
  
  return parts.every(part => 
    positionKeywords.includes(part) || 
    /^\d+%$/.test(part) || 
    /^\d+px$/.test(part) ||
    /^-?\d+(\.\d+)?(px|em|rem|%)$/.test(part)
  );
}

/**
 * 检查是否是有效的背景尺寸值
 */
function isValidBackgroundSize(value: string): boolean {
  const sizeKeywords = ['cover', 'contain', 'auto'];
  
  if (sizeKeywords.includes(value)) {
    return true;
  }
  
  const parts = value.split(/\s+/);
  return parts.every(part => 
    part === 'auto' ||
    /^\d+%$/.test(part) || 
    /^\d+px$/.test(part) ||
    /^-?\d+(\.\d+)?(px|em|rem|%)$/.test(part)
  );
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
 * 将解析出的一条 action 推入列表，若为 addChild 且带 index 则追加对应 move
 */
function pushParsedAction(
  newActions: any[],
  parsedAction: any,
  processedLines: Set<string>,
  trimmedLine: string
) {
  if (!parsedAction.comId) return;
  newActions.push(parsedAction);
  if (parsedAction.type === 'addChild' && parsedAction.params.index !== undefined) {
    newActions.push({
      comId: parsedAction.params.comId,
      target: ':root',
      type: 'move',
      params: {
        to: {
          comId: parsedAction.comId,
          slotId: parsedAction.target,
          index: parsedAction.params.index,
        },
      }
    });
  }
  processedLines.add(trimmedLine);
}

/**
 * 创建actions解析器
 * @param options.enabledActionTags 是否启用 action tags
 * @returns 解析函数 parseActions(text, isEnd?)
 *   - text: 待解析的 actions 文本（可流式追加）
 *   - isEnd: 是否为结束标记；为 true 时最后一行即使没有回车符也会被当作完整行解析
 */
export function createActionsParser({ enabledActionTags }: { enabledActionTags?: boolean }) {
  const processedLines = new Set<string>();
  const comIdToParamsMap = new Map<string, AddChildActionParams>();

  return function parseActions(text: string, isEnd?: boolean) {
    const newActions: any[] = [];
    const lines = text.split("\n").filter(line => line.trim() !== '');

    const linesToProcess = lines.slice(0, -1);
    const lastLine = lines[lines.length - 1];
    const lastLineComplete = lines.length === 0 || text.endsWith("\n") || isEnd === true;

    for (const line of linesToProcess) {
      const trimmedLine = line.trim();
      if (!trimmedLine || processedLines.has(trimmedLine)) continue;
      try {
        const parsedAction = formatAction(trimmedLine, comIdToParamsMap, { enabledActionTags });
        pushParsedAction(newActions, parsedAction, processedLines, trimmedLine);
      } catch {
        processedLines.add(trimmedLine);
      }
    }

    if (lastLine && lastLine.trim() && lastLineComplete && !processedLines.has(lastLine.trim())) {
      const trimmedLastLine = lastLine.trim();
      try {
        const parsedAction = formatAction(trimmedLastLine, comIdToParamsMap, { enabledActionTags });
        pushParsedAction(newActions, parsedAction, processedLines, trimmedLastLine);
      } catch {
        processedLines.add(trimmedLastLine);
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

export function jsonSafeParse(input: string): any {
  let finalError
  try {
    return JSON.parse(input);
  } catch (error) {
    finalError = error
    try {
      const repairedJson = jsonrepair(input);
      return JSON.parse(repairedJson);
    } catch (repairError) {
      // 修复也失败了，抛出错误
      throw finalError
    }
  }
}

/** PC */
type PageInfoSPA = {
  id: string;
  title: string;
  inputs: {id: string; title: string}[];
  outputs: {id: string; title: string}[];
}[]

/** 鸿蒙 */
type PageInfoMPA = {
  pageAry: PageInfoSPA;
}[]

/** 获取pages，兼容spa和mpa */
export const transformPageInfo = (pageInfo: PageInfoSPA | PageInfoMPA) => {
  const pages: PageInfoSPA[number][] = [];
  pageInfo?.forEach((page) => {
    if ("pageAry" in page) {
      pages.push(...page.pageAry);
    } else {
      pages.push(page)
    }
  })
  return pages;
}

const formatVarAction = (
  _action: string,
) => {
  let action;
  try {
    // TODO，后面要提示词处理的，这样replace不合理
    const fixActionString = _action.replaceAll('{":parent/', '{"path":":parent/')
    action = JSON.parse(fixActionString);
  } catch (error) {
    try {
      const repairedAction = jsonrepair(_action)
      action = JSON.parse(repairedAction)
      console.log("[action]", action)
    } catch (error) {
      console.error("repair action error", error);
    }
  }

  if (!Array.isArray(action)) {
    return action;
  }

  return action;
};

export function createVarActionsParser() {
  const processedLines = new Set<string>();

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
        const parsedAction = formatVarAction(trimmedLine);
        newActions.push(parsedAction);
        processedLines.add(trimmedLine);
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
          const parsedAction = formatVarAction(trimmedLastLine);
          newActions.push(parsedAction);
          processedLines.add(trimmedLastLine);
        } catch (error) {
          processedLines.add(trimmedLastLine);
        }
      }
    }

    // processedLines.clear();

    return newActions;
  };
}

const UUID_SEED = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const uuid = (len = 5) => {
	const maxPos = UUID_SEED.length;
	let rtn = '';
	for (let i = 0; i < len; i++) {
		rtn += UUID_SEED.charAt(Math.floor(Math.random() * maxPos));
	}
	return 'u_' + rtn;
}

export class ComIdTransform {
  comIdMap: Record<string, string[]> = {};

  constructor(comIds: string[]) {
    const { comIdMap } = this;
    comIds.forEach((comId) => {
      comIdMap[comId] = [comId];
    })
  }
  
  getComId(comId: string) {
    if (!this.comIdMap[comId] || this.comIdMap[comId].length === 0) {
      const newComId = uuid();
      this.comIdMap[comId] = [newComId];
      return newComId;
    }

    // 返回最近添加的comId（数组的最后一个）
    return this.comIdMap[comId][this.comIdMap[comId].length - 1];
  }

  // 添加新的comId映射，用于addChild操作
  addComId(comId: string): string {
    const newComId = uuid();
    if (!this.comIdMap[comId]) {
      this.comIdMap[comId] = [];
    }
    this.comIdMap[comId].push(newComId);
    return newComId;
  }
}

export class PromiseStack {
  stack: any[] = [];
  currentPromise: any = null;

  add(promiseFn: any) {
    this.stack.push(promiseFn);
    this.run();
  }

  async run() {
    let catchNext = false;
    try {
      if (this.currentPromise) {
        return;
      }
      const promiseFn = this.stack.shift();
      if (promiseFn) {
        const promise = promiseFn();
        if (Object.prototype.toString.call(promise) === "[object Promise]") {
          this.currentPromise = promise;
          catchNext = true;
          await promise;
          this.currentPromise = null;
          this.run();
        } else {
          this.run();
        }
      }
    } catch (e) {
      console.error(e)
      if (catchNext) {
        this.currentPromise = null;
        this.run();
      }
    }
  }
}