import { connectors } from "./registry";

export function buildConnectorPrompt(): string {
  if (!connectors.length) return "";

  const connectorSections = connectors.map((connector) => {
    const interfaceLines = connector.interfaces.map((iface) => [
      `  - 接口ID: ${iface.id}`,
      `    名称: ${iface.name}`,
      `    描述: ${iface.description}`,
      `    方法: ${iface.method}`,
      `    路径: ${iface.path}`,
      `    参数: ${iface.parameters.length ? iface.parameters.map((p) => `${p.name}(${p.type}${p.required ? ", 必填" : ", 可选"}) - ${p.description}`).join("; ") : "无"}`,
      `    返回示例: ${JSON.stringify(iface.responseExample)}`,
    ].join("\n"));

    return [
      `- 连接器ID: ${connector.id}`,
      `  名称: ${connector.name}`,
      `  描述: ${connector.description}`,
      `  基础URL: ${connector.baseUrl}`,
      `  接口:`,
      ...interfaceLines.map((line) => `  ${line}`),
    ].join("\n");
  });

  return [
    "# 可用连接器",
    "生成页面时，如果用户需求可以由以下连接器接口满足，必须复用这些已有接口，禁止重新生成功能重复的接口。",
    "连接器接口只能用于读取数据（只读），禁止用于提交、修改、删除数据。",
    "",
    connectorSections.join("\n\n"),
    "",
    "<使用规则>",
    "1. 先判断用户需求中哪些数据可以由连接器提供。",
    "2. 如果连接器可以满足，在生成页面时直接通过连接器调用获取数据，不要生成新的数据源或接口。",
    "3. 生成组件配置时，使用连接器返回示例中的字段名作为数据绑定参考。",
    "4. 调用方式：在页面运行时通过 connectorRuntime.call(connectorId, interfaceId, params) 获取数据。",
    "5. 当前只读场景下，禁止生成任何写操作（POST 提交表单、删除、更新等）。",
    "</使用规则>",
  ].join("\n");
}
