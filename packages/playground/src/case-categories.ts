import type { TestCase } from './cases/types';

/** Existing case groups remain the smaller sections within each category. */
export const LOCAL_CATEGORIES = [
  { id: 'command', label: '命令行执行', groups: ['Bash 文件操作'] },
  { id: 'errors', label: '异常处理', groups: ['网络中断', '异常检测', 'Doom Loop', 'init-project'] },
  { id: 'tools', label: '工具与文件', groups: ['工具调用', '工具回归', 'Grep搜索', 'WebFetch', '文件上传'] },
  { id: 'agent', label: 'Agent 与模型', groups: ['多轮 ReAct', 'Compact', 'Summary', '消息遮蔽', 'Skill 技能', 'Prompt Template', '计划模式', '实验性'] },
  { id: 'ui', label: '界面与交互', groups: ['UI 渲染', 'UI / 用户消息折叠', '特殊皮肤', 'Mention', '历史加载', '队列', '任务与输入区', '设置', '性能'] },
  { id: 'other', label: '其他', groups: [] },
] as const;

export function caseCategory(testCase: Pick<TestCase, 'group'>): string {
  return LOCAL_CATEGORIES.find(category => (category.groups as readonly string[]).includes(testCase.group))?.id ?? 'other';
}
