# audit-domain

Opt in through the PluginAI `plugins` option:

```ts
import { createDomainAuditPlugin } from '@mybricks/agent-kit'

plugins: [createDomainAuditPlugin()]
```

The document path is fixed to `<configDirName>/domain/domain-map.yaml`, using PluginAI's `configDirName` option. The non-iframe Comlib sandbox supplies `DomainAuditImplementation`, including the Babel analysis and panel registration. Without the plugin no domain panel or subagent is registered. The two domain tools are available only to the domain audit subagent. Like other plugin factories, it initializes on the first agent request; the panel appears after that initialization. Other hosts can pass an `implementation` to the factory; `enable` receives the resolved document path and the two tool methods receive their typed parameters. The implementation may replace or extend analysis without changing the plugin's tool contracts.

The built-in implementation starts with canvas entries; `path` inspects a file's declarations and `path` with `symbol` inspects that declaration's JSX references and call candidates via Babel. Use `offset` and `limit` to page through each result. It reports static clues only; the agent must read source and documentation to determine business meaning. Validation checks document structure and references, not business correctness. Unsupported languages and files outside the sandbox require separate inspection.
