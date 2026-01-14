[
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
          [],
          "start"
      ],
      "delay": 1000,
      "timestamp": 1768288340208
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
      "delay": 1000,
      "timestamp": 1768288390970
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
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
      "delay": 1000,
      "timestamp": 1768288430295
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
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
      "delay": 1000,
      "timestamp": 1768288431556
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
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
      "delay": 1000,
      "timestamp": 1768288466440
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
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
      "delay": 1000,
      "timestamp": 1768288467316
  },
  {
      "type": "updatePage",
      "params": [
          "u_ail3e",
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
      "delay": 1000,
      "timestamp": 1768288467808
  },
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