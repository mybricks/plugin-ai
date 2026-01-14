[
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
          [],
          "start"
      ],
      "delay": 1000,
      "timestamp": 1768288341487
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
          [
              {
                  "comId": "_root_",
                  "type": "setLayout",
                  "target": ":root",
                  "params": {
                      "height": 1400
                  }
              },
              {
                  "comId": "_root_",
                  "type": "doConfig",
                  "target": ":root",
                  "params": {
                      "path": "页面/顶部栏/导航栏类型",
                      "value": "none"
                  }
              },
              {
                  "comId": "_root_",
                  "type": "doConfig",
                  "target": ":root",
                  "params": {
                      "path": "页面/内容区/布局",
                      "value": {
                          "display": "flex",
                          "flexDirection": "column",
                          "alignItems": "center"
                      }
                  }
              },
              {
                  "comId": "_root_",
                  "type": "doConfig",
                  "target": ":root",
                  "params": {
                      "path": "页面/内容区/底部留白",
                      "value": "0"
                  }
              },
              {
                  "comId": "_root_",
                  "type": "doConfig",
                  "target": ":root",
                  "params": {
                      "path": "样式/内容区/背景",
                      "style": {
                          "backgroundColor": "#F5F7FA",
                          "backgroundImage": "none"
                      }
                  }
              },
              {
                  "comId": "_root_",
                  "type": "addChild",
                  "target": "_rootSlot_",
                  "params": {
                      "title": "顶部固定区域",
                      "comId": "u_rzG41",
                      "layout": {
                          "position": "fixed",
                          "width": "100%",
                          "height": 190,
                          "top": 0,
                          "left": 0
                      },
                      "configs": [
                        {
                            "path": "容器/基础属性/布局",
                            "value": {
                                "display": "flex",
                                "flexDirection": "column",
                                "alignItems": "center"
                            }
                        },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "boxShadow": "0 2px 4px rgba(0,0,0,0.08)",
                                  "backgroundColor": "#FFFFFF",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_rzG41",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "搜索摘要栏",
                      "comId": "u_j9Gbb",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": 56
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "space-between",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_j9Gbb",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "返回图标",
                      "comId": "u_dLcNr",
                      "layout": {
                          "width": 20,
                          "height": 20,
                          "marginLeft": 16
                      },
                      "configs": [
                          {
                              "path": "图标/基础属性/图标",
                              "value": "arrow_left"
                          },
                          {
                              "path": "图标/基础属性/大小",
                              "value": 20
                          },
                          {
                              "path": "图标/高级属性/颜色",
                              "value": "#333333"
                          }
                      ],
                      "namespace": "mybricks.harmony.icon"
                  }
              },
              {
                  "comId": "u_j9Gbb",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "搜索信息",
                      "comId": "u_wYZL9",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_wYZL9",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "出发到达",
                      "comId": "u_TqZV7",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "北京 → 上海"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "16px",
                                  "fontWeight": "600",
                                  "color": "#333333",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_wYZL9",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "日期信息",
                      "comId": "u_z9MvW",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "12月25日 周三 · 1位成人"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_j9Gbb",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "修改按钮",
                      "comId": "u_vTUpj",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginRight": 16
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "修改"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#0066CC",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_rzG41",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "日期切换栏",
                      "comId": "u_tQlMI",
                      "layout": {
                          "width": "100%",
                          "height": 80
                      },
                      "configs": [
                          {
                              "path": "循环列表/基础属性/排列方向",
                              "value": "row"
                          },
                          {
                              "path": "循环列表/基础属性/间距",
                              "value": 8
                          },
                          {
                              "path": "循环列表/高级属性/显示滚动条",
                              "value": false
                          }
                      ],
                      "namespace": "mybricks.harmony.containerList"
                  }
              },
              {
                  "comId": "u_tQlMI",
                  "type": "addChild",
                  "target": "item",
                  "params": {
                      "title": "日期卡片",
                      "comId": "u_9cTmA",
                      "enhance": true,
                      "layout": {
                          "width": 80,
                          "height": 72
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "justifyContent": "center",
                                  "alignItems": "center"
                              }
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "borderRadius": "8px",
                                  "backgroundColor": "#F5F7FA",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_9cTmA",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "星期",
                      "comId": "u_s1ldi",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "周三"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_9cTmA",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "日期",
                      "comId": "u_yMnWF",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "25"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "20px",
                                  "fontWeight": "600",
                                  "color": "#333333",
                                  "lineHeight": "24px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_9cTmA",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "最低价",
                      "comId": "u_IavwK",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "¥580起"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#FF9900",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_rzG41",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "筛选排序栏",
                      "comId": "u_MnVMk",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": 54
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "space-between",
                                  "alignItems": "center"
                              }
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "borderTop": "1px solid #E8E8E8"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_MnVMk",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "筛选按钮",
                      "comId": "u_rnLFG",
                      "enhance": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "center",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_rnLFG",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "筛选图标",
                      "comId": "u_hwhk1",
                      "layout": {
                          "width": 16,
                          "height": 16,
                          "marginRight": 4
                      },
                      "configs": [
                          {
                              "path": "图标/基础属性/图标",
                              "value": "slider_horizontal_2"
                          },
                          {
                              "path": "图标/基础属性/大小",
                              "value": 16
                          },
                          {
                              "path": "图标/高级属性/颜色",
                              "value": "#666666"
                          }
                      ],
                      "namespace": "mybricks.harmony.icon"
                  }
              },
              {
                  "comId": "u_rnLFG",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "筛选文本",
                      "comId": "u_v8B8R",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "筛选"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#666666",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_MnVMk",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "起飞时间",
                      "comId": "u_dZK1w",
                      "enhance": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "center",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_dZK1w",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "起飞文本",
                      "comId": "u_rpJvA",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginRight": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "起飞时间"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#666666",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_dZK1w",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "下拉图标",
                      "comId": "u_KL0cd",
                      "layout": {
                          "width": 16,
                          "height": 16
                      },
                      "configs": [
                          {
                              "path": "图标/基础属性/图标",
                              "value": "chevron_down"
                          },
                          {
                              "path": "图标/基础属性/大小",
                              "value": 16
                          },
                          {
                              "path": "图标/高级属性/颜色",
                              "value": "#666666"
                          }
                      ],
                      "namespace": "mybricks.harmony.icon"
                  }
              },
              {
                  "comId": "u_MnVMk",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "价格排序",
                      "comId": "u_0GA36",
                      "enhance": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "center",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_0GA36",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "价格文本",
                      "comId": "u_vRgd2",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginRight": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "价格"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#666666",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_0GA36",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "排序图标",
                      "comId": "u_Yl185",
                      "layout": {
                          "width": 16,
                          "height": 16
                      },
                      "configs": [
                          {
                              "path": "图标/基础属性/图标",
                              "value": "arrowshape_up_fill"
                          },
                          {
                              "path": "图标/基础属性/大小",
                              "value": 16
                          },
                          {
                              "path": "图标/高级属性/颜色",
                              "value": "#666666"
                          }
                      ],
                      "namespace": "mybricks.harmony.icon"
                  }
              },
              {
                  "comId": "u_MnVMk",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "仅看直飞",
                      "comId": "u_Lq5UT",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "仅看直飞"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#666666",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "_root_",
                  "type": "addChild",
                  "target": "_rootSlot_",
                  "params": {
                      "title": "主内容区",
                      "comId": "u_pTa6F",
                      "layout": {
                          "width": "100%",
                          "height": "fit-content",
                          "marginTop": 190
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              }
          ],
          "ing"
      ],
      "delay": 1000,
      "timestamp": 1768288395302
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
          [
              {
                  "comId": "u_pTa6F",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "航班列表",
                      "comId": "u_587CK",
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "循环列表/基础属性/排列方向",
                              "value": "column"
                          },
                          {
                              "path": "循环列表/基础属性/间距",
                              "value": 12
                          }
                      ],
                      "namespace": "mybricks.harmony.containerList"
                  }
              },
              {
                  "comId": "u_587CK",
                  "type": "addChild",
                  "target": "item",
                  "params": {
                      "title": "航班卡片",
                      "comId": "u_LgLH3",
                      "layout": {
                          "width": "100%",
                          "height": "fit-content",
                          "marginLeft": 16,
                          "marginRight": 16
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column"
                              }
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "borderRadius": "12px",
                                  "boxShadow": "0 2px 8px rgba(0,0,0,0.05)",
                                  "borderLeft": "4px solid #2EC47B",
                                  "backgroundColor": "#FFFFFF",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_LgLH3",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "航司信息栏",
                      "comId": "u_CmmPp",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content",
                          "marginTop": 12,
                          "marginLeft": 12,
                          "marginRight": 12
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "space-between",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_CmmPp",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "航司Logo和名称",
                      "comId": "u_SjADT",
                      "ignore": true,
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_SjADT",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "Logo",
                      "comId": "u_wPkoS",
                      "layout": {
                          "width": 32,
                          "height": 32,
                          "marginRight": 8
                      },
                      "configs": [
                          {
                              "path": "图片/基础属性/图片链接",
                              "value": "https://placehold.co/32x32/0066CC/ffffff?text=CA"
                          },
                          {
                              "path": "样式/图片",
                              "style": {
                                  "borderRadius": "4px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.image"
                  }
              },
              {
                  "comId": "u_SjADT",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "航司名称",
                      "comId": "u_U8x2S",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "东方航空"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "14px",
                                  "color": "#333333",
                                  "lineHeight": "20px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_CmmPp",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "机型",
                      "comId": "u_o9kdZ",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "A320"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_LgLH3",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "核心信息栏",
                      "comId": "u_g5Pj0",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content",
                          "marginTop": 16,
                          "marginLeft": 12,
                          "marginRight": 12
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "space-between",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_g5Pj0",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "起飞信息",
                      "comId": "u_S5UQq",
                      "ignore": true,
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "alignItems": "flex-start"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_S5UQq",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "起飞时间",
                      "comId": "u_pEki6",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "08:30"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "20px",
                                  "fontWeight": "600",
                                  "color": "#333333",
                                  "lineHeight": "24px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_S5UQq",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "起飞机场",
                      "comId": "u_4GX5t",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "首都T3"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_g5Pj0",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "飞行状态",
                      "comId": "u_iNCMj",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_iNCMj",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "飞行时长",
                      "comId": "u_tR7jA",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "2h15m"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_iNCMj",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "飞行图标",
                      "comId": "u_XitO7",
                      "layout": {
                          "width": 40,
                          "height": 16,
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "图标/基础属性/图标",
                              "value": "paperplane"
                          },
                          {
                              "path": "图标/基础属性/大小",
                              "value": 16
                          },
                          {
                              "path": "图标/高级属性/颜色",
                              "value": "#0066CC"
                          }
                      ],
                      "namespace": "mybricks.harmony.icon"
                  }
              },
              {
                  "comId": "u_iNCMj",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "直飞标签",
                      "comId": "u_PGnf2",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "直飞"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#FFFFFF",
                                  "lineHeight": "16px",
                                  "borderRadius": "4px",
                                  "padding": "2px 6px",
                                  "backgroundColor": "#2EC47B",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_g5Pj0",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "降落信息",
                      "comId": "u_4cNIJ",
                      "ignore": true,
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "alignItems": "flex-end"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_4cNIJ",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "降落时间",
                      "comId": "u_CWVoH",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginBottom": 4
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "10:45"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "20px",
                                  "fontWeight": "600",
                                  "color": "#333333",
                                  "lineHeight": "24px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_4cNIJ",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "降落机场",
                      "comId": "u_k64s9",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "虹桥T2"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_LgLH3",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "底部操作栏",
                      "comId": "u_h8XXv",
                      "ignore": true,
                      "layout": {
                          "width": "100%",
                          "height": "fit-content",
                          "marginTop": 16,
                          "marginBottom": 12,
                          "marginLeft": 12,
                          "marginRight": 12
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "justifyContent": "space-between",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_h8XXv",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "舱位信息",
                      "comId": "u_K0pYU",
                      "ignore": true,
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_K0pYU",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "折扣标签",
                      "comId": "u_yNko8",
                      "layout": {
                          "width": 40,
                          "height": 18,
                          "marginRight": 8
                      },
                      "configs": [
                          {
                              "path": "样式/样式",
                              "style": {
                                  "borderRadius": "4px",
                                  "backgroundColor": "#FF9900",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.line"
                  }
              },
              {
                  "comId": "u_yNko8",
                  "type": "addChild",
                  "target": ":root",
                  "params": {
                      "title": "折扣文本",
                      "comId": "u_kmiJL",
                      "layout": {
                          "position": "absolute",
                          "width": "fit-content",
                          "height": "fit-content",
                          "top": 1,
                          "left": 6
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "8折起"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "10px",
                                  "color": "#FFFFFF",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_K0pYU",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "舱位文本",
                      "comId": "u_uOafN",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "经济舱"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_h8XXv",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "价格操作",
                      "comId": "u_IavwK2",
                      "ignore": true,
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content"
                      },
                      "configs": [
                          {
                              "path": "容器/基础属性/布局",
                              "value": {
                                  "display": "flex",
                                  "flexDirection": "row",
                                  "alignItems": "center"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.containerBasic"
                  }
              },
              {
                  "comId": "u_IavwK2",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "价格",
                      "comId": "u_Ev693",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginRight": 12
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "¥580"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "24px",
                                  "fontWeight": "600",
                                  "color": "#FF9900",
                                  "lineHeight": "28px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              },
              {
                  "comId": "u_IavwK2",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "选择按钮",
                      "comId": "u_kaTgJ",
                      "layout": {
                          "width": 72,
                          "height": 36
                      },
                      "configs": [
                          {
                              "path": "按钮/基础属性/按钮文案",
                              "value": "选择"
                          },
                          {
                              "path": "样式/默认/按钮",
                              "style": {
                                  "borderRadius": "8px",
                                  "fontSize": "14px",
                                  "color": "#FFFFFF",
                                  "backgroundColor": "#0066CC",
                                  "backgroundImage": "none"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.button"
                  }
              },
              {
                  "comId": "u_pTa6F",
                  "type": "addChild",
                  "target": "content",
                  "params": {
                      "title": "列表底部提示",
                      "comId": "u_0pS9W",
                      "layout": {
                          "width": "fit-content",
                          "height": "fit-content",
                          "marginTop": 20,
                          "marginBottom": 20
                      },
                      "configs": [
                          {
                              "path": "文本/基础属性/文本内容",
                              "value": "已展示全部航班"
                          },
                          {
                              "path": "样式/样式",
                              "style": {
                                  "fontSize": "12px",
                                  "color": "#999999",
                                  "lineHeight": "16px"
                              }
                          }
                      ],
                      "namespace": "mybricks.harmony.text"
                  }
              }
          ],
          "ing"
      ],
      "delay": 1000,
      "timestamp": 1768288440232
  },
  // {
  //     "type": "updatePage",
  //     "params": [
  //         "u_ail3e",
  //         [
  //             {
  //                 "type": "defineVar",
  //                 "params": {
  //                     "comId": null,
  //                     "slotId": "_root_",
  //                     "id": "u_R6hQy",
  //                     "title": "日期切换列表",
  //                     "schema": {
  //                         "type": "array",
  //                         "items": {
  //                             "type": "object",
  //                             "properties": {
  //                                 "id": {
  //                                     "type": "string"
  //                                 },
  //                                 "week": {
  //                                     "type": "string"
  //                                 },
  //                                 "day": {
  //                                     "type": "string"
  //                                 },
  //                                 "price": {
  //                                     "type": "string"
  //                                 },
  //                                 "isSelected": {
  //                                     "type": "boolean"
  //                                 }
  //                             }
  //                         }
  //                     },
  //                     "initValue": [
  //                         {
  //                             "id": "1",
  //                             "week": "周一",
  //                             "day": "23",
  //                             "price": "¥620起",
  //                             "isSelected": false
  //                         },
  //                         {
  //                             "id": "2",
  //                             "week": "周二",
  //                             "day": "24",
  //                             "price": "¥590起",
  //                             "isSelected": false
  //                         },
  //                         {
  //                             "id": "3",
  //                             "week": "周三",
  //                             "day": "25",
  //                             "price": "¥580起",
  //                             "isSelected": true
  //                         },
  //                         {
  //                             "id": "4",
  //                             "week": "周四",
  //                             "day": "26",
  //                             "price": "¥600起",
  //                             "isSelected": false
  //                         },
  //                         {
  //                             "id": "5",
  //                             "week": "周五",
  //                             "day": "27",
  //                             "price": "¥680起",
  //                             "isSelected": false
  //                         },
  //                         {
  //                             "id": "6",
  //                             "week": "周六",
  //                             "day": "28",
  //                             "price": "¥750起",
  //                             "isSelected": false
  //                         },
  //                         {
  //                             "id": "7",
  //                             "week": "周日",
  //                             "day": "29",
  //                             "price": "¥720起",
  //                             "isSelected": false
  //                         }
  //                     ]
  //                 }
  //             }
  //         ],
  //         "ing"
  //     ],
  //     "delay": 1000,
  //     "timestamp": 1768288441515
  // },
  // {
  //     "type": "updatePage",
  //     "params": [
  //         "u_ail3e",
  //         [
  //             {
  //                 "type": "defineVar",
  //                 "params": {
  //                     "comId": "u_tQlMI",
  //                     "slotId": "item",
  //                     "id": "u_3wQF1",
  //                     "title": "当前日期项",
  //                     "schema": {
  //                         "type": "object",
  //                         "properties": {
  //                             "id": {
  //                                 "type": "string"
  //                             },
  //                             "week": {
  //                                 "type": "string"
  //                             },
  //                             "day": {
  //                                 "type": "string"
  //                             },
  //                             "price": {
  //                                 "type": "string"
  //                             },
  //                             "isSelected": {
  //                                 "type": "boolean"
  //                             }
  //                         }
  //                     },
  //                     "initValue": {
  //                         "id": "",
  //                         "week": "",
  //                         "day": "",
  //                         "price": "",
  //                         "isSelected": false
  //                     }
  //                 }
  //             }
  //         ],
  //         "ing"
  //     ],
  //     "delay": 1000,
  //     "timestamp": 1768288450666
  // },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
          [],
          "complete"
      ],
      "delay": 1000
  },
]