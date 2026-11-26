import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const source = await readFile(new URL('../../packages/plugin/src/contributes/understand/diagram-type.ts', import.meta.url), 'utf8')
const { resolveDiagramPrompt } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`)

test('maps the host type to the data and UI view', () => {
  const prompt = resolveDiagramPrompt('根据页面（router=/orders），创建相应图表', 'fields-binding-services')
  assert.match(prompt, /router=\/orders/)
  assert.match(prompt, /界面数据关系图/)
  assert.match(prompt, /影响 UI 的数据字段及其来源/)
  assert.doesNotMatch(prompt, /层级展示/)
})

test('leaves other types and missing prompts unchanged', () => {
  assert.equal(resolveDiagramPrompt('原始请求', 'other'), '原始请求')
  assert.equal(resolveDiagramPrompt('原始请求'), '原始请求')
  assert.equal(resolveDiagramPrompt(undefined, 'fields-binding-services'), undefined)
  assert.equal(resolveDiagramPrompt('  ', 'fields-binding-services'), '  ')
})
