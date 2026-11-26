/** Map host diagram types to the visual explanation skill's named view. */
export function resolveDiagramPrompt(prompt?: string, diagramType?: string): string | undefined {
  if (!prompt?.trim()) return prompt
  if (diagramType !== 'fields-binding-services') return prompt
  return `${prompt}\n\n请使用界面数据关系图，展示影响 UI 的数据字段及其来源。`
}
