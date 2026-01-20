// @ts-nocheck
import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'
import { APIRecordReplayManager } from './../src/api-record-replay';

window.plugin_ai_context = context

// ========== 默认配置变量 ==========
// 可以在这里修改默认值，方便测试时调整
const DEFAULT_TYPE = 'page'; // 'com' 或 'page'
const DEFAULT_COM_ID = 'u_bP96M'; // 默认组件ID
const DEFAULT_PAGE_ID = 'u_vLeVH'; // 默认页面ID
const DEFAULT_TEST_DELAY = 10; // testActions 默认延迟（毫秒）
const DEFAULT_GENERATE_DELAY = 200; // generateActionsFile 默认延迟（毫秒）
// ==================================

const mockActions = `
["u_Z5zWg",":root","delete"]
["u_5kRx4",":root","delete"]
["u_NOklc",":root","delete"]
["u_KSX7z",":root","delete"]
["u_4mxma",":root","delete"]
["u_T9tvz","content","addChild",{"title":"下载图片","comId":"u_img1","ns":"pc.single-image","layout":{"width":20,"height":20,"marginBottom":2},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/20x20/666666/ffffff?text=DL"},{"path":"常规/填充模式","value":"cover"}]}]
["u_RA1Xs","content","addChild",{"title":"消息图片","comId":"u_img2","ns":"pc.single-image","layout":{"width":20,"height":20,"marginBottom":2},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/20x20/666666/ffffff?text=MSG"},{"path":"常规/填充模式","value":"cover"}]}]
["u_AxHmL","content","addChild",{"title":"学堂图片","comId":"u_img3","ns":"pc.single-image","layout":{"width":20,"height":20,"marginBottom":2},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/20x20/666666/ffffff?text=EDU"},{"path":"常规/填充模式","value":"cover"}]}]
["u_XE3CM","content","addChild",{"title":"规则图片","comId":"u_img4","ns":"pc.single-image","layout":{"width":20,"height":20,"marginBottom":2},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/20x20/666666/ffffff?text=RULE"},{"path":"常规/填充模式","value":"cover"}]}]
["u_t5DDQ","content","addChild",{"title":"帮助图片","comId":"u_img5","ns":"pc.single-image","layout":{"width":20,"height":20,"marginBottom":2},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/20x20/666666/ffffff?text=HELP"},{"path":"常规/填充模式","value":"cover"}]}]
["u_img1",":root","move",{"comId":"u_T9tvz","slotId":"content","index":0}]
["u_img2",":root","move",{"comId":"u_RA1Xs","slotId":"content","index":0}]
["u_img3",":root","move",{"comId":"u_AxHmL","slotId":"content","index":0}]
["u_img4",":root","move",{"comId":"u_XE3CM","slotId":"content","index":0}]
["u_img5",":root","move",{"comId":"u_t5DDQ","slotId":"content","index":0}]
`

window.getActions = () => {
  const parser = createActionsParser();

  const actions = parser(mockActions);

  console.log(actions)

  return actions
}

/**
 * 测试执行actions，支持组件和页面两种模式
 * @param type - 'com' 表示组件模式，'page' 表示页面模式
 * @param id - 组件ID或页面ID
 * @param delay - 每个action之间的延迟时间（毫秒），默认200ms
 */
window.testActions = async (
  type = DEFAULT_TYPE,
  id = type === 'com' ? DEFAULT_COM_ID : DEFAULT_PAGE_ID,
  delay = DEFAULT_TEST_DELAY
) => {
  const api = window.plugin_ai_context.api;
  const actionsToExecute = window.getActions();
  
  if (type === 'com') {
    // 组件模式
    const updateApi = api?.uiCom?.api?.updateCom;
    if (!updateApi) {
      console.error('Component API not available');
      return;
    }
    
    // 开始执行
    await updateApi(id, [], 'start');
    
    // 遍历执行每个action
    for (let i = 0; i < actionsToExecute.length; i++) {
      // 添加延迟
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // 执行当前action
      await updateApi(id, [actionsToExecute[i]], 'ing');
    }
    
    // 最后调用空数组，参数为complete
    await new Promise((resolve) => setTimeout(resolve, delay));
    await updateApi(id, [], 'complete');
  } else {
    // 页面模式
    const updateApi = api?.page?.api?.updatePage;
    if (!updateApi) {
      console.error('Page API not available');
      return;
    }
    
    // 开始执行
    await updateApi(id, [], 'start');
    
    // 遍历执行每个action
    for (let i = 0; i < actionsToExecute.length; i++) {
      // 添加延迟
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // 执行当前action
      await updateApi(id, [actionsToExecute[i]], 'ing');
    }
    
    // 最后调用空数组，参数为complete
    await new Promise((resolve) => setTimeout(resolve, delay));
    await updateApi(id, [], 'complete');
  }
};

