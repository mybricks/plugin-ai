/**
 * Workspace 测试文件
 * 使用真实的 context API，测试函数注入到 window 供浏览器控制台使用
 */

import { Workspace } from './workspace';
import { context } from '../../context';

// 测试函数
async function runWorkspaceTests() {
  console.log('='.repeat(60));
  console.log('开始测试 Workspace');
  console.log('='.repeat(60));
  
  try {
    // 检查 context 是否有必要的 API
    if (!context.api) {
      throw new Error('context.api 未初始化，请确保在设计器环境中运行此测试');
    }

    // 1. 创建 Workspace
    console.log('\n[测试 1] 创建 Workspace');
    const workspace = new Workspace({
      name: '测试工作空间',
      description: '这是一个测试工作空间'
    });
    console.log('[SUCCESS] Workspace 创建成功');

    // 2. 获取目录树
    console.log('\n[测试 2] 获取目录树');
    const tree = await workspace.getDirectoryTree({ showDescription: true });
    console.log('目录树：\n', tree);

    // 3. 检查默认打开的文件
    console.log('\n[测试 3] 检查默认打开的文件');
    const defaultFiles = workspace.getOpenedFilePaths();
    console.log('默认打开的文件：', defaultFiles);
    if (defaultFiles.includes('项目信息.md') && defaultFiles.includes('聚焦信息.md')) {
      console.log('[SUCCESS] 项目信息和聚焦信息已默认打开');
    } else {
      console.log('[WARN] 默认文件未完全打开');
    }

    // 4. 测试打开组件文档（如果有组件的话）
    console.log('\n[测试 4] 测试打开组件文档');
    try {
      // 尝试打开一个常见的组件文档
      await workspace.openComponentDoc('组件配置文档/mybricks.normal-pc.antd5.icon.md');
      console.log('[SUCCESS] 组件文档已打开');
    } catch (error) {
      console.log('[INFO] 无法打开组件文档（可能组件不存在）:', (error as Error).message);
    }

    // 5. 测试动态文档功能
    console.log('\n[测试 5] 测试动态文档功能');
    
    // 注册一个自定义动态文档目录
    workspace.registerDynamicDirectory({
      id: 'custom-docs',
      name: '自定义文档',
      description: '用户自定义的文档',
      weight: 50,
      hidden: false // 不隐藏，在目录树中显示
    });
    
    // 添加动态文档到自定义目录
    await workspace.openDocument('doc1', {
      type: '组件',
      content: '这是第一个动态文档的内容\n包含一些测试数据',
      title: '动态文档1',
      description: '这是一个测试用的动态文档',
      directoryId: 'custom-docs'
    });
    
    // 添加另一个动态文档到默认目录
    await workspace.openDocument('doc2', {
      type: '画布',
      content: '这是第二个动态文档的内容',
      title: '动态文档2',
      description: '使用默认动态文档目录'
    });
    
    console.log('[SUCCESS] 动态文档已添加');

    // 6. 获取已打开的文件列表
    console.log('\n[测试 6] 获取已打开的文件列表');
    const openedFiles = workspace.getOpenedFilePaths();
    console.log('已打开的文件：', openedFiles);

    // 7. 再次获取目录树（应该包含自定义文档目录）
    console.log('\n[测试 7] 获取包含动态文档目录的目录树');
    const treeWithDynamic = await workspace.getDirectoryTree({ showDescription: true });
    console.log('目录树（包含动态文档）：\n', treeWithDynamic);

    // 8. 导出工作空间内容
    console.log('\n[测试 8] 导出工作空间内容');
    const exportedContent = await workspace.export({ includeTree: true });
    console.log('导出的内容长度：', exportedContent.length);
    console.log('导出的内容（前500字符）：\n', exportedContent.substring(0, 500));

    console.log('\n' + '='.repeat(60));
    console.log('[SUCCESS] 所有测试通过！');
    console.log('='.repeat(60));

    return workspace;

  } catch (error) {
    console.error('\n[ERROR] 测试失败：', error);
    console.error('错误堆栈：', (error as Error).stack);
    throw error;
  }
}

