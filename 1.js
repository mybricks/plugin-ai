[
  {
    "type": "createCanvas",
    "params": [],
    "delay": 1000,
    "timestamp": 1768288280651
  },
  {
    "type": "createPage",
    "params": [
      "u_UEuXp",
      "首页",
      {
        "type": "normal",
        "title": "首页",
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
    "delay": 1918,
    "timestamp": 1768288282569
  },
  {
    "type": "createPage",
    "params": [
      "u_UEuXp",
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
    "delay": 8,
    "timestamp": 1768288282577
  },
  {
    "type": "createPage",
    "params": [
      "u_UEuXp",
      "个人中心",
      {
        "type": "normal",
        "title": "个人中心",
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
    "delay": 4,
    "timestamp": 1768288282581
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [],
      "start"
    ],
    "delay": 57627,
    "timestamp": 1768288340208
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [],
      "start"
    ],
    "delay": 919,
    "timestamp": 1768288341127
  },
  {
    "type": "updatePage",
    "params": [
      "u_QIXGy",
      [],
      "start"
    ],
    "delay": 360,
    "timestamp": 1768288341487
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
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
            "value": "个人中心"
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
            "title": "个人信息头部",
            "comId": "u_zmYRv",
            "layout": {
              "width": "100%",
              "height": 180
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
                  "paddingLeft": "16px",
                  "paddingRight": "16px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, #0066CC 0%, #4D94D9 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_zmYRv",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "头像",
            "comId": "u_wf7kG",
            "layout": {
              "width": 60,
              "height": 60,
              "marginRight": 12
            },
            "configs": [
              {
                "path": "图片/基础属性/图片链接",
                "value": "https://placehold.co/60x60/0066CC/FFFFFF?text=ZS"
              },
              {
                "path": "样式/图片",
                "style": {
                  "borderRadius": "30px",
                  "border": "2px solid #FFFFFF"
                }
              }
            ],
            "namespace": "mybricks.harmony.image"
          }
        },
        {
          "comId": "u_zmYRv",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "用户信息容器",
            "comId": "u_Hbp5Q",
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
                  "flexDirection": "column"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_Hbp5Q",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "用户昵称",
            "comId": "u_Nlq51",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "张三"
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
          "comId": "u_Hbp5Q",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员等级标签",
            "comId": "u_fzjVb",
            "enhance": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 6
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
                  "borderRadius": "4px",
                  "paddingLeft": "8px",
                  "paddingRight": "8px",
                  "paddingTop": "2px",
                  "paddingBottom": "2px",
                  "backgroundColor": "#FFD700",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_fzjVb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员图标",
            "comId": "u_xkiA1",
            "layout": {
              "width": 12,
              "height": 12,
              "marginRight": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "star_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 12
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
          "comId": "u_fzjVb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员等级文本",
            "comId": "u_81Swg",
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
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_Hbp5Q",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "积分信息",
            "comId": "u_5TCTO",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "当前积分：12,580"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "rgba(255,255,255,0.8)",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_zmYRv",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "设置图标",
            "comId": "u_2hQ0V",
            "layout": {
              "width": 24,
              "height": 24
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "gearshape"
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
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "即将出行航班卡片",
            "comId": "u_EHvcB",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
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
                  "paddingLeft": "16px",
                  "paddingRight": "16px",
                  "paddingTop": "16px",
                  "paddingBottom": "16px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_EHvcB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题行容器",
            "comId": "u_t4SeZ",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 16
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
          "comId": "u_t4SeZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题文本",
            "comId": "u_DCtic",
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
                  "color": "#333333",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_t4SeZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查看全部",
            "comId": "u_56qLO",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "查看全部行程 >"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#0066CC",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_EHvcB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班信息主体",
            "comId": "u_wp1Nc",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 16
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
          "comId": "u_wp1Nc",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发信息",
            "comId": "u_iw6jq",
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
          "comId": "u_iw6jq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发时间",
            "comId": "u_TBNcB",
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
                  "fontSize": "24px",
                  "fontWeight": "bold",
                  "color": "#333333",
                  "lineHeight": "32px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_iw6jq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发城市",
            "comId": "u_6klai",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "北京 PEK"
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
          "comId": "u_iw6jq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发航站楼",
            "comId": "u_zRuiA",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "T3"
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
          "comId": "u_wp1Nc",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞行中间信息",
            "comId": "u_yzOFi",
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
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_yzOFi",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞机图标",
            "comId": "u_EqBu4",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 4
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_yzOFi",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "飞行时长",
            "comId": "u_2OyjV",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
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
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_wp1Nc",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达信息",
            "comId": "u_DnKLT",
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
          "comId": "u_DnKLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达时间",
            "comId": "u_TyV16",
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
                  "fontSize": "24px",
                  "fontWeight": "bold",
                  "color": "#333333",
                  "lineHeight": "32px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_DnKLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达城市",
            "comId": "u_FkfLF",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 2
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "上海 PVG"
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
          "comId": "u_DnKLT",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达航站楼",
            "comId": "u_w4ZjW",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "T2"
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
          "comId": "u_EHvcB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "底部信息行",
            "comId": "u_6OFGu",
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
                  "alignItems": "center"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_6OFGu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班号",
            "comId": "u_FauMs",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 8
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
                  "color": "#333333",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_6OFGu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位标签",
            "comId": "u_bEg3p",
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
                  "flexDirection": "row"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "paddingLeft": "6px",
                  "paddingRight": "6px",
                  "paddingTop": "2px",
                  "paddingBottom": "2px",
                  "backgroundColor": "#F5F5F5",
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
    "delay": 49483,
    "timestamp": 1768288390970
  },
  {
    "type": "updatePage",
    "params": [
      "u_QIXGy",
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
    "delay": 4332,
    "timestamp": 1768288395302
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
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
            "value": "首页"
          }
        },
        {
          "comId": "_root_",
          "type": "doConfig",
          "target": ":root",
          "params": {
            "path": "页面/顶部栏/导航栏类型",
            "value": "custom"
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
            "title": "顶部导航栏容器",
            "comId": "u_gfX3I",
            "layout": {
              "width": "100%",
              "height": 60,
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
          "comId": "u_gfX3I",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "左侧Logo区域",
            "comId": "u_ygwFO",
            "ignore": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginLeft": 16
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
          "comId": "u_ygwFO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "Logo图标",
            "comId": "u_ZC6XB",
            "layout": {
              "width": 24,
              "height": 24,
              "marginRight": 8
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
                "value": "#0066CC"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_ygwFO",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "品牌名称",
            "comId": "u_OYf6q",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "飞行助手"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#0066CC",
                  "lineHeight": "24px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_gfX3I",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右侧功能区",
            "comId": "u_tx7DF",
            "ignore": true,
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 16
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
          "comId": "u_tx7DF",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "消息图标",
            "comId": "u_GI6HZ",
            "layout": {
              "width": 24,
              "height": 24,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "bell_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
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
          "comId": "u_tx7DF",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "个人中心图标",
            "comId": "u_AevMN",
            "layout": {
              "width": 24,
              "height": 24
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "person"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 24
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
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "顶部占位",
            "comId": "u_tncjM",
            "layout": {
              "width": "100%",
              "height": 60
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
            "title": "促销轮播Banner",
            "comId": "u_l6OuK",
            "layout": {
              "width": "100%",
              "height": 160,
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16
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
                    "_id": "u_b1",
                    "thumbnail": "https://placehold.co/343x160/0066CC/FFFFFF?text=5%20OFF"
                  },
                  {
                    "_id": "u_b2",
                    "thumbnail": "https://placehold.co/343x160/FF9900/FFFFFF?text=NEW-100"
                  },
                  {
                    "_id": "u_b3",
                    "thumbnail": "https://placehold.co/343x160/2EC47B/FFFFFF?text=UPGRADE"
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
                "path": "样式/轮播",
                "style": {
                  "borderRadius": "12px",
                  "overflow": "hidden",
                  "boxShadow": "0 2px 8px rgba(0,0,0,0.05)"
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
            "title": "航班搜索核心模块",
            "comId": "u_pJ2fw",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
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
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "行程类型切换",
            "comId": "u_iuGdE",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "Tabs/基础属性/数据",
                "value": [
                  {
                    "_id": "tab_1",
                    "tabName": "单程"
                  },
                  {
                    "_id": "tab_2",
                    "tabName": "往返"
                  }
                ]
              },
              {
                "path": "Tabs/高级属性/隐藏内容",
                "value": true
              },
              {
                "path": "样式/标签栏",
                "style": {
                  "backgroundColor": "transparent",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/标签项/宽度",
                "value": "fit"
              },
              {
                "path": "样式/标签项/标签项间距",
                "value": 16
              },
              {
                "path": "样式/标签项/默认样式/默认样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#666666",
                  "padding": "8px 16px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/标签项/选中样式/选中样式",
                "style": {
                  "fontSize": "14px",
                  "color": "#FFFFFF",
                  "fontWeight": "500",
                  "padding": "8px 16px",
                  "borderRadius": "12px",
                  "backgroundColor": "#0066CC",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/选中条",
                "style": {
                  "display": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.tabs"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发城市选择",
            "comId": "u_1igOc",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "下拉选择/基础属性/提示内容",
                "value": "请选择出发城市"
              },
              {
                "path": "下拉选择/基础属性/选项",
                "value": [
                  {
                    "label": "北京 PEK",
                    "value": "北京"
                  },
                  {
                    "label": "上海 SHA",
                    "value": "上海"
                  },
                  {
                    "label": "广州 CAN",
                    "value": "广州"
                  },
                  {
                    "label": "深圳 SZX",
                    "value": "深圳"
                  },
                  {
                    "label": "成都 CTU",
                    "value": "成都"
                  }
                ]
              },
              {
                "path": "样式/箭头",
                "value": "right"
              },
              {
                "path": "样式/箭头样式",
                "style": {
                  "color": "#0066CC"
                }
              },
              {
                "path": "样式/输入框",
                "style": {
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "padding": "12px",
                  "backgroundColor": "#F5F7FA",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/内容文本",
                "style": {
                  "fontSize": "16px",
                  "color": "#333333",
                  "fontWeight": "500"
                }
              },
              {
                "path": "样式/提示内容文本",
                "style": {
                  "fontSize": "14px",
                  "color": "#999999"
                }
              }
            ],
            "namespace": "mybricks.harmony.formSelect"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市互换按钮",
            "comId": "u_t2okA",
            "enhance": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 8
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
          "comId": "u_t2okA",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "互换图标",
            "comId": "u_wK1MK",
            "layout": {
              "width": 32,
              "height": 32
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_clockwise"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 20
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0066CC"
              },
              {
                "path": "样式/图标",
                "style": {
                  "borderRadius": "50%",
                  "padding": "6px",
                  "backgroundColor": "#F0F0F0",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "到达城市选择",
            "comId": "u_0QKnI",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 8,
              "marginLeft": 16,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "下拉选择/基础属性/提示内容",
                "value": "请选择到达城市"
              },
              {
                "path": "下拉选择/基础属性/选项",
                "value": [
                  {
                    "label": "北京 PEK",
                    "value": "北京"
                  },
                  {
                    "label": "上海 SHA",
                    "value": "上海"
                  },
                  {
                    "label": "广州 CAN",
                    "value": "广州"
                  },
                  {
                    "label": "深圳 SZX",
                    "value": "深圳"
                  },
                  {
                    "label": "成都 CTU",
                    "value": "成都"
                  }
                ]
              },
              {
                "path": "样式/箭头",
                "value": "right"
              },
              {
                "path": "样式/箭头样式",
                "style": {
                  "color": "#0066CC"
                }
              },
              {
                "path": "样式/输入框",
                "style": {
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "padding": "12px",
                  "backgroundColor": "#F5F7FA",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/内容文本",
                "style": {
                  "fontSize": "16px",
                  "color": "#333333",
                  "fontWeight": "500"
                }
              },
              {
                "path": "样式/提示内容文本",
                "style": {
                  "fontSize": "14px",
                  "color": "#999999"
                }
              }
            ],
            "namespace": "mybricks.harmony.formSelect"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "出发日期选择",
            "comId": "u_OtbgU",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "下拉选择/基础属性/提示内容",
                "value": "请选择出发日期"
              },
              {
                "path": "下拉选择/基础属性/选项",
                "value": [
                  {
                    "label": "12月25日 周三",
                    "value": "2024-12-25"
                  },
                  {
                    "label": "12月26日 周四",
                    "value": "2024-12-26"
                  },
                  {
                    "label": "12月27日 周五",
                    "value": "2024-12-27"
                  }
                ]
              },
              {
                "path": "样式/箭头",
                "value": "right"
              },
              {
                "path": "样式/箭头样式",
                "style": {
                  "color": "#0066CC"
                }
              },
              {
                "path": "样式/输入框",
                "style": {
                  "border": "1px solid #E5E5E5",
                  "borderRadius": "8px",
                  "padding": "12px",
                  "backgroundColor": "#F5F7FA",
                  "backgroundImage": "none"
                }
              },
              {
                "path": "样式/内容文本",
                "style": {
                  "fontSize": "14px",
                  "color": "#333333"
                }
              },
              {
                "path": "样式/提示内容文本",
                "style": {
                  "fontSize": "12px",
                  "color": "#999999"
                }
              }
            ],
            "namespace": "mybricks.harmony.formSelect"
          }
        },
        {
          "comId": "u_pJ2fw",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "搜索按钮",
            "comId": "u_D5zQl",
            "layout": {
              "width": "100%",
              "height": 48,
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16,
              "marginBottom": 16
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "搜索航班"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "color": "#FFFFFF",
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "borderRadius": "12px",
                  "border": "none",
                  "backgroundColor": "#0066CC",
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
            "title": "快捷入口网格",
            "comId": "u_9dboS",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "justifyContent": "space-between",
                  "alignItems": "center",
                  "flexWrap": "wrap"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "改签查询",
            "comId": "u_KYCGb",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": "fit-content",
              "marginBottom": 20
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
    "delay": 1520,
    "timestamp": 1768288396822
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [
        {
          "comId": "u_bEg3p",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "舱位文本",
            "comId": "u_kiySd",
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
                  "color": "#666666",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_6OFGu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "状态文本",
            "comId": "u_KVzVt",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "准点"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#2EC47B",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_EHvcB",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "操作按钮行",
            "comId": "u_bVwrp",
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
                  "justifyContent": "space-between"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_bVwrp",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "办理值机按钮",
            "comId": "u_7kTbO",
            "layout": {
              "width": "100%",
              "height": 40,
              "marginRight": 8
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "办理值机"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "color": "#FFFFFF",
                  "fontSize": "14px",
                  "borderRadius": "8px",
                  "backgroundColor": "#0066CC",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.button"
          }
        },
        {
          "comId": "u_bVwrp",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班动态按钮",
            "comId": "u_LXq1d",
            "layout": {
              "width": "100%",
              "height": 40
            },
            "configs": [
              {
                "path": "按钮/基础属性/按钮文案",
                "value": "航班动态"
              },
              {
                "path": "样式/默认/按钮",
                "style": {
                  "color": "#0066CC",
                  "fontSize": "14px",
                  "border": "1px solid #0066CC",
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
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "常用功能标题",
            "comId": "u_39Inn",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginBottom": 12
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
                  "color": "#333333",
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
            "title": "常用功能菜单",
            "comId": "u_dbOSI",
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
                  "paddingTop": "16px",
                  "paddingBottom": "16px",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_dbOSI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "第一行功能",
            "comId": "u_3MdDC",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginBottom": 16
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "row",
                  "justifyContent": "space-around"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_3MdDC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "我的订单",
            "comId": "u_ZKrQZ",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_ZKrQZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单图标",
            "comId": "u_2NoOv",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "doc_plaintext"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_ZKrQZ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单文本",
            "comId": "u_IsTOn",
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
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_3MdDC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "常用乘机人",
            "comId": "u_vCbMx",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_vCbMx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "乘机人图标",
            "comId": "u_n9tG9",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "person_2"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_vCbMx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "乘机人文本",
            "comId": "u_cnMld",
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
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_3MdDC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券",
            "comId": "u_RXcU0",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_RXcU0",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券图标",
            "comId": "u_G8gWM",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "case_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_RXcU0",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "优惠券文本",
            "comId": "u_CpgH3",
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
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_3MdDC",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员权益",
            "comId": "u_OcvQ4",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_OcvQ4",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员图标",
            "comId": "u_Z7vmw",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "star_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#FF9900"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_OcvQ4",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员文本",
            "comId": "u_ce3mD",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "会员权益"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_dbOSI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "第二行功能",
            "comId": "u_EaL7G",
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
                  "justifyContent": "space-around"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        }
      ],
      "ing"
    ],
    "delay": 33473,
    "timestamp": 1768288430295
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [
        {
          "comId": "u_EaL7G",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "里程兑换",
            "comId": "u_0Rrer",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_0Rrer",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "里程图标",
            "comId": "u_r6nev",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_clockwise"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_0Rrer",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "里程文本",
            "comId": "u_MExzh",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "里程兑换"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_EaL7G",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "退改签",
            "comId": "u_Tz3h9",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_Tz3h9",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "退改签图标",
            "comId": "u_gsBdG",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_counterclockwise"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_Tz3h9",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "退改签文本",
            "comId": "u_JWsIB",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "退改签"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_EaL7G",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服中心",
            "comId": "u_IqQtn",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_IqQtn",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服图标",
            "comId": "u_2rj6q",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "message"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_IqQtn",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服文本",
            "comId": "u_VXTP7",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "客服中心"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_EaL7G",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多服务",
            "comId": "u_aTeDj",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_aTeDj",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多图标",
            "comId": "u_P8xz1",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "more"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_aTeDj",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多文本",
            "comId": "u_Fsx8M",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "更多服务"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#333333",
                  "lineHeight": "16px"
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
            "title": "推荐标题",
            "comId": "u_9s4qY",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginBottom": 12
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "为你推荐"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#333333",
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
            "title": "推荐卡片容器",
            "comId": "u_P3qxD",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginLeft": 16
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
                  "overflow": "scroll"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_P3qxD",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "推荐卡片1",
            "comId": "u_PxXFh",
            "enhance": true,
            "layout": {
              "width": 280,
              "height": 120,
              "marginRight": 12
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "column",
                  "justifyContent": "flex-end"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "12px",
                  "paddingLeft": "16px",
                  "paddingBottom": "16px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, rgba(0,102,204,0.9) 0%, rgba(77,148,217,0.9) 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_PxXFh",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "限时标签",
            "comId": "u_cgbL5",
            "layout": {
              "position": "absolute",
              "width": "fit-content",
              "height": "fit-content",
              "top": 8,
              "right": 8
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
                  "paddingLeft": "8px",
                  "paddingRight": "8px",
                  "paddingTop": "2px",
                  "paddingBottom": "2px",
                  "backgroundColor": "#FF9900",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_cgbL5",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标签文本",
            "comId": "u_IXY5f",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "限时"
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
        }
      ],
      "ing"
    ],
    "delay": 1261,
    "timestamp": 1768288431556
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "comId": "u_KYCGb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "改签图标",
            "comId": "u_gBcPt",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "arrow_clockwise"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_KYCGb",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "改签文字",
            "comId": "u_fstyX",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "改签查询"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单管理",
            "comId": "u_HZbe3",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": "fit-content",
              "marginBottom": 20
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
          "comId": "u_HZbe3",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单图标",
            "comId": "u_ciF7M",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "list_square_bill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_HZbe3",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "订单文字",
            "comId": "u_eXRmL",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "订单管理"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价日历",
            "comId": "u_gvF47",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": "fit-content",
              "marginBottom": 20
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
          "comId": "u_gvF47",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日历图标",
            "comId": "u_l5xG1",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "calendar"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_gvF47",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "日历文字",
            "comId": "u_fhJv4",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "特价日历"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "值机选座",
            "comId": "u_9unnq",
            "enhance": true,
            "layout": {
              "width": 80,
              "height": "fit-content",
              "marginBottom": 20
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
          "comId": "u_9unnq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "值机图标",
            "comId": "u_uSMsB",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "checkmark_square"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_9unnq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "值机文字",
            "comId": "u_we1Jm",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "值机选座"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "航班动态",
            "comId": "u_VkqYt",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_VkqYt",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "动态图标",
            "comId": "u_J0uW4",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "airplane_fill"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#0066CC"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        }
      ],
      "ing"
    ],
    "delay": 5869,
    "timestamp": 1768288437425
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "comId": "u_VkqYt",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "动态文字",
            "comId": "u_dLNM2",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "航班动态"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "积分商城",
            "comId": "u_zOD45",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_zOD45",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "积分图标",
            "comId": "u_hA4QR",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "star"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_zOD45",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "积分文字",
            "comId": "u_2gJ6J",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "积分商城"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "旅行保险",
            "comId": "u_z1xtI",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_z1xtI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "保险图标",
            "comId": "u_359JK",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "checkmark_shield"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_z1xtI",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "保险文字",
            "comId": "u_OVJ8t",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "旅行保险"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
                  "lineHeight": "18px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_9dboS",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服中心",
            "comId": "u_PzpPX",
            "enhance": true,
            "layout": {
              "width": 80,
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
          "comId": "u_PzpPX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服图标",
            "comId": "u_5z3qb",
            "layout": {
              "width": 32,
              "height": 32,
              "marginBottom": 8
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "message"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 32
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
          "comId": "u_PzpPX",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "客服文字",
            "comId": "u_rF3RO",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "客服中心"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "#666666",
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
            "title": "热门目的地模块",
            "comId": "u_2nS0k",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
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
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_2nS0k",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题栏",
            "comId": "u_51pOm",
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
          "comId": "u_51pOm",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "标题文字",
            "comId": "u_mDBWe",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "热门目的地"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#333333",
                  "lineHeight": "24px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_51pOm",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "查看更多",
            "comId": "u_WjNFq",
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
          "comId": "u_WjNFq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "更多文字",
            "comId": "u_1akqE",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginRight": 4
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "查看更多"
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
          "comId": "u_WjNFq",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "右箭头",
            "comId": "u_ZSkiH",
            "layout": {
              "width": 12,
              "height": 12
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "chevron_right"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 12
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
          "comId": "u_2nS0k",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "目的地列表",
            "comId": "u_hi4fa",
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
                    "cityName": "成都",
                    "price": "599",
                    "imageUrl": "https://ai.mybricks.world/image-search?term=chengdu&w=140&h=100",
                    "isSpecial": true
                  },
                  {
                    "id": "2",
                    "cityName": "三亚",
                    "price": "899",
                    "imageUrl": "https://ai.mybricks.world/image-search?term=sanya&w=140&h=100",
                    "isSpecial": false
                  },
                  {
                    "id": "3",
                    "cityName": "厦门",
                    "price": "699",
                    "imageUrl": "https://ai.mybricks.world/image-search?term=xiamen&w=140&h=100",
                    "isSpecial": true
                  },
                  {
                    "id": "4",
                    "cityName": "西安",
                    "price": "499",
                    "imageUrl": "https://ai.mybricks.world/image-search?term=xian&w=140&h=100",
                    "isSpecial": false
                  },
                  {
                    "id": "5",
                    "cityName": "重庆",
                    "price": "549",
                    "imageUrl": "https://ai.mybricks.world/image-search?term=chongqing&w=140&h=100",
                    "isSpecial": false
                  }
                ]
              },
              {
                "path": "循环列表/基础属性/排列方向",
                "value": "row"
              },
              {
                "path": "循环列表/基础属性/间距",
                "value": 12
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
          "comId": "u_hi4fa",
          "type": "addChild",
          "target": "item",
          "params": {
            "title": "目的地卡片",
            "comId": "u_yZPsa",
            "enhance": true,
            "layout": {
              "width": 140,
              "height": 180
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
                  "overflow": "hidden",
                  "backgroundColor": "#FFFFFF",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_yZPsa",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "图片容器",
            "comId": "u_4dPXH",
            "layout": {
              "width": "100%",
              "height": 100,
              "position": "absolute",
              "top": 0,
              "left": 0
            },
            "configs": [],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_4dPXH",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市图片",
            "comId": "u_CU9fq",
            "layout": {
              "width": "100%",
              "height": "100%"
            },
            "configs": [
              {
                "path": "图片/基础属性/图片链接",
                "value": "https://ai.mybricks.world/image-search?term=city&w=140&h=100"
              },
              {
                "path": "图片/高级属性/展示方式",
                "value": "aspectFill"
              }
            ],
            "namespace": "mybricks.harmony.image"
          }
        },
        {
          "comId": "u_4dPXH",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价标签",
            "comId": "u_9xqvu",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "position": "absolute",
              "top": 8,
              "left": 8
            },
            "configs": [
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "4px",
                  "padding": "2px 8px",
                  "backgroundColor": "#2EC47B",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_9xqvu",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "特价文字",
            "comId": "u_kswsZ",
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
                  "lineHeight": "16px",
                  "fontWeight": "500"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_yZPsa",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "信息区域",
            "comId": "u_3WLSP",
            "ignore": true,
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 100
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
          "comId": "u_3WLSP",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "城市名称",
            "comId": "u_QrhbP",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 12
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "成都"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "14px",
                  "fontWeight": "bold",
                  "color": "#333333",
                  "lineHeight": "20px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_3WLSP",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "价格标签",
            "comId": "u_uyTcq",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginTop": 4,
              "marginBottom": 12
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "¥599起"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "16px",
                  "fontWeight": "bold",
                  "color": "#FF9900",
                  "lineHeight": "22px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        }
      ],
      "ing"
    ],
    "delay": 794,
    "timestamp": 1768288438219
  },
  {
    "type": "updatePage",
    "params": [
      "u_QIXGy",
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
            "comId": "u_IavwK",
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
          "comId": "u_IavwK",
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
          "comId": "u_IavwK",
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
    "delay": 2013,
    "timestamp": 1768288440232
  },
  {
    "type": "updatePage",
    "params": [
      "u_QIXGy",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_R6hQy",
            "title": "日期切换列表",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "week": {
                    "type": "string"
                  },
                  "day": {
                    "type": "string"
                  },
                  "price": {
                    "type": "string"
                  },
                  "isSelected": {
                    "type": "boolean"
                  }
                }
              }
            },
            "initValue": [
              {
                "id": "1",
                "week": "周一",
                "day": "23",
                "price": "¥620起",
                "isSelected": false
              },
              {
                "id": "2",
                "week": "周二",
                "day": "24",
                "price": "¥590起",
                "isSelected": false
              },
              {
                "id": "3",
                "week": "周三",
                "day": "25",
                "price": "¥580起",
                "isSelected": true
              },
              {
                "id": "4",
                "week": "周四",
                "day": "26",
                "price": "¥600起",
                "isSelected": false
              },
              {
                "id": "5",
                "week": "周五",
                "day": "27",
                "price": "¥680起",
                "isSelected": false
              },
              {
                "id": "6",
                "week": "周六",
                "day": "28",
                "price": "¥750起",
                "isSelected": false
              },
              {
                "id": "7",
                "week": "周日",
                "day": "29",
                "price": "¥720起",
                "isSelected": false
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 1283,
    "timestamp": 1768288441515
  },
  {
    "type": "updatePage",
    "params": [
      "u_QIXGy",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": "u_tQlMI",
            "slotId": "item",
            "id": "u_3wQF1",
            "title": "当前日期项",
            "schema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                },
                "week": {
                  "type": "string"
                },
                "day": {
                  "type": "string"
                },
                "price": {
                  "type": "string"
                },
                "isSelected": {
                  "type": "boolean"
                }
              }
            },
            "initValue": {
              "id": "",
              "week": "",
              "day": "",
              "price": "",
              "isSelected": false
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 9151,
    "timestamp": 1768288450666
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "底部占位区域",
            "comId": "u_3ZxES",
            "layout": {
              "width": "100%",
              "height": 60
            },
            "configs": [],
            "namespace": "mybricks.harmony.containerBasic"
          }
        }
      ],
      "ing"
    ],
    "delay": 424,
    "timestamp": 1768288451090
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_q8yJ7",
            "title": "轮播图数据源",
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
                  "subtitle": {
                    "type": "string"
                  }
                }
              }
            },
            "initValue": [
              {
                "imageUrl": "https://placehold.co/343x160/0066CC/FFFFFF?text=5%20OFF",
                "title": "双11特惠",
                "subtitle": "全场机票5折起"
              },
              {
                "imageUrl": "https://placehold.co/343x160/FF9900/FFFFFF?text=NEW-100",
                "title": "新用户专享",
                "subtitle": "立减100元"
              },
              {
                "imageUrl": "https://placehold.co/343x160/2EC47B/FFFFFF?text=UPGRADE",
                "title": "积分兑换",
                "subtitle": "免费升舱"
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 211,
    "timestamp": 1768288451301
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_5v7S0",
            "title": "热门目的地数据源",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "cityName": {
                    "type": "string"
                  },
                  "price": {
                    "type": "string"
                  },
                  "imageUrl": {
                    "type": "string"
                  },
                  "isSpecial": {
                    "type": "boolean"
                  }
                }
              }
            },
            "initValue": [
              {
                "id": "1",
                "cityName": "成都",
                "price": "599",
                "imageUrl": "https://ai.mybricks.world/image-search?term=chengdu&w=140&h=100",
                "isSpecial": true
              },
              {
                "id": "2",
                "cityName": "三亚",
                "price": "899",
                "imageUrl": "https://ai.mybricks.world/image-search?term=sanya&w=140&h=100",
                "isSpecial": false
              },
              {
                "id": "3",
                "cityName": "厦门",
                "price": "699",
                "imageUrl": "https://ai.mybricks.world/image-search?term=xiamen&w=140&h=100",
                "isSpecial": true
              },
              {
                "id": "4",
                "cityName": "西安",
                "price": "499",
                "imageUrl": "https://ai.mybricks.world/image-search?term=xian&w=140&h=100",
                "isSpecial": false
              },
              {
                "id": "5",
                "cityName": "重庆",
                "price": "549",
                "imageUrl": "https://ai.mybricks.world/image-search?term=chongqing&w=140&h=100",
                "isSpecial": false
              }
            ]
          }
        }
      ],
      "ing"
    ],
    "delay": 129,
    "timestamp": 1768288451430
  },
  {
    "type": "updatePage",
    "params": [
      "u_CsKsu",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_Zf2DT",
            "title": "搜索表单数据",
            "schema": {
              "type": "object",
              "properties": {
                "tripType": {
                  "type": "string"
                },
                "departCity": {
                  "type": "string"
                },
                "arriveCity": {
                  "type": "string"
                },
                "departDate": {
                  "type": "string"
                },
                "returnDate": {
                  "type": "string"
                }
              }
            },
            "initValue": {
              "tripType": "单程",
              "departCity": "",
              "arriveCity": "",
              "departDate": "",
              "returnDate": ""
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 82,
    "timestamp": 1768288451512
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [
        {
          "comId": "u_PxXFh",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "卡片标题",
            "comId": "u_mR0oU",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "春节机票早鸟特惠"
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
          "comId": "u_PxXFh",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "卡片副标题",
            "comId": "u_BNbSj",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "提前30天预订最高立减300元"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "rgba(255,255,255,0.9)",
                  "lineHeight": "16px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_P3qxD",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "推荐卡片2",
            "comId": "u_4z04J",
            "enhance": true,
            "layout": {
              "width": 280,
              "height": 120,
              "marginRight": 12
            },
            "configs": [
              {
                "path": "容器/基础属性/布局",
                "value": {
                  "display": "flex",
                  "flexDirection": "column",
                  "justifyContent": "flex-end"
                }
              },
              {
                "path": "样式/样式",
                "style": {
                  "borderRadius": "12px",
                  "paddingLeft": "16px",
                  "paddingBottom": "16px",
                  "backgroundColor": "transparent",
                  "backgroundImage": "linear-gradient(135deg, rgba(255,153,0,0.9) 0%, rgba(255,204,102,0.9) 100%)"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_4z04J",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "会员专享标签",
            "comId": "u_0g5eD",
            "layout": {
              "position": "absolute",
              "width": "fit-content",
              "height": "fit-content",
              "top": 8,
              "right": 8
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
                  "paddingLeft": "8px",
                  "paddingRight": "8px",
                  "paddingTop": "2px",
                  "paddingBottom": "2px",
                  "backgroundColor": "#FFD700",
                  "backgroundImage": "none"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_0g5eD",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "专享标签文本",
            "comId": "u_6nuVe",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "会员专享"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "10px",
                  "color": "#333333",
                  "lineHeight": "14px"
                }
              }
            ],
            "namespace": "mybricks.harmony.text"
          }
        },
        {
          "comId": "u_4z04J",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "卡片标题2",
            "comId": "u_rP0ZH",
            "layout": {
              "width": "fit-content",
              "height": "fit-content",
              "marginBottom": 6
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "里程兑换好礼"
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
          "comId": "u_4z04J",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "卡片副标题2",
            "comId": "u_GvBuq",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "积分兑换升舱券和贵宾厅权益"
              },
              {
                "path": "样式/样式",
                "style": {
                  "fontSize": "12px",
                  "color": "rgba(255,255,255,0.9)",
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
    "delay": 14928,
    "timestamp": 1768288466440
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [
        {
          "comId": "_root_",
          "type": "addChild",
          "target": "_rootSlot_",
          "params": {
            "title": "底部安全信息",
            "comId": "u_mjNrx",
            "layout": {
              "width": "100%",
              "height": "fit-content",
              "marginTop": 16,
              "marginLeft": 16,
              "marginRight": 16,
              "marginBottom": 16
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
                  "paddingTop": "12px",
                  "paddingBottom": "12px"
                }
              }
            ],
            "namespace": "mybricks.harmony.containerBasic"
          }
        },
        {
          "comId": "u_mjNrx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "实名认证信息",
            "comId": "u_0HZvJ",
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
          "comId": "u_0HZvJ",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "盾牌图标",
            "comId": "u_beSap",
            "layout": {
              "width": 16,
              "height": 16,
              "marginRight": 6
            },
            "configs": [
              {
                "path": "图标/基础属性/图标",
                "value": "checkmark_shield"
              },
              {
                "path": "图标/基础属性/大小",
                "value": 16
              },
              {
                "path": "图标/高级属性/颜色",
                "value": "#2EC47B"
              }
            ],
            "namespace": "mybricks.harmony.icon"
          }
        },
        {
          "comId": "u_mjNrx",
          "type": "addChild",
          "target": "content",
          "params": {
            "title": "保险文本",
            "comId": "u_RBgNU",
            "layout": {
              "width": "fit-content",
              "height": "fit-content"
            },
            "configs": [
              {
                "path": "文本/基础属性/文本内容",
                "value": "已为您的账户投保"
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
    "delay": 876,
    "timestamp": 1768288467316
  },
  {
    "type": "updatePage",
    "params": [
      "u_KrAZ5",
      [
        {
          "type": "defineVar",
          "params": {
            "comId": null,
            "slotId": "_root_",
            "id": "u_iERX2",
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
              "avatar": "https://placehold.co/60x60/0066CC/FFFFFF?text=ZS",
              "nickname": "张三",
              "memberLevel": "金卡会员",
              "points": 12580
            }
          }
        }
      ],
      "ing"
    ],
    "delay": 492,
    "timestamp": 1768288467808
  }
].map(t => {
  if (t.type === 'updatePage' && t.params[0] === 'u_QIXGy') {
    t.params[0] = 'u_ail3e'
    return {
      ...t,
      delay: 1000,
    }
  }
  return null
}).filter(t => t !== null)