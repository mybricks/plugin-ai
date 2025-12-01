import { fileFormat, ToolError } from '@mybricks/rxai'
import { getFiles } from './utils'

interface GetComponentInfoParams {
  id: string
  getComInfo: (namespace: string) => string
  getComJson: (id: string) => string
  getPageJson: (id: string) => string
  getFocusElementHasChildren: () => boolean
}

export default function getComponentsInfoByIds(config: GetComponentInfoParams,): any {
  const hasChildren = config.getFocusElementHasChildren() !== false
  return {
    name: 'get-dsl-and-component-docs-by-id',
    displayName: "获取组件配置文档",
    description: `通过现有的元素ID（组件或页面）获取「当前元素及其所有子组件」的DSL（包含父子结构信息和当前搭建信息）和涉及的组件配置文档。
参数：元素ID；
作用：获取组件的配置文档和当前元素DSL（包含父子结构信息和当前搭建信息，比如布局、样式、组件配置等信息），用于后续修改组件；
返回值：相关组件的配置文档和当前元素DSL；

可缓存：如果后续修改组件需要使用配置文档，注意查看之前的消息是否有组件的配置文档。
；
`,
    getPrompts: () => {
      return !hasChildren ? '' :
        `<工具总览>
你是一个可以获取组件配置文档和搭建信息工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，可以选中元素的ID，返回元素的各类上下文。
</工具总览>
 
<任务流程>
  根据用户需求，确定要获取上下文的元素ID，对于这个ID的选择
  - 1. 用户明确提及了需要指定的组件，则选择指定元素；
  - 2. 用户未明确提及指定的组件，而是泛指一类组件，则选择这一类组件上层的元素，确保覆盖了这一类的所有组件；
  - 3. 用户未明确提及指定的组件，也没泛指，则选择聚焦的元素；

  按照以下格式返回所要获取上下文的元素：
    ${fileFormat({ content: '{ "id": "u_23ver", "type": "com" }', fileName: '需要获取上下文的组件ID.json' })}
    - type为 *page* 或 *com* ；
    - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；
</任务流程>`
    },
    lastAppendMessage: '已提供组件文档和搭建配置，请继续。',
    execute(params: any) {
      const { files, content } = params ?? {}
      if (hasChildren) {
        if (!content) {
          throw new ToolError({
            llmContent: '拿不到有效的文件内容，请检查返回的文件格式',
            displayContent: '获取组件文档失败，请重试'
          })
        }
      }

      const selectFile = hasChildren ? getFiles(files, { extName: 'json' }) : { content: JSON.stringify({ id: config.id, type: 'com' }) };
      let selectId, selectType
      try {
        selectId = JSON.parse(selectFile?.content)?.id;
        selectType = JSON.parse(selectFile?.content)?.type;
      } catch (error) {
        throw new ToolError({
          llmContent: `解析错误，请检查格式，${error?.message}`,
          displayContent: '解析组件文档失败，请重试'
        })
      }
      if (!selectId) {
        throw new ToolError({
          llmContent: '拿不到有效的元素ID，请检查返回的文件和需求是否能获取到要操作的ID',
          displayContent: '获取不到操作目标，请重试'
        })
      }

      const { jsx, namespaces } = getComponentsInfoByJson(selectType === 'page' ? config.getPageJson(selectId) : config.getComJson(selectId))

      const docs = namespaces.reduce((acc, cur) => {
        try {
          const comDoc = config.getComInfo(cur)
          return acc + '\n' + comDoc
        } catch (error) {
          console.warn(`获取组件${JSON.stringify(cur)}的文档失败`)
        }
        return acc
      }, '')

      return {
        llmContent: `<元素${selectId}的DSL>
${jsx}
</元素${selectId}的DSL>

<关联的所有组件配置文档>
${docs}
</关联的所有组件配置文档>`,
        displayContent: `已获取搭建信息和关联组件文档`
      }
    },
  }
}

interface GetComponentsResult {
  jsx: string;
  namespaces: string[];
}