// Helper function to format a value as JavaScript code with proper indentation
function formatValue(value, indent = 0) {
  const indentStr = '  '.repeat(indent);
  const nextIndentStr = '  '.repeat(indent + 1);
  
  if (value === null) {
    return 'null';
  }
  
  if (value === undefined) {
    return 'undefined';
  }
  
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map(item => {
      const itemStr = formatValue(item, indent + 1);
      // Handle multi-line items
      if (itemStr.includes('\n')) {
        return `${nextIndentStr}${itemStr}`;
      }
      return `${nextIndentStr}${itemStr}`;
    }).join(',\n');
    return `[\n${items}\n${indentStr}]`;
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    const items = keys.map(key => {
      const val = formatValue(value[key], indent + 1);
      // If the value is multi-line, format it properly
      if (val.includes('\n')) {
        return `${nextIndentStr}"${key}": ${val}`;
      }
      return `${nextIndentStr}"${key}": ${val}`;
    }).join(',\n');
    return `{\n${items}\n${indentStr}}`;
  }
  
  return String(value);
}

// Helper function to format a single action object as JavaScript code
function formatAction(action, indent = 1) {
  const indentStr = '  '.repeat(indent);
  const nextIndent = indent + 1;
  const nextIndentStr = '  '.repeat(nextIndent);
  
  const parts = [];
  parts.push(`${indentStr}{`);
  
  if (action.comId !== undefined) {
    parts.push(`${nextIndentStr}"comId": ${JSON.stringify(action.comId)},`);
  }
  
  if (action.type !== undefined) {
    parts.push(`${nextIndentStr}"type": ${JSON.stringify(action.type)},`);
  }
  
  if (action.target !== undefined) {
    parts.push(`${nextIndentStr}"target": ${JSON.stringify(action.target)},`);
  }
  
  if (action.params !== undefined) {
    const paramsStr = formatValue(action.params, nextIndent);
    // Remove trailing comma from params if it's an object/array
    const cleanParams = paramsStr.replace(/,\s*$/, '');
    parts.push(`${nextIndentStr}"params": ${cleanParams}`);
  }
  
  parts.push(`${indentStr}}`);
  
  return parts.join('\n');
}

// Function to format the entire actions array as mockActions variable declaration
function formatActionsArray(actions) {
  if (actions.length === 0) {
    return 'let mockActions = [];';
  }
  
  const formattedActions = actions.map((action, index) => {
    const actionStr = formatAction(action, 1);
    return index < actions.length - 1 ? `${actionStr},` : actionStr;
  }).join('\n');
  
  return `let mockActions = [\n${formattedActions}\n];`;
}

// Main function to generate the complete actions.ts file content
window.generateActionsFile = (pageId, delay = DEFAULT_GENERATE_DELAY) => {
  const actionsToFormat = window.getActions();
  const actionsArrayStr = formatActionsArray(actionsToFormat);
  
  const executeFunctionStr = `async function executeActionsWithDelay(pageId, actions, delay, api) {
// 开始执行
await api.updatePage(pageId, [], "start");

// 遍历执行每个action
for (let i = 0; i < actions.length; i++) {
  // 添加延迟
  await new Promise((resolve) => setTimeout(resolve, delay));

  // 执行当前action
  await api.updatePage(pageId, [actions[i]], "ing");
}

// 最后调用空数组，参数为complete
await new Promise((resolve) => setTimeout(resolve, delay));
await api.updatePage(pageId, [], "complete");
}`;

  const defaultPageId = pageId || `'${DEFAULT_PAGE_ID}'`;
  const executeCallStr = `\nexecuteActionsWithDelay(${defaultPageId}, mockActions, ${delay}, window.plugin_ai_context.api?.page?.api)`;

  const fullContent = `${actionsArrayStr}\n\n${executeFunctionStr}${executeCallStr}\n`;

  console.log('Generated actions.ts content:');
  console.log(fullContent);
  
  return fullContent;
};

// ========== API 收集和回放功能 ==========

// 导出到 window 对象
window.APIRecordReplay = new APIRecordReplayManager();

// [].map(t => {
//   if (t.type === 'updatePage' && t.params[0] === 'u_QIXGy') {
//     t.params[0] = 'u_ail3e'
//     return {
//       ...t,
//       delay: 1000,
//     }
//   }
//   return null
// }).filter(t => t !== null)