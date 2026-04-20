import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * multi_edit 批量编辑测试场景。
 * CodeAgent 内置 multi_edit 工具，可对同一文件进行多次编辑操作。
 * 此场景模拟 LLM 调用 multi_edit 对 HomePage 组件进行样式和结构修改。
 */

// 预设的初始文件
const initialFiles = [
  {
    path: "pages/HomePage/index.jsx",
    content: `import React from 'react';
import { Button, Dropdown, Menu } from 'antd';
import styles from './index.less';

export default function HomePage() {
  const moreBatchMenu = (
    <Menu>
      <Menu.Item key="1">批量操作一</Menu.Item>
      <Menu.Item key="2">批量操作二</Menu.Item>
    </Menu>
  );

  const moreActionMenu = (
    <Menu>
      <Menu.Item key="1">更多操作一</Menu.Item>
      <Menu.Item key="2">更多操作二</Menu.Item>
    </Menu>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>首页</h1>
      </div>
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <Dropdown
            className={styles.moreBatchDropdown}
            overlay={moreBatchMenu}
            getContainer={() => document.body}
            overlayStyle={{color:'red'}}
          >
            <Button>
              更多批量操作 <span className={styles.arrowIcon}>&#8964;</span>
            </Button>
          </Dropdown>
          <Dropdown
            className={styles.moreActionDropdown}
            overlay={moreActionMenu}
            getContainer={() => document.body}
          >
            <Button>
              更多操作 <span className={styles.arrowIcon}>&#8964;</span>
            </Button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    path: "pages/HomePage/index.less",
    content: `.container {
  padding: 16px;
}

.header {
  margin-bottom: 24px;
}

.content {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.toolbar {
  display: flex;
  gap: 8px;
}

.dropdown {
  background-color:black;
}`,
  },
];

export const multiEditSameFileCase: TestCase = {
  id: "multi-edit-same-file",
  name: "multi_edit 同文件多编辑",
  group: "工具调用",
  description: "LLM 调用 multi_edit 对同一个文件进行多次编辑，包括样式变量提取、箭头图标替换和删除无用样式",
  expectedBehavior: "工具卡片显示成功，FS Viewer 中文件内容已更新，多次编辑按顺序应用。多次发消息循环触发。",
  initialFiles,
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [
        {
          id: "toolu_bdrk_018YhrEhGQWnXcTUMseoW4bo",
          name: "multi_edit",
          args: {
            edits: [
              {
                path: "pages/HomePage/index.jsx",
                old_str: "  const moreBatchMenu = (\n    <Menu>\n      <Menu.Item key=\"1\">批量操作一</Menu.Item>\n      <Menu.Item key=\"2\">批量操作二</Menu.Item>\n    </Menu>\n  );\n\n  const moreActionMenu = (\n    <Menu>\n      <Menu.Item key=\"1\">更多操作一</Menu.Item>\n      <Menu.Item key=\"2\">更多操作二</Menu.Item>\n    </Menu>\n  );",
                new_str: "  const menuStyle = { padding: '4px 0', background: '#FFFFFF', borderRadius: '4px', boxShadow: '0 3px 6px -4px rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.08), 0 9px 28px 8px rgba(0,0,0,0.05)' };\n  const menuItemStyle = { height: '32px', lineHeight: '22px', padding: '5px 12px', fontSize: '14px', color: '#434343' };\n\n  const moreBatchMenu = (\n    <Menu style={menuStyle}>\n      <Menu.Item key=\"1\" style={menuItemStyle}>批量操作一</Menu.Item>\n      <Menu.Item key=\"2\" style={menuItemStyle}>批量操作二</Menu.Item>\n    </Menu>\n  );\n\n  const moreActionMenu = (\n    <Menu style={menuStyle}>\n      <Menu.Item key=\"1\" style={menuItemStyle}>更多操作一</Menu.Item>\n      <Menu.Item key=\"2\" style={menuItemStyle}>更多操作二</Menu.Item>\n    </Menu>\n  );",
              },
              {
                path: "pages/HomePage/index.jsx",
                old_str: "          <Dropdown\n            className={styles.moreBatchDropdown}\n            overlay={moreBatchMenu}\n            getContainer={() => document.body}\n            overlayStyle={{color:'red'}}\n          >\n            <Button>\n              更多批量操作 <span className={styles.arrowIcon}>&#8964;</span>\n            </Button>\n          </Dropdown>",
                new_str: "          <Dropdown\n            className={styles.moreBatchDropdown}\n            overlay={moreBatchMenu}\n            getContainer={() => document.body}\n          >\n            <Button>\n              更多批量操作 <svg className={styles.arrowSvg} width=\"11\" height=\"7\" viewBox=\"0 0 11 7\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path fillRule=\"evenodd\" clipRule=\"evenodd\" d=\"M0.227806 0.227806C0.511298 -0.0556859 0.959186 -0.0745853 1.2646 0.171108L1.32775 0.227806L5.44406 4.34428L9.56114 0.227806C9.84463 -0.0556859 10.2925 -0.0745853 10.5979 0.171108L10.6611 0.227806C10.9446 0.511298 10.9635 0.959186 10.7178 1.2646L10.6611 1.32775L5.99442 5.99442C5.71093 6.27791 5.26304 6.29681 4.95763 6.05112L4.89447 5.99442L0.227806 1.32775C-0.0759353 1.02401 -0.0759353 0.531547 0.227806 0.227806Z\" fill=\"#8C8C8C\"/></svg>\n            </Button>\n          </Dropdown>",
              },
              {
                path: "pages/HomePage/index.jsx",
                old_str: "          <Dropdown\n            className={styles.moreActionDropdown}\n            overlay={moreActionMenu}\n            getContainer={() => document.body}\n          >\n            <Button>\n              更多操作 <span className={styles.arrowIcon}>&#8964;</span>\n            </Button>\n          </Dropdown>",
                new_str: "          <Dropdown\n            className={styles.moreActionDropdown}\n            overlay={moreActionMenu}\n            getContainer={() => document.body}\n          >\n            <Button>\n              更多操作 <svg className={styles.arrowSvg} width=\"11\" height=\"7\" viewBox=\"0 0 11 7\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path fillRule=\"evenodd\" clipRule=\"evenodd\" d=\"M0.227806 0.227806C0.511298 -0.0556859 0.959186 -0.0745853 1.2646 0.171108L1.32775 0.227806L5.44406 4.34428L9.56114 0.227806C9.84463 -0.0556859 10.2925 -0.0745853 10.5979 0.171108L10.6611 0.227806C10.9446 0.511298 10.9635 0.959186 10.7178 1.2646L10.6611 1.32775L5.99442 5.99442C5.71093 6.27791 5.26304 6.29681 4.95763 6.05112L4.89447 5.99442L0.227806 1.32775C-0.0759353 1.02401 -0.0759353 0.531547 0.227806 0.227806Z\" fill=\"#8C8C8C\"/></svg>\n            </Button>\n          </Dropdown>",
              },
              {
                path: "pages/HomePage/index.less",
                old_str: ".dropdown {\n  background-color:black;\n}",
                new_str: "",
              },
            ],
          },
        },
      ],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "已完成对 HomePage 组件的样式优化：",
        "\n\n1. 提取了 menuStyle 和 menuItemStyle 变量，统一菜单样式",
        "\n2. 将箭头图标从 HTML 实体改为 SVG，保证跨平台一致性",
        "\n3. 移除了无用的 .dropdown 样式",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};
