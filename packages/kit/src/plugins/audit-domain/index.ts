import {
  BASH_TOOL_NAME,
  EDIT_TOOL_NAME,
  GREP_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  MULTI_WRITE_TOOL_NAME,
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  type CodeAgentPluginFactory,
  type Tool,
  type ToolResult,
} from '../../../../agent/src';
import workflow from './workflow.md';

export const AUDIT_UNDERSTAND_DOMAIN_TOOL_NAME = 'docs_understand_domain';
export const AUDIT_VALIDATE_DOMAIN_TOOL_NAME = 'docs_validate_domain';

export interface DomainAuditImplementation {
  enable(options: { documentPath: string }): void;
  understandDomain(params: { path?: string; symbol?: string; offset?: number; limit?: number }): Promise<ToolResult>;
  validateDomain(params: { path: string }): Promise<ToolResult>;
}
export interface DomainAuditOptions {
  /** Override the host implementation to provide additional analysis. */
  implementation?: DomainAuditImplementation;
}

/** Opt-in plugin; the host owns analysis and panel rendering. */
export function createDomainAuditPlugin(options: DomainAuditOptions = {}): CodeAgentPluginFactory {
  const factory: CodeAgentPluginFactory = ({ sandbox, configDirName }) => {
    const path = `${configDirName}/domain/domain-map.yaml`;
    const implementation = options.implementation ?? (sandbox as any).domainAudit as DomainAuditImplementation | undefined;
    implementation?.enable({ documentPath: path });
    const required = () => {
      if (!implementation) throw new Error('audit-domain: host did not provide an implementation');
      return implementation;
    };
    const tools: Tool[] = [
      {
        name: AUDIT_UNDERSTAND_DOMAIN_TOOL_NAME, title: '领域代码分析',
        description: '从画布入口逐层查看 Babel 结构：不传 path 获取画布列表；传入画布源码 path 查看声明；同时传 symbol 查看该声明的组件引用和调用候选。',
        parameters: { type: 'object', properties: { path: { type: 'string', description: 'Canvas source file path, or a related JS/TS source file path from a previous result.' }, symbol: { type: 'string', description: 'Declaration name copied from the file analysis result.' }, offset: { type: 'number', description: 'Offset returned by the previous page; omit on the first page.' }, limit: { type: 'number', description: 'Items per page, 1 to 20; default 10.' } } },
        execute(params: { path?: string; symbol?: string; offset?: number; limit?: number }) { return required().understandDomain(params ?? {}); },
      },
      {
        name: AUDIT_VALIDATE_DOMAIN_TOOL_NAME, title: '领域文档校验',
        description: '校验配置的领域文档结构和源码证据，不判断业务语义。',
        parameters: { type: 'object', properties: {} },
        execute() { return required().validateDomain({ path }); },
      },
    ];
    return {
      name: 'audit-domain',
      description: '分析业务领域、模块、页面和流程，生成可追溯的领域视图。',
      agents: [{
        name: 'audit-domain',
        title: '领域模块审计',
        description: '分析业务领域、模块、页面和流程，生成可追溯的领域视图。仅在用户要求领域或业务模块分析时使用。',
        system: workflow.replaceAll('<documentPath>', path),
        allowedTools: [
          READ_TOOL_NAME,
          GREP_TOOL_NAME,
          BASH_TOOL_NAME,
          WRITE_TOOL_NAME,
          EDIT_TOOL_NAME,
          MULTI_WRITE_TOOL_NAME,
          MULTI_EDIT_TOOL_NAME,
          AUDIT_UNDERSTAND_DOMAIN_TOOL_NAME,
          AUDIT_VALIDATE_DOMAIN_TOOL_NAME,
        ],
        tools,
      }],
    };
  };
  return Object.assign(factory, { pluginName: 'audit-domain' });
}
