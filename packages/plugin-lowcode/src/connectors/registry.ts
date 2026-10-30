import type { Connector } from "./types";

export const connectors: Connector[] = [
  {
    id: "oa-connector",
    name: "OA 办公平台",
    description: "企业 OA 系统，提供待办、已办、审批、组织架构等只读接口。",
    baseUrl: "https://oa.example.com/api",
    interfaces: [
      {
        id: "todo-list",
        name: "查询待办列表",
        description: "查询当前用户的待办事项列表，适用于首页待办卡片、待办看板等场景。",
        method: "GET",
        path: "/todo/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "pageNum", type: "number", description: "页码，从 1 开始", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "1", title: "请假审批", applicant: "张三", status: "pending", createTime: "2026-10-30T10:00:00Z" },
            ],
            total: 1,
          },
        },
      },
      {
        id: "done-list",
        name: "查询已办列表",
        description: "查询当前用户已处理的事项列表。",
        method: "GET",
        path: "/done/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "pageNum", type: "number", description: "页码，从 1 开始", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "2", title: "报销审批", applicant: "李四", status: "approved", finishTime: "2026-10-29T12:00:00Z" },
            ],
            total: 1,
          },
        },
      },
      {
        id: "leave-approval-list",
        name: "查询请假审批列表",
        description: "查询请假审批记录，适用于请假管理、审批看板等场景。",
        method: "GET",
        path: "/leave/approval/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "status", type: "string", description: "审批状态：pending/approved/rejected，不传表示全部", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "3", applicant: "王五", type: "annual", startDate: "2026-11-01", endDate: "2026-11-03", status: "pending" },
            ],
            total: 1,
          },
        },
      },
    ],
  },
];

export function findConnectorById(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export function findConnectorInterface(connectorId: string, interfaceId: string) {
  return findConnectorById(connectorId)?.interfaces.find((i) => i.id === interfaceId);
}
