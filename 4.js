[
  {
    "type": "createCanvas",
    "params": [],
    "delay": 56777,
    "timestamp": 1768357511442
  },
  {
    "type": "createPage",
    "params": [
      "u_kq31a",
      "APP首页",
      {
        "type": "normal",
        "title": "APP首页",
        "template": {
          "namespace": "mybricks.harmony.systemPage",
          "deletable": false,
          "asRoot": true,
          "data": {
            "useTabBar": false
          }
        },
        "inputs": [
          {
            "id": "open",
            "title": "打开",
            "schema": {
              "type": "object"
            }
          }
        ]
      }
    ],
    "delay": 3168,
    "timestamp": 1768357514610
  },
  {
    "type": "createPage",
    "params": [
      "u_kq31a",
      "航班列表页",
      {
        "type": "normal",
        "title": "航班列表页",
        "template": {
          "namespace": "mybricks.harmony.systemPage",
          "deletable": false,
          "asRoot": true,
          "data": {
            "useTabBar": false
          }
        },
        "inputs": [
          {
            "id": "open",
            "title": "打开",
            "schema": {
              "type": "object"
            }
          }
        ]
      }
    ],
    "delay": 184,
    "timestamp": 1768357514794
  },
  {
    "type": "createPage",
    "params": [
      "u_kq31a",
      "我的行程",
      {
        "type": "normal",
        "title": "我的行程",
        "template": {
          "namespace": "mybricks.harmony.systemPage",
          "deletable": false,
          "asRoot": true,
          "data": {
            "useTabBar": false
          }
        },
        "inputs": [
          {
            "id": "open",
            "title": "打开",
            "schema": {
              "type": "object"
            }
          }
        ]
      }
    ],
    "delay": 5,
    "timestamp": 1768357514799
  },
  {
    "type": "updatePage",
    "params": [
      "u_CTD0M",
      [],
      "start"
    ],
    "delay": 46343,
    "timestamp": 1768357561142
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [],
      "start"
    ],
    "delay": 9759,
    "timestamp": 1768357570901
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [],
      "start"
    ],
    "delay": 3369,
    "timestamp": 1768357574270
  },
  {
    "type": "updatePage",
    "params": [
      "u_CTD0M",
      [
        {
          "comId": "_root_",
          "type": "setLayout",
          "target": ":root",
          "params": {
            "height": 1200
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "页面/基础属性/作为标签页",
            "value": true
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
              "flexDirection": "column"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "页面/内容区/底部留白",
            "value": "80"
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "样式/内容区/背景",
            "style": {
              "backgroundColor": "#F2F3F5",
              "backgroundImage": "none"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "顶部导航栏",
            "comId": "u_n0Mgm",
            "layout": {
              "width": "100%",
              "height": 64,
              "position": "fixed",
              "top": 0,
              "left": 0
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
                  "borderBottom": "1px solid #E5E5E5",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_n0Mgm",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "左侧定位区域",
            "comId": "u_vgihz",
            "ignore": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginLeft": 15
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
          "comId": "u_vgihz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "定位图标",
            "comId": "u_gxBGD",
            "layout": {
              "width": 20,
              "height": 20,
              "marginRight": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "position"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_vgihz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市名称",
            "comId": "u_GcKGR",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "杭州"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "fontWeight": "500",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_n0Mgm",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "消息图标",
            "comId": "u_vXnSI",
            "layout": {
              "width": 24,
              "height": 24,
              "marginRight": 15
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "message"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#1D1D1F"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "顶部占位",
            "comId": "u_DQQYG",
            "layout": {
              "width": "100%",
              "height": 64
            },
            "configs": [],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "营销Banner轮播",
            "comId": "u_70dyb",
            "layout": {
              "width": "100%",
              "height": 180,
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15
            },
            "configs": [
              {
                "path": "轮播/基础属性/轮播内容",
                "value": "image"
              },
              {
                "path": "轮播/基础属性/图片",
                "value": [
                  {
                    "_id": "u_bn1",
                    "thumbnail": "https://ai.mybricks.world/image-search?term=airline+spring+festival+promotion&w=345&h=180"
                  },
                  {
                    "_id": "u_bn2",
                    "thumbnail": "https://ai.mybricks.world/image-search?term=membership+day+discount&w=345&h=180"
                  },
                  {
                    "_id": "u_bn3",
                    "thumbnail": "https://ai.mybricks.world/image-search?term=new+user+coupon&w=345&h=180"
                  }
                ]
              },
              {
                "path": "轮播/自动播放",
                "value": true
              },
              {
                "path": "轮播/自动切换时间间隔(ms)",
                "value": "3000"
              },
              {
                "path": "轮播/高级属性/循环轮播",
                "value": true
              },
              {
                "path": "轮播/高级属性/展示指示器",
                "value": true
              },
              {
                "path": "样式/轮播",
                "style": {
                  "borderRadius": "8px",
                  "overflow": "hidden",
                  "boxShadow": "0 4px 12px rgba(0,0,0,0.05)"
                }
              },
              {
                "path": "样式/默认指示器",
                "style": {
                  "width": "6px",
                  "height": "6px",
                  "backgroundColor": "rgba(255,255,255,0.5)",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/高亮指示器",
                "style": {
                  "width": "16px",
                  "height": "6px",
                  "backgroundColor": "#0052D9",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.swiper"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "核心查询卡片",
            "comId": "u_9i1I2",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15
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
                  "borderRadius": "8px",
                  "padding": "20px",
                  "boxShadow": "0 4px 12px rgba(0,82,217,0.15)",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, #0052D9 0%, #3A7CFF 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_9i1I2",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市选择区域",
            "comId": "u_cVYra",
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
                  "justifyContent": "space-between",
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "6px",
                  "padding": "16px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_cVYra",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发地区域",
            "comId": "u_MmZHM",
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
                  "alignItems": "flex-start"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_MmZHM",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发城市",
            "comId": "u_wdlJr",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "杭州"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_MmZHM",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "机场代码",
            "comId": "u_axsKY",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "HGH"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_cVYra",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "交换按钮",
            "comId": "u_GfymY",
            "layout": {
              "width": 40,
              "height": 40
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
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "20px",
                  "backgroundColor": "#F2F3F5",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_GfymY",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "双向箭头",
            "comId": "u_gjweO",
            "layout": {
              "width": 20,
              "height": 20
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_left_and_arrow_down_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_cVYra",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "目的地区域",
            "comId": "u_oOZgV",
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
                  "alignItems": "flex-end"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_oOZgV",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "目的城市",
            "comId": "u_XoCYT",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "北京"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_oOZgV",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "机场代码",
            "comId": "u_zDtAg",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "PEK"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9i1I2",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期选择区域",
            "comId": "u_KwJDb",
            "enhance": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12
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
                  "borderRadius": "6px",
                  "padding": "16px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_KwJDb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期左侧",
            "comId": "u_CxPry",
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
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_CxPry",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日历图标",
            "comId": "u_t7wBP",
            "layout": {
              "width": 20,
              "height": 20,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "calendar"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_CxPry",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期信息",
            "comId": "u_JbMja",
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
          "comId": "u_JbMja",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发日期",
            "comId": "u_VD9Tm",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "出发日期"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_JbMja",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期值",
            "comId": "u_wWLxi",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "2025-02-15 周六"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_KwJDb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右箭头",
            "comId": "u_BJgNz",
            "layout": {
              "width": 20,
              "height": 20
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#999999"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_9i1I2",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位选择区域",
            "comId": "u_44PTg",
            "enhance": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12
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
                  "borderRadius": "6px",
                  "padding": "16px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_44PTg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位左侧",
            "comId": "u_J6p8d",
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
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_J6p8d",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位图标",
            "comId": "u_C4p8v",
            "layout": {
              "width": 20,
              "height": 20,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        }
      ],
      "ing"
    ],
    "delay": 38247,
    "timestamp": 1768357612517
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
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
            "path": "页面/顶部栏/标题",
            "value": "我的行程"
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
              "flexDirection": "column"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "样式/内容区/背景",
            "style": {
              "backgroundColor": "#F2F3F5",
              "backgroundImage": "none"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "头部个人中心区域",
            "comId": "u_K8r4D",
            "layout": {
              "width": "100%",
              "height": 180
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
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, #0052D9, #4A90E2)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "返回按钮",
            "comId": "u_YhOxs",
            "layout": {
              "position": "absolute",
              "width": 24,
              "height": 24,
              "top": 15,
              "left": 15
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_left"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#FFFFFF"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "页面标题",
            "comId": "u_nH6hM",
            "layout": {
              "position": "absolute",
              "width": "fit-content",
              "height": "fit-content",
              "top": 15
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "我的行程"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "18px",
                  "fontWeight": "bold",
                  "color": "#FFFFFF",
                  "lineHeight": "24px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "头像",
            "comId": "u_8Z882",
            "layout": {
              "width": 70,
              "height": 70,
              "marginTop": 40
            },
            "configs": [
              {
                "path": "图片/基础属性/图片链接",
                "value": "https://placehold.co/70x70/0052D9/ffffff?text=ZS"
              },
              {
                "path": "样式/图片",
                "style": {
                  "borderRadius": "50%",
                  "border": "3px solid #FFFFFF"
                }
              }
            ],
            "namespace": "mybricks.harmony.image"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "昵称",
            "comId": "u_0HApq",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 8
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "张三"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#FFFFFF",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员等级标签",
            "comId": "u_whXfE",
            "layout": {
              "width": "fit-content",
              "height": 24,
              "marginTop": 6
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "12px",
                  "padding": "0 12px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(90deg, #FF7D00, #FFAA00)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_whXfE",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员图标",
            "comId": "u_aHw8k",
            "layout": {
              "width": 14,
              "height": 14,
              "marginRight": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "star_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 14
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#FFFFFF"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_whXfE",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员文字",
            "comId": "u_nNKNa",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "金卡会员"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#FFFFFF",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_K8r4D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "积分信息",
            "comId": "u_wI3xk",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "当前积分：8,520"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "rgba(255,255,255,0.85)",
                  "lineHeight": "18px"
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
            "title": "即将出行标题行",
            "comId": "u_OtZYb",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15
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
          "comId": "u_OtZYb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题文本",
            "comId": "u_VCpYi",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "即将出行"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_OtZYb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查看全部",
            "comId": "u_uC3Dt",
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
          "comId": "u_uC3Dt",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查看全部文本",
            "comId": "u_Nvh8h",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "查看全部"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#0052D9",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_uC3Dt",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "箭头图标",
            "comId": "u_zEjDk",
            "layout": {
              "width": 16,
              "height": 16
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 16
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "即将出行航班卡片",
            "comId": "u_RBsRN",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 8,
              "marginLeft": 15,
              "marginRight": 15
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
                  "borderRadius": "8px",
                  "boxShadow": "0 4px 12px rgba(0,0,0,0.05)",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_RBsRN",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "倒计时横幅",
            "comId": "u_aWovg",
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
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "8px 8px 0 0",
                  "padding": "8px 15px",
                  "backgroundColor": "#FF7D00",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic",
            "enhance": true
          }
        },
        {
          "comId": "u_aWovg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "时钟图标",
            "comId": "u_DnvWL",
            "layout": {
              "width": 16,
              "height": 16,
              "marginRight": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "clock"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 16
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#FFFFFF"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_aWovg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "倒计时文本",
            "comId": "u_z8TQr",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "距离起飞还有 3小时25分钟"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#FFFFFF",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_RBsRN",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班信息行",
            "comId": "u_E1ivK",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 15
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
                  "padding": "0 15px"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic",
            "enhance": true
          }
        },
        {
          "comId": "u_E1ivK",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞信息组",
            "comId": "u_RHEvX",
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
          "comId": "u_RHEvX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞时间",
            "comId": "u_bBgM4",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "09:30"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "24px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "32px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_RHEvX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞机场代码",
            "comId": "u_V3pAu",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "PEK"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_RHEvX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞城市名",
            "comId": "u_281Kj",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "北京首都"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_E1ivK",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航线中间部分",
            "comId": "u_8ETpa",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginLeft": 8,
              "marginRight": 8
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
          "comId": "u_8ETpa",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞机图标",
            "comId": "u_tyu1G",
            "layout": {
              "width": 24,
              "height": 24
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        }
      ],
      "ing"
    ],
    "delay": 12709,
    "timestamp": 1768357625226
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "comId": "_root_",
          "type": "setLayout",
          "target": ":root",
          "params": {
            "height": 1200
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "页面/顶部栏/标题",
            "value": "航班列表"
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
              "flexDirection": "column"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "样式/内容区/背景",
            "style": {
              "backgroundColor": "#F2F3F5",
              "backgroundImage": "none"
            }
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "顶部搜索摘要区",
            "comId": "u_ZCgsK",
            "layout": {
              "width": "100%",
              "height": "fit-content"
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
                  "padding": "16px 12px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(180deg, #E6F0FF 0%, #FFFFFF 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_ZCgsK",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "第一行容器",
            "comId": "u_NxhRG",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 8
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
          "comId": "u_NxhRG",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "返回图标",
            "comId": "u_b8WM1",
            "layout": {
              "width": 24,
              "height": 24
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_left"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#1D1D1F"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_NxhRG",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市对容器",
            "comId": "u_1DvLT",
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
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_1DvLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发城市",
            "comId": "u_Z26Cu",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "北京"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "600",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_1DvLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "箭头图标",
            "comId": "u_BUgob",
            "layout": {
              "width": 16,
              "height": 16,
              "marginLeft": 4,
              "marginRight": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_right"
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
          "comId": "u_1DvLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "目的城市",
            "comId": "u_poHlw",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "上海"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "600",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_NxhRG",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "修改图标",
            "comId": "u_9OGIn",
            "layout": {
              "width": 24,
              "height": 24
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "pencil_line_1"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_ZCgsK",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "第二行信息",
            "comId": "u_ohfQ1",
            "layout": {
              "width": "100%",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12月25日 周三 · 1成人 · 经济舱"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
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
            "title": "日期选择轴",
            "comId": "u_Bph6u",
            "layout": {
              "width": "100%",
              "height": 64
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "overflow": "scroll",
                  "padding": "0 12px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片1",
            "comId": "u_sBu7D",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_sBu7D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_SrWgl",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周一"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_sBu7D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_1KJFD",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/23"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_sBu7D",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_4faHE",
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
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片2选中",
            "comId": "u_vUGbx",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "backgroundColor": "#0052D9",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_vUGbx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_pzzcR",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周二"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#FFFFFF",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_vUGbx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_dqT7L",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/24"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#FFFFFF",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_vUGbx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_YmZJJ",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥620起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#FFFFFF",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片3",
            "comId": "u_W9Zv5",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_W9Zv5",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_tBko9",
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
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_W9Zv5",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_MKNF1",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/25"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_W9Zv5",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_ZuCQJ",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥650起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片4",
            "comId": "u_lyBsR",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        }
      ],
      "ing"
    ],
    "delay": 2787,
    "timestamp": 1768357628013
  },
  {
    "type": "updatePage",
    "params": [
      "u_CTD0M",
      [
        {
          "comId": "u_J6p8d",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位信息",
            "comId": "u_6dX4K",
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
          "comId": "u_6dX4K",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位等级",
            "comId": "u_UHOrs",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "舱位等级"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_6dX4K",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位值",
            "comId": "u_zs0SE",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "经济舱"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_44PTg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右箭头",
            "comId": "u_vu9j8",
            "layout": {
              "width": 20,
              "height": 20
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#999999"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_9i1I2",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查询按钮",
            "comId": "u_xgvKw",
            "layout": {
              "width": "100%",
              "height": 52,
              "marginTop": 20
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "查询航班"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "borderRadius": "8px",
                  "fontSize": "16px",
                  "color": "#FFFFFF",
                  "fontWeight": "600",
                  "border": "none",
                  "backgroundColor": "#FF7D00",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.button"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "特价推荐区域",
            "comId": "u_4XiVl",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "column"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_4XiVl",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题栏",
            "comId": "u_tML1X",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 12
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
          "comId": "u_tML1X",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价推荐",
            "comId": "u_GkgQF",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "特价推荐"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_tML1X",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多入口",
            "comId": "u_DJcwI",
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
          "comId": "u_DJcwI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多文本",
            "comId": "u_bZxsb",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "更多"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_DJcwI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右箭头",
            "comId": "u_MT8GP",
            "layout": {
              "width": 16,
              "height": 16
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 16
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#999999"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_4XiVl",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价列表",
            "comId": "u_lhP9k",
            "layout": {
              "width": "100%",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "循环列表/数据/数据源",
                "value": [
                  {
                    "id": "1",
                    "route": "杭州 → 北京",
                    "departureCity": "杭州",
                    "arrivalCity": "北京",
                    "date": "2月15日",
                    "aircraft": "波音737",
                    "airline": "东方航空",
                    "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=CA",
                    "price": 580
                  },
                  {
                    "id": "2",
                    "route": "上海 → 广州",
                    "departureCity": "上海",
                    "arrivalCity": "广州",
                    "date": "2月16日",
                    "aircraft": "空客A320",
                    "airline": "南方航空",
                    "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=CZ",
                    "price": 450
                  },
                  {
                    "id": "3",
                    "route": "深圳 → 成都",
                    "departureCity": "深圳",
                    "arrivalCity": "成都",
                    "date": "2月18日",
                    "aircraft": "波音787",
                    "airline": "国航",
                    "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=MU",
                    "price": 680
                  },
                  {
                    "id": "4",
                    "route": "杭州 → 上海",
                    "departureCity": "杭州",
                    "arrivalCity": "上海",
                    "date": "2月20日",
                    "aircraft": "空客A330",
                    "airline": "吉祥航空",
                    "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=HO",
                    "price": 280
                  }
                ]
              },
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
          "comId": "u_lhP9k",
          "type": "addChild",
          "target": "item",
          "params": {
            "title": "列表项卡片",
            "comId": "u_hDkNg",
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
                  "flexDirection": "column"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "8px",
                  "padding": "16px",
                  "boxShadow": "0 4px 12px rgba(0,0,0,0.05)",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_hDkNg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "卡片顶部",
            "comId": "u_UIvYU",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 12
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "justifyContent": "space-between",
                  "alignItems": "flex-start"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_UIvYU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "左侧信息",
            "comId": "u_pEjQz",
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
                  "alignItems": "flex-start"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_pEjQz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价标签",
            "comId": "u_KCDZk",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "2px 8px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, #FF7D00 0%, #FFA033 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_KCDZk",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价文本",
            "comId": "u_RKJWw",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "特价"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#FFFFFF",
                  "fontWeight": "600",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_pEjQz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航线",
            "comId": "u_IeH3A",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "杭州 → 北京"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#1D1D1F",
                  "fontWeight": "600",
                  "lineHeight": "22px"
                }
              },
              {
                "path": "样式/开启文本省略",
                "value": false
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_pEjQz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期机型",
            "comId": "u_SRdfI",
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
          "comId": "u_SRdfI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_gq6Zq",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 8
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "2月15日"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_SRdfI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "机型",
            "comId": "u_Di78V",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "波音737"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_UIvYU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右侧价格",
            "comId": "u_syfpz",
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
          "comId": "u_syfpz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格区域",
            "comId": "u_uiFqe",
            "ignore": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "baseline"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_uiFqe",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "货币符号",
            "comId": "u_WFgv3",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#FF7D00",
                  "fontWeight": "600",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_uiFqe",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格数字",
            "comId": "u_FQch1",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "580"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "20px",
                  "color": "#FF7D00",
                  "fontWeight": "700",
                  "lineHeight": "28px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_syfpz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起字",
            "comId": "u_VyRQY",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_hDkNg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航司Logo",
            "comId": "u_AzkHQ",
            "layout": {
              "width": 40,
              "height": 40,
              "position": "absolute",
              "left": 16,
              "bottom": 16
            },
            "configs": [
              {
                "path": "图片/基础属性/图片链接",
                "value": "https://placehold.co/40x40/0052D9/FFFFFF?text=CA"
              },
              {
                "path": "图片/高级属性/展示方式",
                "value": "aspectFill"
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
        }
      ],
      "ing"
    ],
    "delay": 28236,
    "timestamp": 1768357656249
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [
        {
          "comId": "u_8ETpa",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞行时长",
            "comId": "u_b4FHC",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "2h30m"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_E1ivK",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达信息组",
            "comId": "u_ANuCC",
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
          "comId": "u_ANuCC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达时间",
            "comId": "u_5dlkE",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12:00"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "24px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "32px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_ANuCC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达机场代码",
            "comId": "u_9EX8k",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "PVG"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_ANuCC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达城市名",
            "comId": "u_N0pV0",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "上海虹桥"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_RBsRN",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "底部关键信息行",
            "comId": "u_UUbSU",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 15
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
                  "padding": "0 15px"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic",
            "enhance": true
          }
        },
        {
          "comId": "u_UUbSU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班座位信息",
            "comId": "u_WrZlg",
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
          "comId": "u_WrZlg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班号",
            "comId": "u_bYg66",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 12
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "CA1234"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_WrZlg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "座位号",
            "comId": "u_6u8Sh",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "座位 32A"
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
          "comId": "u_UUbSU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "登机口徽章",
            "comId": "u_Chk3v",
            "layout": {
              "width": 56,
              "height": 56
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
                  "borderRadius": "50%",
                  "backgroundColor": "#0052D9",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Chk3v",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "登机口文本",
            "comId": "u_ACFla",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "A12"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#FFFFFF",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_RBsRN",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "底部操作按钮行",
            "comId": "u_ah8HS",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 15,
              "marginBottom": 15
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
                  "padding": "0 15px"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic",
            "enhance": true
          }
        },
        {
          "comId": "u_ah8HS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "值机办理按钮",
            "comId": "u_72ndH",
            "layout": {
              "width": "100%",
              "height": 40,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "值机办理"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "border": "1px solid #0052D9",
                  "color": "#0052D9",
                  "fontSize": "14px",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.button"
          }
        },
        {
          "comId": "u_ah8HS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查看详情按钮",
            "comId": "u_6I3AW",
            "layout": {
              "width": "100%",
              "height": 40
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "查看详情"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "color": "#FFFFFF",
                  "fontSize": "14px",
                  "borderRadius": "8px",
                  "backgroundColor": "#0052D9",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.button"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "行程列表标题行",
            "comId": "u_5mXhl",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15
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
          "comId": "u_5mXhl",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "列表标题",
            "comId": "u_X9sc1",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "全部行程"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_5mXhl",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "筛选器",
            "comId": "u_VdriE",
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
          "comId": "u_VdriE",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "筛选文本",
            "comId": "u_Rq0mr",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "全部"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#999999",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_VdriE",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "下拉图标",
            "comId": "u_Yv4uZ",
            "layout": {
              "width": 14,
              "height": 14
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_down"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 14
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#999999"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "行程列表容器",
            "comId": "u_Wi3E5",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 8,
              "marginLeft": 15,
              "marginRight": 15
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
          "comId": "u_Wi3E5",
          "type": "addChild",
          "target": "item",
          "params": {
            "title": "行程卡片",
            "comId": "u_vBqku",
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
                  "justifyContent": "space-between",
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "8px",
                  "boxShadow": "0 4px 12px rgba(0,0,0,0.05)",
                  "padding": "15px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_vBqku",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "左侧信息组",
            "comId": "u_tEFEL",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginRight": 12
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
          "comId": "u_tEFEL",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "状态标签",
            "comId": "u_NOTh5",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "2px 8px",
                  "backgroundColor": "#00BA88",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_NOTh5",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "状态文字",
            "comId": "u_OMqpG",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "已完成"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "11px",
                  "color": "#FFFFFF",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_tEFEL",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_Lclv4",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "2024年1月15日"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#999999",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_tEFEL",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航线信息",
            "comId": "u_airX1",
            "ignore": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
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
          "comId": "u_airX1",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞信息",
            "comId": "u_ARI9O",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "09:30 PEK 北京"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_airX1",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞机图标",
            "comId": "u_dvOot",
            "layout": {
              "width": 16,
              "height": 16,
              "marginRight": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 16
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_airX1",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达信息",
            "comId": "u_FfYog",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12:00 PVG 上海"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_tEFEL",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班号",
            "comId": "u_RdIga",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "CA1234"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#999999",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_vBqku",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右侧箭头",
            "comId": "u_0mrKk",
            "layout": {
              "width": 20,
              "height": 20
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#CCCCCC"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "常用功能标题",
            "comId": "u_ygQms",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "常用功能"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#1D1D1F",
                  "lineHeight": "22px"
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
            "title": "功能宫格容器",
            "comId": "u_xIftZ",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 8,
              "marginLeft": 15,
              "marginRight": 15
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "flexWrap": "wrap",
                  "justifyContent": "space-between"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "8px",
                  "padding": "15px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "我的订单",
            "comId": "u_V1Gf7",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_V1Gf7",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单图标",
            "comId": "u_WAqCC",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "doc_plaintext"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_V1Gf7",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单文字",
            "comId": "u_tZTOz",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "我的订单"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "常用乘机人",
            "comId": "u_iNK7V",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        }
      ],
      "ing"
    ],
    "delay": 10061,
    "timestamp": 1768357666310
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "comId": "u_lyBsR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_mWC0C",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周四"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_lyBsR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_g8chr",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/26"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_lyBsR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_50UTn",
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
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片5",
            "comId": "u_Z8JnR",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Z8JnR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_GmioV",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周五"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Z8JnR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_KZO5m",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/27"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Z8JnR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_K6Vzw",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥720起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片6",
            "comId": "u_zyjsr",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52,
              "marginRight": 8
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_zyjsr",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_fHJQC",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周六"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_zyjsr",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_TlnjS",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/28"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_zyjsr",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_hDyqi",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥890起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Bph6u",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期卡片7",
            "comId": "u_71moY",
            "enhance": true,
            "layout": {
              "width": 60,
              "height": 52
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
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_71moY",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "星期",
            "comId": "u_sslCe",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "周日"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_71moY",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日期",
            "comId": "u_Pb2wI",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "12/29"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_71moY",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_GpQtV",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥760起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#999999",
                  "lineHeight": "14px"
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
            "title": "航班数量统计",
            "comId": "u_18gCa",
            "layout": {
              "width": "100%",
              "height": 40
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "padding": "0 12px",
                  "backgroundColor": "#F2F3F5",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_18gCa",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "统计文本",
            "comId": "u_vaV5d",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "共找到 23 个航班"
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
            "title": "航班列表容器",
            "comId": "u_8dr7L",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 56
            },
            "configs": [
              {
                "path": "循环列表/基础属性/排列方向",
                "value": "column"
              },
              {
                "path": "循环列表/基础属性/间距",
                "value": 12
              },
              {
                "path": "循环列表/数据/数据源",
                "value": [
                  {
                    "id": "1",
                    "airline": "中国国航",
                    "logo": "https://placehold.co/40x40/0052D9/FFFFFF?text=CA",
                    "flightNo": "CA1234",
                    "aircraft": "波音737",
                    "depTime": "08:30",
                    "depAirport": "PEK",
                    "arrTime": "10:45",
                    "arrAirport": "PVG",
                    "duration": "2小时15分",
                    "isDirect": true,
                    "price": 1280,
                    "seats": 9,
                    "tags": [
                      "餐食",
                      "可退改",
                      "免费行李"
                    ]
                  },
                  {
                    "id": "2",
                    "airline": "东方航空",
                    "logo": "https://placehold.co/40x40/E60012/FFFFFF?text=MU",
                    "flightNo": "MU5181",
                    "aircraft": "空客320",
                    "depTime": "09:15",
                    "depAirport": "PEK",
                    "arrTime": "11:30",
                    "arrAirport": "PVG",
                    "duration": "2小时15分",
                    "isDirect": true,
                    "price": 1150,
                    "seats": 15,
                    "tags": [
                      "餐食",
                      "免费行李"
                    ]
                  },
                  {
                    "id": "3",
                    "airline": "南方航空",
                    "logo": "https://placehold.co/40x40/0066B3/FFFFFF?text=CZ",
                    "flightNo": "CZ3117",
                    "aircraft": "波音787",
                    "depTime": "13:20",
                    "depAirport": "PEK",
                    "arrTime": "15:45",
                    "arrAirport": "PVG",
                    "duration": "2小时25分",
                    "isDirect": true,
                    "price": 1380,
                    "seats": 6,
                    "tags": [
                      "餐食",
                      "可退改"
                    ]
                  }
                ]
              }
            ],
            "namespace": "mybricks.harmony.containerList"
          }
        },
        {
          "comId": "u_8dr7L",
          "type": "addChild",
          "target": "item",
          "params": {
            "title": "航班卡片",
            "comId": "u_CRLJz",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginLeft": 12,
              "marginRight": 12
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
                  "borderRadius": "8px",
                  "boxShadow": "0 4px 12px rgba(0,0,0,0.05)",
                  "padding": "12px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_CRLJz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航司信息行",
            "comId": "u_goxm6",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 12
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
          "comId": "u_goxm6",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "左侧容器",
            "comId": "u_a2dVB",
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
          "comId": "u_a2dVB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航司Logo",
            "comId": "u_9SrCj",
            "layout": {
              "width": 40,
              "height": 40,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "图片/基础属性/图片链接",
                "value": "https://placehold.co/40x40/0052D9/FFFFFF?text=CA"
              },
              {
                "path": "图片/高级属性/展示方式",
                "value": "aspectFill"
              },
              {
                "path": "样式/图片",
                "style": {
                  "borderRadius": "8px"
                }
              }
            ],
            "namespace": "mybricks.harmony.image"
          }
        },
        {
          "comId": "u_a2dVB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "名称航班号容器",
            "comId": "u_Y3SQ4",
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
                  "flexDirection": "column"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Y3SQ4",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航司名称",
            "comId": "u_ZLB6w",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "中国国航"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "500",
                  "color": "#1D1D1F",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Y3SQ4",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班号",
            "comId": "u_YdjtT",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "CA1234"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_goxm6",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "机型标签",
            "comId": "u_OGZVg",
            "enhance": true,
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
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "4px 8px",
                  "backgroundColor": "#F2F3F5",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_OGZVg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "机型文本",
            "comId": "u_NwuDt",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "波音737"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_CRLJz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航程时间行",
            "comId": "u_l9muF",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 12
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
          "comId": "u_l9muF",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞区域",
            "comId": "u_t2SmR",
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
          "comId": "u_t2SmR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞时间",
            "comId": "u_1BsOz",
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
                  "fontSize": "18px",
                  "fontWeight": "600",
                  "color": "#1D1D1F",
                  "lineHeight": "25px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_t2SmR",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起飞机场",
            "comId": "u_Zy1EC",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "PEK"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#666666",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_l9muF",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "中间区域",
            "comId": "u_KsIFy",
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
          "comId": "u_KsIFy",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞行时长",
            "comId": "u_uQWCF",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "2小时15分"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_KsIFy",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞机图标",
            "comId": "u_T0Lyw",
            "layout": {
              "width": 20,
              "height": 20,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        }
      ],
      "ing"
    ],
    "delay": 3488,
    "timestamp": 1768357669798
  },
  {
    "type": "updatePage",
    "params": [
      "u_CTD0M",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_4Nf7s",
            "title": "营销Banner数据",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "imageUrl": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "linkUrl": {
                    "type": "string"
                  }
                }
              }
            },
            "initValue": [
              {
                "imageUrl": "https://ai.mybricks.world/image-search?term=airline+spring+festival+promotion&w=345&h=180",
                "title": "春节特惠 | 国内机票立减200元",
                "linkUrl": ""
              },
              {
                "imageUrl": "https://ai.mybricks.world/image-search?term=membership+day+discount&w=345&h=180",
                "title": "会员日 | 全场机票8折起",
                "linkUrl": ""
              },
              {
                "imageUrl": "https://ai.mybricks.world/image-search?term=new+user+coupon&w=345&h=180",
                "title": "新用户专享 | 首单立减100元",
                "linkUrl": ""
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 22349,
    "timestamp": 1768357692147
  },
  {
    "type": "updatePage",
    "params": [
      "u_CTD0M",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_eFDRo",
            "title": "特价推荐列表",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "route": {
                    "type": "string"
                  },
                  "departureCity": {
                    "type": "string"
                  },
                  "arrivalCity": {
                    "type": "string"
                  },
                  "date": {
                    "type": "string"
                  },
                  "aircraft": {
                    "type": "string"
                  },
                  "airline": {
                    "type": "string"
                  },
                  "airlineLogo": {
                    "type": "string"
                  },
                  "price": {
                    "type": "number"
                  }
                }
              }
            },
            "initValue": [
              {
                "id": "1",
                "route": "杭州 → 北京",
                "departureCity": "杭州",
                "arrivalCity": "北京",
                "date": "2月15日",
                "aircraft": "波音737",
                "airline": "东方航空",
                "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=CA",
                "price": 580
              },
              {
                "id": "2",
                "route": "上海 → 广州",
                "departureCity": "上海",
                "arrivalCity": "广州",
                "date": "2月16日",
                "aircraft": "空客A320",
                "airline": "南方航空",
                "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=CZ",
                "price": 450
              },
              {
                "id": "3",
                "route": "深圳 → 成都",
                "departureCity": "深圳",
                "arrivalCity": "成都",
                "date": "2月18日",
                "aircraft": "波音787",
                "airline": "国航",
                "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=MU",
                "price": 680
              },
              {
                "id": "4",
                "route": "杭州 → 上海",
                "departureCity": "杭州",
                "arrivalCity": "上海",
                "date": "2月20日",
                "aircraft": "空客A330",
                "airline": "吉祥航空",
                "airlineLogo": "https://placehold.co/40x40/0052D9/FFFFFF?text=HO",
                "price": 280
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 108,
    "timestamp": 1768357692255
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [
        {
          "comId": "u_iNK7V",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "乘机人图标",
            "comId": "u_shl8M",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "person_2"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_iNK7V",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "乘机人文字",
            "comId": "u_vvXgj",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "常用乘机人"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券",
            "comId": "u_751RU",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_751RU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券图标",
            "comId": "u_9Vqeo",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "doc_text_badge_checkmark"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_751RU",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券文字",
            "comId": "u_29iT0",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "优惠券"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员中心",
            "comId": "u_gVdyf",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_gVdyf",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员图标",
            "comId": "u_7nj2o",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "star"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_gVdyf",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员文字",
            "comId": "u_Pw9a5",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "会员中心"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "联系客服",
            "comId": "u_2kSvv",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80,
              "marginTop": 12
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        }
      ],
      "ing"
    ],
    "delay": 16233,
    "timestamp": 1768357708488
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [
        {
          "comId": "u_2kSvv",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服图标",
            "comId": "u_uRCUD",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "message"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_2kSvv",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服文字",
            "comId": "u_2ooQa",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "联系客服"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "行李托运",
            "comId": "u_AYHgu",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80,
              "marginTop": 12
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_AYHgu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "行李图标",
            "comId": "u_XPOf7",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "case_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_AYHgu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "行李文字",
            "comId": "u_eLSGB",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "行李托运"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出行保险",
            "comId": "u_qYr5Y",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80,
              "marginTop": 12
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_qYr5Y",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "保险图标",
            "comId": "u_JhaDG",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "checkmark_shield"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_qYr5Y",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "保险文字",
            "comId": "u_FR6Yn",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "出行保险"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_xIftZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "设置",
            "comId": "u_Qm6D3",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": 80,
              "marginTop": 12
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Qm6D3",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "设置图标",
            "comId": "u_WMPcF",
            "layout": {
              "width": 40,
              "height": 40,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "gearshape"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 40
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_Qm6D3",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "设置文字",
            "comId": "u_ufQlR",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "设置"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "13px",
                  "color": "#333333",
                  "lineHeight": "18px"
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
            "title": "底部安全提示",
            "comId": "u_manEG",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 12,
              "marginLeft": 15,
              "marginRight": 15,
              "marginBottom": 15
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "8px",
                  "padding": "12px",
                  "backgroundColor": "#E8F3FF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_manEG",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "盾牌图标",
            "comId": "u_uAu2I",
            "layout": {
              "width": 20,
              "height": 20,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "checkmark_shield_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0052D9"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_manEG",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "提示文字",
            "comId": "u_a2u0x",
            "layout": {
              "width": "100%",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "您的行程信息已加密保护，航班动态实时推送"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#0052D9",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        }
      ],
      "ing"
    ],
    "delay": 1153,
    "timestamp": 1768357709641
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "comId": "u_KsIFy",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "经停信息",
            "comId": "u_PieiB",
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
                  "color": "#0052D9",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_l9muF",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "降落区域",
            "comId": "u_1j3Yc",
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
          "comId": "u_1j3Yc",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "降落时间",
            "comId": "u_tpCZt",
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
                  "fontSize": "18px",
                  "fontWeight": "600",
                  "color": "#1D1D1F",
                  "lineHeight": "25px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_1j3Yc",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "降落机场",
            "comId": "u_ul27Q",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "PVG"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "color": "#666666",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_CRLJz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格操作行",
            "comId": "u_5t0WZ",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 8
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
          "comId": "u_5t0WZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "剩余座位",
            "comId": "u_89Isb",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "剩余9张"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#FF7D00",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_5t0WZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右侧容器",
            "comId": "u_FKuvg",
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
          "comId": "u_FKuvg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "起字",
            "comId": "u_4M0I1",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_FKuvg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格",
            "comId": "u_64Jbi",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 8
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥1280"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "20px",
                  "fontWeight": "600",
                  "color": "#FF7D00",
                  "lineHeight": "28px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_FKuvg",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "预订按钮",
            "comId": "u_MCyCl",
            "layout": {
              "width": 80,
              "height": 32
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "预订"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "borderRadius": "8px",
                  "fontSize": "14px",
                  "color": "#FFFFFF",
                  "fontWeight": "500",
                  "backgroundColor": "#FF7D00",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.button"
          }
        },
        {
          "comId": "u_CRLJz",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标签行",
            "comId": "u_OaLPT",
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
                  "flexDirection": "row",
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_OaLPT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "餐食标签",
            "comId": "u_GoynX",
            "enhance": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 8
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "4px 8px",
                  "backgroundColor": "#E6F0FF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_GoynX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "餐食文本",
            "comId": "u_DAEzI",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "餐食"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#0052D9",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_OaLPT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "可退改标签",
            "comId": "u_cjBwN",
            "enhance": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 8
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "4px 8px",
                  "backgroundColor": "#E8F8F2",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_cjBwN",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "可退改文本",
            "comId": "u_ayZdE",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "可退改"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#00A870",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_OaLPT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "免费行李标签",
            "comId": "u_5sWBO",
            "enhance": true,
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
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "4px 8px",
                  "backgroundColor": "#F2F3F5",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_5sWBO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "免费行李文本",
            "comId": "u_PMr8j",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "免费行李"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#1D1D1F",
                  "lineHeight": "17px"
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
            "title": "底部筛选栏",
            "comId": "u_gosTO",
            "layout": {
              "width": "100%",
              "height": 56,
              "position": "fixed",
              "bottom": 0,
              "left": 0
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
                  "borderTop": "1px solid #E5E5E5",
                  "padding": "0 12px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_gosTO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "直飞按钮",
            "comId": "u_van6U",
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
                  "flexDirection": "column",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_van6U",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "直飞图标",
            "comId": "u_OxYlJ",
            "layout": {
              "width": 20,
              "height": 20,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
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
          "comId": "u_van6U",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "直飞文本",
            "comId": "u_nXC3N",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "直飞优先"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_gosTO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "时间按钮",
            "comId": "u_hFfCC",
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
                  "flexDirection": "column",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_hFfCC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "时间图标",
            "comId": "u_JgyMR",
            "layout": {
              "width": 20,
              "height": 20,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "clock"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
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
          "comId": "u_hFfCC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "时间文本",
            "comId": "u_qml96",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "起飞时间"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_gosTO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格按钮",
            "comId": "u_btJGk",
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
                  "flexDirection": "column",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_btJGk",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格图标",
            "comId": "u_sVWVb",
            "layout": {
              "width": 20,
              "height": 20,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "sort"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
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
          "comId": "u_btJGk",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格文本",
            "comId": "u_9hhbC",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "价格排序"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_gosTO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "筛选按钮",
            "comId": "u_4enC1",
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
                  "flexDirection": "column",
                  "alignItems": "center",
                  "justifyContent": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_4enC1",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "筛选图标",
            "comId": "u_rH7cw",
            "layout": {
              "width": 20,
              "height": 20,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "slider_horizontal_2"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
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
          "comId": "u_4enC1",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "筛选文本",
            "comId": "u_iZyzf",
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
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "17px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        }
      ],
      "ing"
    ],
    "delay": 1647,
    "timestamp": 1768357711288
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_vpCfv",
            "title": "用户信息",
            "schema": {
              "type": "object",
              "properties": {
                "avatar": {
                  "type": "string"
                },
                "nickname": {
                  "type": "string"
                },
                "memberLevel": {
                  "type": "string"
                },
                "points": {
                  "type": "number"
                }
              }
            },
            "initValue": {
              "avatar": "https://placehold.co/70x70/0052D9/ffffff?text=ZS",
              "nickname": "张三",
              "memberLevel": "金卡会员",
              "points": 8520
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 513,
    "timestamp": 1768357711801
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_MsGBm",
            "title": "搜索条件摘要",
            "schema": {
              "type": "object",
              "properties": {
                "fromCity": {
                  "type": "string"
                },
                "toCity": {
                  "type": "string"
                },
                "date": {
                  "type": "string"
                },
                "weekday": {
                  "type": "string"
                },
                "passengers": {
                  "type": "string"
                },
                "cabin": {
                  "type": "string"
                }
              }
            },
            "initValue": {
              "fromCity": "北京",
              "toCity": "上海",
              "date": "12月25日",
              "weekday": "周三",
              "passengers": "1成人",
              "cabin": "经济舱"
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 3172,
    "timestamp": 1768357714973
  },
  {
    "type": "updatePage",
    "params": [
      "u_0KkGV",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_x8hAo",
            "title": "即将出行航班",
            "schema": {
              "type": "object",
              "properties": {
                "flightNo": {
                  "type": "string"
                },
                "departureTime": {
                  "type": "string"
                },
                "arrivalTime": {
                  "type": "string"
                },
                "departureAirport": {
                  "type": "string"
                },
                "departureCityName": {
                  "type": "string"
                },
                "arrivalAirport": {
                  "type": "string"
                },
                "arrivalCityName": {
                  "type": "string"
                },
                "duration": {
                  "type": "string"
                },
                "seatNo": {
                  "type": "string"
                },
                "gate": {
                  "type": "string"
                },
                "countdown": {
                  "type": "string"
                }
              }
            },
            "initValue": {
              "flightNo": "CA1234",
              "departureTime": "09:30",
              "arrivalTime": "12:00",
              "departureAirport": "PEK",
              "departureCityName": "北京首都",
              "arrivalAirport": "PVG",
              "arrivalCityName": "上海虹桥",
              "duration": "2h30m",
              "seatNo": "32A",
              "gate": "A12",
              "countdown": "3小时25分钟"
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 2076,
    "timestamp": 1768357717049
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_SH1Dp",
            "title": "日期列表",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "weekday": {
                    "type": "string"
                  },
                  "date": {
                    "type": "string"
                  },
                  "price": {
                    "type": "string"
                  },
                  "selected": {
                    "type": "boolean"
                  }
                }
              }
            },
            "initValue": [
              {
                "weekday": "周一",
                "date": "12/23",
                "price": "¥580起",
                "selected": false
              },
              {
                "weekday": "周二",
                "date": "12/24",
                "price": "¥620起",
                "selected": true
              },
              {
                "weekday": "周三",
                "date": "12/25",
                "price": "¥650起",
                "selected": false
              },
              {
                "weekday": "周四",
                "date": "12/26",
                "price": "¥580起",
                "selected": false
              },
              {
                "weekday": "周五",
                "date": "12/27",
                "price": "¥720起",
                "selected": false
              },
              {
                "weekday": "周六",
                "date": "12/28",
                "price": "¥890起",
                "selected": false
              },
              {
                "weekday": "周日",
                "date": "12/29",
                "price": "¥760起",
                "selected": false
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 6365,
    "timestamp": 1768357723414
  },
  {
    "type": "updatePage",
    "params": [
      "u_4zmZz",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_xOyrE",
            "title": "航班数量",
            "schema": {
              "type": "number"
            },
            "initValue": 23
          }
        }
      ],
      "ing"
    ],
    "delay": 296,
    "timestamp": 1768357723710
  }
].map(t => {
  if (t.type === 'updatePage' && t.params[0] === 'u_0KkGV') {
    t.params[0] = 'u_ail3e'
    return {
      ...t,
      delay: 1000,
    }
  }
  return null
}).filter(t => t !== null).concat(({
  "type": "updatePage",
  "params": [
      "u_ail3e",
      [],
      "complete"
  ],
  "delay": 1000
}))