// 快捷测试函数
async function quickTest() {
  const workspace = new Workspace({
    name: '快速测试工作空间'
  });
  
  console.log('[INIT] 快速测试工作空间已创建');
  console.log('使用方法：');
  console.log('  - workspace.getDirectoryTree() - 获取目录树');
  console.log('  - workspace.openComponentDoc(path) - 打开组件文档');
  console.log('  - workspace.openComponentDocByNamespace(namespace) - 根据 namespace 打开组件文档');
  console.log('  - workspace.openDocument(id, options) - 打开动态文档');
  console.log('  - workspace.registerDynamicDirectory(config) - 注册动态文档目录');
  console.log('  - workspace.export() - 导出工作空间内容');
  console.log('  - workspace.refresh() - 刷新工作空间');

  try {
    // 先看看目录树
    console.log('\n[步骤1] 获取目录树');
    const tree = await workspace.getDirectoryTree({ showDescription: true });
    console.log(tree);
    
    console.log('\n[步骤2] 检查默认打开的文件');
    const openedFiles = workspace.getOpenedFilePaths();
    console.log('已打开的文件列表：', openedFiles);
    console.log('项目信息和聚焦信息应该已默认打开');
    
    console.log('\n[步骤3] 开始导出...');
    const result = await workspace.export();
    console.log('导出完成！');
    console.log('导出内容长度：', result.length);
    console.log('\n导出内容（前500字符）：\n', result.substring(0, 500));
    return workspace;
  } catch (error) {
    console.error('[ERROR] 测试失败：', error);
    console.error('错误堆栈：', (error as Error).stack);
    throw error;
  }
}

// 动态文档功能演示
async function testDynamicDocs() {
  console.log('='.repeat(60));
  console.log('测试动态文档功能');
  console.log('='.repeat(60));
  
  const workspace = new Workspace({
    name: '动态文档测试工作空间'
  });

  // 1. 注册多个动态文档目录
  console.log('\n[步骤1] 注册多个动态文档目录');
  
  workspace.registerDynamicDirectory({
    id: 'opened-pages',
    name: '已打开的页面',
    description: '用户打开的页面文档',
    weight: 80,
    hidden: false
  });

  workspace.registerDynamicDirectory({
    id: 'opened-components',
    name: '已打开的组件',
    description: '用户打开的组件文档',
    weight: 70,
    hidden: false
  });

  console.log('[SUCCESS] 已注册 2 个动态文档目录');

  // 2. 添加文档到不同的目录
  console.log('\n[步骤2] 添加文档到不同的目录');
  
  await workspace.openDocument('page_u_abc123', {
    type: '画布',
    content: '<页面1[id=u_abc123]>\n  <容器[id=u_def456]>\n    <按钮[id=u_ghi789]>',
    title: '页面1',
    description: '这是第一个页面',
    directoryId: 'opened-pages'
  });

  await workspace.openDocument('component_u_xyz999', {
    type: '组件',
    content: '<按钮组件[id=u_xyz999]>\n  属性: { text: "点击我" }',
    title: '按钮组件',
    description: '一个普通按钮',
    directoryId: 'opened-components'
  });

  console.log('[SUCCESS] 已添加文档到不同目录');

  // 3. 查看目录树
  console.log('\n[步骤3] 查看目录树');
  const tree = await workspace.getDirectoryTree({ showDescription: true });
  console.log(tree);

  // 4. 导出内容
  console.log('\n[步骤4] 导出内容');
  const exported = await workspace.export({ includeTree: true });
  console.log('导出内容长度：', exported.length);
  console.log('\n完整导出内容：\n', exported);

  console.log('\n' + '='.repeat(60));
  console.log('[SUCCESS] 动态文档功能测试完成！');
  console.log('='.repeat(60));

  return workspace;
}

// 注入到 window 对象供浏览器控制台使用
if (typeof window !== 'undefined') {
  (window as any).workspaceTest = {
    runTests: runWorkspaceTests,
    quickTest,
    testDynamicDocs,
    Workspace,
    context
  };
  
  console.log('[READY] 测试函数已注入到 window.workspaceTest');
  console.log('使用方法：');
  console.log('  - window.workspaceTest.runTests() - 运行完整测试');
  console.log('  - window.workspaceTest.quickTest() - 快速创建测试实例');
  console.log('  - window.workspaceTest.testDynamicDocs() - 测试动态文档功能');
  console.log('  - window.workspaceTest.context - 查看 context 对象');
}