function getComponentsInfoByJson(data: any): GetComponentsResult {
  const namespacesSet = new Set<string>(); // 使用Set去重

  // 提取layout信息
  function extractLayout(style: any) {
    if (!style) return {};

    const layout: any = {};
    if (style.width !== undefined) layout.width = style.width;
    if (style.height !== undefined) layout.height = style.height;
    if (style.margin !== undefined) layout.margin = style.margin;
    if (style.marginLeft !== undefined) layout.marginLeft = style.marginLeft;
    if (style.marginRight !== undefined) layout.marginRight = style.marginRight;
    if (style.marginTop !== undefined) layout.marginTop = style.marginTop;
    if (style.marginBottom !== undefined) layout.marginBottom = style.marginBottom;
    if (style.layout !== undefined) {
      if (style.layout === 'flex-column' || style.layout === 'flex') {
        layout.display = 'flex';
        layout.flexDirection = 'column';
      }
      if (style.layout === 'flex-row') {
        layout.display = 'flex';
        layout.flexDirection = 'row';
      }
      if (style.alignItems) layout.alignItems = style.alignItems;
      if (style.justifyContent) layout.justifyContent = style.justifyContent;
    }

    return layout;
  }

  // 提取并格式化CSS样式
  function extractStyleAry(style: any) {
    if (!style || !style.css || !Array.isArray(style.css)) return [];

    return style.css.map((cssItem: any) => {
      const selector = cssItem.selector || '';
      const cssProps = cssItem.css || {};

      // 将CSS属性对象转换为字符串格式
      const cssString = Object.entries(cssProps)
        .map(([key, value]) => `${key}: '${value}'`)
        .join(', ');

      return `${selector} : { ${cssString} }`;
    });
  }

  // 生成插槽JSX
  function generateSlotsJSX(slots: any[], indent = '  ') {
    if (!slots || slots.length === 0) return '';

    let slotsJSX = '';
    slots.forEach(slot => {
      if (slot.id) {
        slotsJSX += `\n${indent}<slots.${slot.id}`;

        if (slot.title) {
          slotsJSX += ` title="${slot.title}"`;
        }

        if (slot.layout) {
          slotsJSX += ` layout={${JSON.stringify(extractLayout(slot.layout))}}`;
        }

        slotsJSX += ' >'

        // 如果插槽有组件，递归处理
        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            const childJSX = generateComponentJSX(component, indent + '    ');
            if (childJSX) {
              slotsJSX += `\n${indent}  ${childJSX}`;
            }
          });
        }

        slotsJSX += `\n${indent}</slots.${slot.id}>`;
      }
    });

    return slotsJSX;
  }

  // 生成单个组件的JSX
  function generateComponentJSX(node: any, indent = '') {
    if (!node || !node.id) return '';

    const namespace = node.def?.namespace || 'content';
    namespacesSet.add(namespace); // 添加到namespace集合

    const dataStr = JSON.stringify(node.data || {});
    const layout = extractLayout(node.style);
    const styleAry = extractStyleAry(node.style);

    let jsx = `<${namespace} id="${node.id}" data={${dataStr}}`;

    // 添加layout字段
    if (Object.keys(layout).length > 0) {
      jsx += ` layout={${JSON.stringify(layout)}}`;
    }

    // 添加styleAry字段
    if (styleAry.length > 0) {
      jsx += ` styleAry={[${styleAry.map(style => `"${style}"`).join(', ')}]}`;
    }

    // 处理插槽
    const slotsJSX = generateSlotsJSX(node.slots || [], indent + '  ');
    if (slotsJSX) {
      jsx += slotsJSX;
      jsx += `\n${indent}</${namespace}>`;
    } else {
      jsx += ` />`;
    }

    return jsx;
  }

  // 递归处理数据
  function processData(node: any) {
    if (!node) return '';

    // 如果是数组，遍历每个元素
    if (Array.isArray(node)) {
      let result = '';
      node.forEach((item, index) => {
        const jsx = processData(item);
        if (jsx) {
          result += jsx;
          if (index < node.length - 1) {
            result += '\n';
          }
        }
      });
      return result;
    }

    // 如果是组件节点
    if (node.id) {
      return generateComponentJSX(node);
    }

    // 处理slots中的组件
    if (node.slots && Array.isArray(node.slots)) {
      let result = '';
      node.slots.forEach(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          const slotResult = processData(slot.components);
          if (slotResult) {
            result += slotResult;
          }
        }
      });
      return result;
    }

    return '';
  }

  // 开始处理
  const jsx = processData(data);

  return {
    jsx,
    namespaces: Array.from(namespacesSet) // 转换为数组并去重
  };
}