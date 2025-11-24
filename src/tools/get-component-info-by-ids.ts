import { fileFormat } from '@mybricks/rxai'
import { getFiles } from './utils'

interface GetComponentInfoParams {
  getComInfo: (namespace: string) => string
  getComJson: (id: string) => string
  getPageJson: (id: string) => string
}

export default function getComponentsInfoByIds(config: GetComponentInfoParams, ): any {
  return {
    name: 'get-components-info-by-id',
    displayName: "获取组件配置文档",
    description: `通过现有的元素ID（组件或页面）获取「当前元素及其所有子组件」的DSL（包含父子结构信息和当前搭建信息）和涉及的组件配置文档。
参数：元素ID；
作用：获取组件的配置文档和当前元素DSL（包含父子结构信息和当前搭建信息），用于后续修改组件；
返回值：相关组件的配置文档和当前元素DSL；
`,
    getPrompts: () => {
        return `<工具总览>
你是一个可以获取组件配置文档和搭建信息工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，可以选中组件的ID，返回组件的各类上下文。
</工具总览>
 
<任务流程>
  按照以下格式返回所要获取上下文的所有组件：
    ${fileFormat({ content: '{ "id": "u_23ver", "type": "com" }', fileName: '需要获取上下文的组件ID.json' })}
    - type为 *page* 或 *com* ；
    - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；
</任务流程>`
      },
    lastAppendMessage: '已提供组件文档和搭建配置，请继续。',
    execute({ files, content }) {
      const selectFile = getFiles(files, { extName: 'json' });
      let selectId,selectType
      try {
        selectId = JSON.parse(selectFile?.content)?.id;
        selectType = JSON.parse(selectFile?.content)?.type;
      } catch (error) {}

      if (!selectId) {
        return '没有选择的组件ID'
      }

      const { jsx, namespaces } = getComponentsInfoByJson(selectType === 'page' ? config.getPageJson(selectId) : config.getComJson(selectId))

      const docs = namespaces.reduce((acc, cur) => {
        return acc + '\n' + config.getComInfo(cur)
      }, '')

      return `<元素${selectId}的DSL>
${jsx}
</元素${selectId}的DSL>

<关联的所有组件配置文档>
${docs}
</关联的所有组件配置文档>`
    },
  }
}


interface GetComponentsResult {
  jsx: string;
  namespaces: string[];
}

function getComponentsInfoByJson(data: any): GetComponentsResult {
  const namespacesSet = new Set<string>(); // 使用Set去重
  
  // 生成插槽JSX
  function generateSlotsJSX(slots: any[], indent = '  ') {
    if (!slots || slots.length === 0) return '';
    
    let slotsJSX = '';
    slots.forEach(slot => {
      if (slot.id) {
        slotsJSX += `\n${indent}<slots.${slot.id}>`;
        
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
    let jsx = `<${namespace} id="${node.id}" data={${dataStr}}`;
    
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