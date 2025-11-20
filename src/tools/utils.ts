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


export const MyBricksHelper = {
  getTreeDescriptionByJson,
}