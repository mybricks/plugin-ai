// @ts-nocheck
import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'

window.plugin_ai_context = context

const mockActions = `["_root_",":root","setLayout",{"height":1800, "width": 1660}]
["_root_",":root","doConfig",{"path":"root/标题","value":"快手生活服务商家中心"}]
["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column"}}]
["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#f0f2f5"}}]
["_root_","_rootSlot_","addChild",{"title":"顶部导航栏","ns":"pc.custom-container","comId":"u_top","layout":{"position":"fixed","width":"100%","height":64,"top":0,"left":0},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","boxShadow":"0 2px 8px rgba(0,0,0,0.08)"}}]}]
["u_top","content","addChild",{"title":"左侧品牌区","ns":"pc.custom-container","comId":"u_bra","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginLeft":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_bra","content","addChild",{"title":"Logo图标","ns":"pc.icon","comId":"u_log","layout":{"width":28,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"ShopOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"28px"}}]}]
["u_bra","content","addChild",{"title":"品牌文字","ns":"pc.text","comId":"u_brn","layout":{"width":"fit-content","height":"fit-content","marginRight":24},"configs":[{"path":"常规/内容","value":"快手生活服务 · 商家中心"},{"path":"样式/默认/默认","style":{"fontSize":"16px","fontWeight":"500","color":"#333333","lineHeight":"24px"}}]}]
["u_bra","content","addChild",{"title":"公告容器","ns":"pc.custom-container","comId":"u_not","enhance":true,"layout":{"width":"fit-content","height":32,"marginLeft":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#e6f7ff","borderRadius":"16px","paddingLeft":"12px","paddingRight":"12px"}}]}]
["u_not","content","addChild",{"title":"喇叭图标","ns":"pc.icon","comId":"u_bel","layout":{"width":16,"height":"fit-content","marginRight":6},"configs":[{"path":"常规/选择图标","value":"SoundOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"16px"}}]}]
["u_not","content","addChild",{"title":"公告文字","ns":"pc.text","comId":"u_ntx","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"公告 商家签署返佣协议说明"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#1890ff","lineHeight":"20px"}}]}]
["u_top","content","addChild",{"title":"右侧功能区","ns":"pc.custom-container","comId":"u_rht","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rht","content","addChild",{"title":"功能入口组","ns":"pc.custom-container","comId":"u_fun","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_fun","content","addChild",{"title":"下载入口","ns":"pc.custom-container","comId":"u_dl1","layout":{"width":56,"height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_dl1","content","addChild",{"title":"下载图标","ns":"pc.icon","comId":"u_dli","layout":{"width":20,"height":"fit-content","marginBottom":4},"configs":[{"path":"常规/选择图标","value":"DownloadOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666","fontSize":"20px"}}]}]
["u_dl1","content","addChild",{"title":"下载文字","ns":"pc.text","comId":"u_dlt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"下载"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#666666","lineHeight":"18px"}}]}]
["u_fun","content","addChild",{"title":"消息入口","ns":"pc.custom-container","comId":"u_msg","layout":{"width":56,"height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_msg","content","addChild",{"title":"消息图标","ns":"pc.icon","comId":"u_msi","layout":{"width":20,"height":"fit-content","marginBottom":4},"configs":[{"path":"常规/选择图标","value":"BellOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666","fontSize":"20px"}}]}]
["u_msg","content","addChild",{"title":"消息文字","ns":"pc.text","comId":"u_mst","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"消息"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#666666","lineHeight":"18px"}}]}]
["u_fun","content","addChild",{"title":"学堂入口","ns":"pc.custom-container","comId":"u_sch","layout":{"width":56,"height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_sch","content","addChild",{"title":"学堂图标","ns":"pc.icon","comId":"u_sci","layout":{"width":20,"height":"fit-content","marginBottom":4},"configs":[{"path":"常规/选择图标","value":"ReadOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666","fontSize":"20px"}}]}]
["u_sch","content","addChild",{"title":"学堂文字","ns":"pc.text","comId":"u_sct","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"学堂"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#666666","lineHeight":"18px"}}]}]
["u_fun","content","addChild",{"title":"规则入口","ns":"pc.custom-container","comId":"u_rul","layout":{"width":56,"height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_rul","content","addChild",{"title":"规则图标","ns":"pc.icon","comId":"u_rui","layout":{"width":20,"height":"fit-content","marginBottom":4},"configs":[{"path":"常规/选择图标","value":"FileTextOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666","fontSize":"20px"}}]}]
["u_rul","content","addChild",{"title":"规则文字","ns":"pc.text","comId":"u_rut","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"规则"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#666666","lineHeight":"18px"}}]}]
["u_fun","content","addChild",{"title":"帮助入口","ns":"pc.custom-container","comId":"u_hlp","layout":{"width":56,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_hlp","content","addChild",{"title":"帮助图标","ns":"pc.icon","comId":"u_hli","layout":{"width":20,"height":"fit-content","marginBottom":4},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666","fontSize":"20px"}}]}]
["u_hlp","content","addChild",{"title":"帮助文字","ns":"pc.text","comId":"u_hlt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"帮助"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#666666","lineHeight":"18px"}}]}]
["u_rht","content","addChild",{"title":"用户信息区","ns":"pc.custom-container","comId":"u_usr","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRadius":"20px","paddingLeft":"4px","paddingRight":"12px","paddingTop":"4px","paddingBottom":"4px"}},{"path":"样式/Hover/Hover","style":{"background":"#f5f5f5"}}]}]
["u_usr","content","addChild",{"title":"头像","ns":"pc.single-image","comId":"u_ava","layout":{"width":36,"height":36,"marginRight":8},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=avatar&w=36&h=36"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_usr","content","addChild",{"title":"用户文本区","ns":"pc.custom-container","comId":"u_utx","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_utx","content","addChild",{"title":"用户名","ns":"pc.text","comId":"u_unm","layout":{"width":"fit-content","height":"fit-content","marginBottom":2},"configs":[{"path":"常规/内容","value":"本地生活商家用户"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"20px","fontWeight":"500"}}]}]
["u_utx","content","addChild",{"title":"角色标签","ns":"pc.text","comId":"u_rol","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"门店管理员"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_usr","content","addChild",{"title":"下拉图标","ns":"pc.icon","comId":"u_drp","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"DownOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["_root_","_rootSlot_","addChild",{"title":"主体容器","ns":"pc.custom-container","comId":"u_mai","ignore":true,"layout":{"width":"100%","height":"auto","marginTop":64},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_mai","content","addChild",{"title":"左侧侧边栏","ns":"pc.custom-container","comId":"u_sid","layout":{"width":200,"height":"100vh"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","boxShadow":"2px 0 8px rgba(0,0,0,0.08)"}}]}]
["u_sid","content","addChild",{"title":"首页菜单项","ns":"pc.custom-container","comId":"u_hom","enhance":true,"layout":{"width":"100%","height":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#e6f7ff","paddingLeft":"16px"}}]}]
["u_hom","content","addChild",{"title":"首页图标","ns":"pc.icon","comId":"u_hmi","layout":{"width":18,"height":"fit-content","marginRight":12},"configs":[{"path":"常规/选择图标","value":"HomeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"18px"}}]}]
["u_hom","content","addChild",{"title":"首页文字","ns":"pc.text","comId":"u_hmt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"首页"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#1890ff","lineHeight":"22px","fontWeight":"500"}}]}]
["u_sid","content","addChild",{"title":"菜单列表","ns":"pc.menu","comId":"u_men","layout":{"width":"100%"},"configs":[{"path":"导航菜单/样式","value":"vertical"},{"path":"样式/默认/菜单","style":{"background":"transparent"}},{"path":"样式/默认/菜单项","style":{"fontSize":"14px","color":"#333333","lineHeight":"40px","paddingLeft":"16px","paddingRight":"16px"}},{"path":"样式/选中/菜单项","style":{"fontSize":"14px","color":"#1890ff","lineHeight":"40px","background":"#e6f7ff","paddingLeft":"16px","paddingRight":"16px"}},{"path":"常规/数据源","value":[{"key":"menu1","title":"店铺管理","menuType":"subMenu","icon":"ShopOutlined"},{"key":"menu2","title":"商品管理","menuType":"subMenu","icon":"ShoppingOutlined"},{"key":"menu3","title":"达人带货","menuType":"menu","icon":"UserOutlined"},{"key":"menu4","title":"订单管理","menuType":"subMenu","icon":"UnorderedListOutlined"},{"key":"menu5","title":"财务管理","menuType":"subMenu","icon":"AccountBookOutlined"},{"key":"menu6","title":"数据中心","menuType":"menu","icon":"BarChartOutlined"},{"key":"menu7","title":"智能创作","menuType":"menu","icon":"BulbOutlined"},{"key":"menu8","title":"直播助手","menuType":"menu","icon":"VideoCameraOutlined"},{"key":"menu9","title":"营销管理","menuType":"subMenu","icon":"GiftOutlined"},{"key":"menu10","title":"本地通","menuType":"menu","icon":"EnvironmentOutlined"},{"key":"menu11","title":"客服管理","menuType":"menu","icon":"CustomerServiceOutlined"},{"key":"menu12","title":"经营保障","menuType":"menu","icon":"SafetyOutlined"},{"key":"menu13","title":"服务市场","menuType":"menu","icon":"AppstoreOutlined"}]}]}]
["u_mai","content","addChild",{"title":"右侧内容区","ns":"pc.custom-container","comId":"u_con","ignore":true,"layout":{"width":"auto","height":"fit-content","marginLeft":12,"marginRight":12,"marginTop":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_con","content","addChild",{"title":"左侧主内容区","ns":"pc.custom-container","comId":"u_lft","ignore":true,"layout":{"width":"auto","height":"fit-content","marginRight":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_lft","content","addChild",{"title":"顶部Banner","ns":"pc.custom-container","comId":"u_ban","enhance":true,"layout":{"width":"100%","height":120,"marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"linear-gradient(135deg, #00b96b 0%, #00d67d 100%)","borderRadius":"8px","paddingLeft":"24px","paddingRight":"24px"}}]}]
["u_ban","content","addChild",{"title":"活动标语","ns":"pc.text","comId":"u_slo","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"抢108元端午红包"},{"path":"样式/默认/默认","style":{"fontSize":"24px","color":"#ffffff","lineHeight":"32px","fontWeight":"bold"}}]}]
["u_ban","content","addChild",{"title":"装饰图","ns":"pc.single-image","comId":"u_dec","layout":{"width":200,"height":80},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=gift&w=200&h=80"},{"path":"常规/填充模式","value":"contain"}]}]
["u_ban","content","addChild",{"title":"查看按钮","ns":"pc.custom-button","comId":"u_vie","layout":{"width":120,"height":40},"configs":[{"path":"按钮/文字标题","value":"立即查看"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"ArrowRightOutlined"},{"path":"按钮/图标配置/图标位置","value":"back"},{"path":"样式/风格","value":"primary"},{"path":"样式/默认/按钮","style":{"background":"#ffffff","color":"#00b96b","borderRadius":"20px","fontSize":"14px","fontWeight":"500"}}]}]
["u_lft","content","addChild",{"title":"交易管理卡片","ns":"pc.custom-container","comId":"u_tra","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_tra","content","addChild",{"title":"标题栏","ns":"pc.custom-container","comId":"u_tth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":16,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_tth","content","addChild",{"title":"标题文字","ns":"pc.text","comId":"u_ttt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"交易管理"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_tth","content","addChild",{"title":"输码核销链接","ns":"pc.custom-container","comId":"u_lnk","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_lnk","content","addChild",{"title":"二维码图标","ns":"pc.icon","comId":"u_qrc","layout":{"width":16,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"QrcodeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"16px"}}]}]
["u_lnk","content","addChild",{"title":"链接文字","ns":"pc.text","comId":"u_lkt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"输码核销"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#1890ff","lineHeight":"22px"}}]}]
["u_tra","content","addChild",{"title":"功能入口行","ns":"pc.custom-container","comId":"u_fen","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between"}}]}]
["u_fen","content","addChild",{"title":"订单列表入口","ns":"pc.custom-container","comId":"u_od1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_od1","content","addChild",{"title":"订单图标","ns":"pc.icon","comId":"u_od1i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"UnorderedListOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"20px"}}]}]
["u_od1","content","addChild",{"title":"订单文字","ns":"pc.text","comId":"u_od1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"订单列表"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_fen","content","addChild",{"title":"退款管理入口","ns":"pc.custom-container","comId":"u_rf1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rf1","content","addChild",{"title":"退款图标","ns":"pc.icon","comId":"u_rf1i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"ClockCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"20px"}}]}]
["u_rf1","content","addChild",{"title":"退款文字","ns":"pc.text","comId":"u_rf1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"退款管理"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_fen","content","addChild",{"title":"预约管理入口","ns":"pc.custom-container","comId":"u_ap1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_ap1","content","addChild",{"title":"预约图标","ns":"pc.icon","comId":"u_ap1i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"20px"}}]}]
["u_ap1","content","addChild",{"title":"预约文字","ns":"pc.text","comId":"u_ap1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"预约管理"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_fen","content","addChild",{"title":"配送订单入口","ns":"pc.custom-container","comId":"u_dl2","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_dl2","content","addChild",{"title":"配送图标","ns":"pc.icon","comId":"u_dl2i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"CarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"20px"}}]}]
["u_dl2","content","addChild",{"title":"配送文字","ns":"pc.text","comId":"u_dl2t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"配送订单"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_fen","content","addChild",{"title":"核销明细入口","ns":"pc.custom-container","comId":"u_vr1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vr1","content","addChild",{"title":"核销图标","ns":"pc.icon","comId":"u_vr1i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"CheckSquareOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"20px"}}]}]
["u_vr1","content","addChild",{"title":"核销文字","ns":"pc.text","comId":"u_vr1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"核销明细"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_lft","content","addChild",{"title":"待办事项卡片","ns":"pc.custom-container","comId":"u_tod","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_tod","content","addChild",{"title":"待办四列容器","ns":"pc.custom-container","comId":"u_td4","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between"}}]}]
["u_td4","content","addChild",{"title":"门店待办列","ns":"pc.custom-container","comId":"u_st1","layout":{"width":180,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_st1","content","addChild",{"title":"门店待办标题","ns":"pc.custom-container","comId":"u_st1h","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_st1h","content","addChild",{"title":"门店图标","ns":"pc.icon","comId":"u_st1i","layout":{"width":18,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"ShopOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"18px"}}]}]
["u_st1h","content","addChild",{"title":"门店标题","ns":"pc.text","comId":"u_st1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"门店待办"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px","fontWeight":"600"}}]}]
["u_st1","content","addChild",{"title":"门店待办项1","ns":"pc.custom-container","comId":"u_st11","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_st11","content","addChild",{"title":"待办文字1","ns":"pc.text","comId":"u_s11t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"门店资质不合规"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_st11","content","addChild",{"title":"待办数字1","ns":"pc.text","comId":"u_s11n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_st1","content","addChild",{"title":"门店待办项2","ns":"pc.custom-container","comId":"u_st12","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_st12","content","addChild",{"title":"待办文字2","ns":"pc.text","comId":"u_s12t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"门店头图未上传"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_st12","content","addChild",{"title":"待办数字2","ns":"pc.text","comId":"u_s12n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"23"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_st1","content","addChild",{"title":"门店待办项3","ns":"pc.custom-container","comId":"u_st13","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_st13","content","addChild",{"title":"待办文字3","ns":"pc.text","comId":"u_s13t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"门店电话未上传"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_st13","content","addChild",{"title":"待办数字3","ns":"pc.text","comId":"u_s13n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"23"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_td4","content","addChild",{"title":"商品待办列","ns":"pc.custom-container","comId":"u_pd1","layout":{"width":180,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_pd1","content","addChild",{"title":"商品待办标题","ns":"pc.custom-container","comId":"u_pd1h","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_pd1h","content","addChild",{"title":"商品图标","ns":"pc.icon","comId":"u_pd1i","layout":{"width":18,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"ShoppingOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"18px"}}]}]
["u_pd1h","content","addChild",{"title":"商品标题","ns":"pc.text","comId":"u_pd1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品待办"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px","fontWeight":"600"}}]}]
["u_pd1","content","addChild",{"title":"商品待办项1","ns":"pc.custom-container","comId":"u_pd11","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_pd11","content","addChild",{"title":"商品文字1","ns":"pc.text","comId":"u_p11t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品审核驳回"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_pd11","content","addChild",{"title":"商品数字1","ns":"pc.text","comId":"u_p11n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_pd1","content","addChild",{"title":"商品待办项2","ns":"pc.custom-container","comId":"u_pd12","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_pd12","content","addChild",{"title":"商品文字2","ns":"pc.text","comId":"u_p12t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品诊断信息"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_pd12","content","addChild",{"title":"商品数字2","ns":"pc.text","comId":"u_p12n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"12"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_pd1","content","addChild",{"title":"商品待办项3","ns":"pc.custom-container","comId":"u_pd13","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_pd13","content","addChild",{"title":"商品文字3","ns":"pc.text","comId":"u_p13t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商机中心"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_pd13","content","addChild",{"title":"商品数字3","ns":"pc.text","comId":"u_p13n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"12"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_td4","content","addChild",{"title":"达人待办列","ns":"pc.custom-container","comId":"u_kl1","layout":{"width":180,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_kl1","content","addChild",{"title":"达人待办标题","ns":"pc.custom-container","comId":"u_kl1h","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_kl1h","content","addChild",{"title":"达人图标","ns":"pc.icon","comId":"u_kl1i","layout":{"width":18,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"UserOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"18px"}}]}]
["u_kl1h","content","addChild",{"title":"达人标题","ns":"pc.text","comId":"u_kl1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"达人待办"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px","fontWeight":"600"}}]}]
["u_kl1","content","addChild",{"title":"达人待办项1","ns":"pc.custom-container","comId":"u_kl11","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_kl11","content","addChild",{"title":"达人文字1","ns":"pc.text","comId":"u_k11t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"达人申请合作"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_kl11","content","addChild",{"title":"达人数字1","ns":"pc.text","comId":"u_k11n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_td4","content","addChild",{"title":"违规预警待办列","ns":"pc.custom-container","comId":"u_vl1","layout":{"width":180,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_vl1","content","addChild",{"title":"违规预警标题","ns":"pc.custom-container","comId":"u_vl1h","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vl1h","content","addChild",{"title":"违规图标","ns":"pc.icon","comId":"u_vl1i","layout":{"width":18,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"WarningOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"18px"}}]}]
["u_vl1h","content","addChild",{"title":"违规标题","ns":"pc.text","comId":"u_vl1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"违规预警待办"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px","fontWeight":"600"}}]}]
["u_vl1","content","addChild",{"title":"违规待办项1","ns":"pc.custom-container","comId":"u_vl11","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_vl11","content","addChild",{"title":"违规文字1","ns":"pc.text","comId":"u_v11t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"店铺违规"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_vl11","content","addChild",{"title":"违规数字1","ns":"pc.text","comId":"u_v11n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ff4d4f","lineHeight":"24px","fontWeight":"600"}}]}]
["u_lft","content","addChild",{"title":"经营数据卡片","ns":"pc.custom-container","comId":"u_dat","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_dat","content","addChild",{"title":"数据标题栏","ns":"pc.custom-container","comId":"u_dth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":16,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_dth","content","addChild",{"title":"数据标题区","ns":"pc.custom-container","comId":"u_dtl","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_dtl","content","addChild",{"title":"经营数据标题","ns":"pc.text","comId":"u_dtt","layout":{"width":"fit-content","height":"fit-content","marginRight":12},"configs":[{"path":"常规/内容","value":"经营数据"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_dtl","content","addChild",{"title":"数据延迟提示","ns":"pc.text","comId":"u_dls","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"数据延迟5分钟更新，更新时间：2021/12/01 23:11"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_dtl","content","addChild",{"title":"刷新图标","ns":"pc.icon","comId":"u_rfi","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"ReloadOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_dth","content","addChild",{"title":"右侧操作区","ns":"pc.custom-container","comId":"u_dtr","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_dtr","content","addChild",{"title":"时间筛选按钮组","ns":"pc.radio","comId":"u_tim","layout":{"width":"fit-content"},"configs":[{"path":"常规/布局","value":"horizontal"},{"path":"常规/使用按钮样式","value":true},{"path":"常规/启用按钮后的按钮样式","value":"outline"},{"path":"常规/静态选项配置","value":[{"label":"今日实时","value":"today","checked":true,"key":"opt1"},{"label":"近7天","value":"week7","key":"opt2"},{"label":"近30天","value":"month30","key":"opt3"}]},{"path":"样式/尺寸","value":"small"}]}]
["u_dtr","content","addChild",{"title":"更多数据链接","ns":"pc.custom-container","comId":"u_mor","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginLeft":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_mor","content","addChild",{"title":"更多文字","ns":"pc.text","comId":"u_mrt","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"更多数据"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#1890ff","lineHeight":"22px"}}]}]
["u_mor","content","addChild",{"title":"箭头图标","ns":"pc.icon","comId":"u_ari","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"RightOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"14px"}}]}]
["u_dat","content","addChild",{"title":"数据内容区","ns":"pc.custom-container","comId":"u_dcn","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_dcn","content","addChild",{"title":"数据指标矩阵","ns":"pc.custom-container","comId":"u_mtr","ignore":true,"layout":{"width":540,"height":"fit-content","marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","flexWrap":"wrap"}}]}]
["u_mtr","content","addChild",{"title":"核销金额指标","ns":"pc.custom-container","comId":"u_vam","enhance":true,"layout":{"width":260,"height":"fit-content","marginBottom":20,"marginRight":20},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_vam","content","addChild",{"title":"核销金额标题区","ns":"pc.custom-container","comId":"u_vth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vth","content","addChild",{"title":"核销金额文字","ns":"pc.text","comId":"u_vtt","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"核销金额"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_vth","content","addChild",{"title":"问号图标","ns":"pc.icon","comId":"u_q1i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_vam","content","addChild",{"title":"核销金额数值","ns":"pc.text","comId":"u_vtn","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"17,520.22"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_vam","content","addChild",{"title":"核销金额趋势","ns":"pc.custom-container","comId":"u_vtr","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vtr","content","addChild",{"title":"较上期文字","ns":"pc.text","comId":"u_vct","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_vtr","content","addChild",{"title":"上升图标","ns":"pc.icon","comId":"u_upi","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_vtr","content","addChild",{"title":"增长比例","ns":"pc.text","comId":"u_vpr","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_mtr","content","addChild",{"title":"支付金额指标","ns":"pc.custom-container","comId":"u_pam","enhance":true,"layout":{"width":260,"height":"fit-content","marginBottom":20},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_pam","content","addChild",{"title":"支付金额标题区","ns":"pc.custom-container","comId":"u_pth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_pth","content","addChild",{"title":"支付金额文字","ns":"pc.text","comId":"u_ptt","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"支付金额"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_pth","content","addChild",{"title":"问号图标2","ns":"pc.icon","comId":"u_q2i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_pam","content","addChild",{"title":"支付金额数值","ns":"pc.text","comId":"u_ptn","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"32,000.22"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_pam","content","addChild",{"title":"支付金额趋势","ns":"pc.custom-container","comId":"u_ptr","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_ptr","content","addChild",{"title":"较上期文字2","ns":"pc.text","comId":"u_pc2t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_ptr","content","addChild",{"title":"上升图标2","ns":"pc.icon","comId":"u_up2i","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_ptr","content","addChild",{"title":"增长比例2","ns":"pc.text","comId":"u_pp2r","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_mtr","content","addChild",{"title":"退款金额指标","ns":"pc.custom-container","comId":"u_ram","enhance":true,"layout":{"width":260,"height":"fit-content","marginBottom":20,"marginRight":20},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_ram","content","addChild",{"title":"退款金额标题区","ns":"pc.custom-container","comId":"u_rth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rth","content","addChild",{"title":"退款金额文字","ns":"pc.text","comId":"u_rtt","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"退款金额"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_rth","content","addChild",{"title":"问号图标3","ns":"pc.icon","comId":"u_q3i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_ram","content","addChild",{"title":"退款金额数值","ns":"pc.text","comId":"u_rtn","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"1,520.22"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_ram","content","addChild",{"title":"退款金额趋势","ns":"pc.custom-container","comId":"u_rtr","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rtr","content","addChild",{"title":"较上期文字3","ns":"pc.text","comId":"u_rc3t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_rtr","content","addChild",{"title":"下降图标","ns":"pc.icon","comId":"u_dni","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowDownOutlined"},{"path":"样式/默认/颜色","style":{"color":"#52c41a","fontSize":"12px"}}]}]
["u_rtr","content","addChild",{"title":"下降比例","ns":"pc.text","comId":"u_rp3r","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#52c41a","lineHeight":"18px"}}]}]
["u_mtr","content","addChild",{"title":"核销券数指标","ns":"pc.custom-container","comId":"u_vcn","enhance":true,"layout":{"width":260,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_vcn","content","addChild",{"title":"核销券数标题区","ns":"pc.custom-container","comId":"u_vch","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vch","content","addChild",{"title":"核销券数文字","ns":"pc.text","comId":"u_vct2","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"核销券数"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_vch","content","addChild",{"title":"问号图标4","ns":"pc.icon","comId":"u_q4i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_vcn","content","addChild",{"title":"核销券数数值","ns":"pc.text","comId":"u_vcn2","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"520"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_vcn","content","addChild",{"title":"核销券数趋势","ns":"pc.custom-container","comId":"u_vcr","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vcr","content","addChild",{"title":"较上期文字4","ns":"pc.text","comId":"u_vc4t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_vcr","content","addChild",{"title":"上升图标4","ns":"pc.icon","comId":"u_up4i","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_vcr","content","addChild",{"title":"增长比例4","ns":"pc.text","comId":"u_vp4r","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_mtr","content","addChild",{"title":"支付订单数指标","ns":"pc.custom-container","comId":"u_pon","enhance":true,"layout":{"width":260,"height":"fit-content","marginRight":20},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_pon","content","addChild",{"title":"支付订单数标题区","ns":"pc.custom-container","comId":"u_poh","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_poh","content","addChild",{"title":"支付订单数文字","ns":"pc.text","comId":"u_pot","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"支付订单数"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_poh","content","addChild",{"title":"问号图标5","ns":"pc.icon","comId":"u_q5i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_pon","content","addChild",{"title":"支付订单数数值","ns":"pc.text","comId":"u_pon2","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"20,520"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_pon","content","addChild",{"title":"支付订单数趋势","ns":"pc.custom-container","comId":"u_por","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_por","content","addChild",{"title":"较上期文字5","ns":"pc.text","comId":"u_po5t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_por","content","addChild",{"title":"上升图标5","ns":"pc.icon","comId":"u_up5i","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_por","content","addChild",{"title":"增长比例5","ns":"pc.text","comId":"u_po5r","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_mtr","content","addChild",{"title":"退款券数指标","ns":"pc.custom-container","comId":"u_rcn","enhance":true,"layout":{"width":260,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#f5f5f5","borderRadius":"8px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"16px","paddingRight":"16px"}}]}]
["u_rcn","content","addChild",{"title":"退款券数标题区","ns":"pc.custom-container","comId":"u_rch","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rch","content","addChild",{"title":"退款券数文字","ns":"pc.text","comId":"u_rct","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"退款券数"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#666666","lineHeight":"20px"}}]}]
["u_rch","content","addChild",{"title":"问号图标6","ns":"pc.icon","comId":"u_q6i","layout":{"width":14,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"QuestionCircleOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"14px"}}]}]
["u_rcn","content","addChild",{"title":"退款券数数值","ns":"pc.text","comId":"u_rcn2","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"1000"},{"path":"样式/默认/默认","style":{"fontSize":"28px","color":"#333333","lineHeight":"36px","fontWeight":"600"}}]}]
["u_rcn","content","addChild",{"title":"退款券数趋势","ns":"pc.custom-container","comId":"u_rcr","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_rcr","content","addChild",{"title":"较上期文字6","ns":"pc.text","comId":"u_rc6t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较上期"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_rcr","content","addChild",{"title":"上升图标6","ns":"pc.icon","comId":"u_up6i","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_rcr","content","addChild",{"title":"增长比例6","ns":"pc.text","comId":"u_rc6r","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15.5%"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_dcn","content","addChild",{"title":"趋势图区域","ns":"pc.single-image","comId":"u_chr","layout":{"width":"auto","height":240},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/400x240/f0f2f5/1890ff?text=Chart"},{"path":"常规/填充模式","value":"contain"},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}}]}]
["u_lft","content","addChild",{"title":"商品经营卡片","ns":"pc.custom-container","comId":"u_pro","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_pro","content","addChild",{"title":"发布新商品板块","ns":"pc.custom-container","comId":"u_npb","enhance":true,"layout":{"width":"auto","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":24,"marginRight":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"borderRight":"1px solid #f0f0f0","paddingRight":"24px"}}]}]
["u_npb","content","addChild",{"title":"发布新商品标题","ns":"pc.text","comId":"u_npt","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"发布新商品"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_npb","content","addChild",{"title":"发布描述","ns":"pc.text","comId":"u_npd","layout":{"width":"fit-content","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/内容","value":"快速创建商品信息并发布"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#999999","lineHeight":"20px"}}]}]
["u_npb","content","addChild",{"title":"创建方式容器","ns":"pc.custom-container","comId":"u_crt","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_crt","content","addChild",{"title":"手动创建卡片","ns":"pc.custom-container","comId":"u_man","enhance":true,"layout":{"width":160,"height":80,"marginRight":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px","border":"1px solid #e8e8e8"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5","border":"1px solid #d9d9d9"}}]}]
["u_man","content","addChild",{"title":"手动图标","ns":"pc.icon","comId":"u_mni","layout":{"width":24,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"EditOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"24px"}}]}]
["u_man","content","addChild",{"title":"手动文字","ns":"pc.text","comId":"u_mnt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"手动创建"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_crt","content","addChild",{"title":"智能建品卡片","ns":"pc.custom-container","comId":"u_aic","enhance":true,"layout":{"width":160,"height":80},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px","border":"1px solid #e8e8e8"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5","border":"1px solid #d9d9d9"}}]}]
["u_aic","content","addChild",{"title":"智能图标","ns":"pc.icon","comId":"u_aii","layout":{"width":24,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"ThunderboltOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"24px"}}]}]
["u_aic","content","addChild",{"title":"智能文字","ns":"pc.text","comId":"u_ait","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"智能建品"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_pro","content","addChild",{"title":"商品信息优化板块","ns":"pc.custom-container","comId":"u_opt","enhance":true,"layout":{"width":"auto","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":12,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_opt","content","addChild",{"title":"优化标题","ns":"pc.text","comId":"u_ott","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"商品信息优化"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_opt","content","addChild",{"title":"优化描述","ns":"pc.text","comId":"u_otd","layout":{"width":"fit-content","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/内容","value":"AI智能托管，提升商品曝光度"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#999999","lineHeight":"20px"}}]}]
["u_opt","content","addChild",{"title":"智能托管卡片","ns":"pc.custom-container","comId":"u_ait2","enhance":true,"layout":{"width":"100%","height":80},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"linear-gradient(135deg, #667eea 0%, #764ba2 100%)","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"linear-gradient(135deg, #5568d3 0%, #6a3f91 100%)"}}]}]
["u_ait2","content","addChild",{"title":"AI图标","ns":"pc.icon","comId":"u_aii2","layout":{"width":28,"height":"fit-content","marginRight":12},"configs":[{"path":"常规/选择图标","value":"RobotOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ffffff","fontSize":"28px"}}]}]
["u_ait2","content","addChild",{"title":"托管文字","ns":"pc.text","comId":"u_ait3","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品信息智能托管"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#ffffff","lineHeight":"24px","fontWeight":"500"}}]}]
["u_con","content","addChild",{"title":"右侧辅助区","ns":"pc.custom-container","comId":"u_rgt","ignore":true,"layout":{"width":320,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_rgt","content","addChild",{"title":"评分卡片","ns":"pc.custom-container","comId":"u_scr","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_scr","content","addChild",{"title":"经营分板块","ns":"pc.custom-container","comId":"u_ops","enhance":true,"layout":{"width":"auto","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":24,"marginRight":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRight":"1px solid #f0f0f0","paddingRight":"24px"}}]}]
["u_ops","content","addChild",{"title":"经营分标题","ns":"pc.text","comId","layout":{"width":"fit-content","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"经营分"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#999999","lineHeight":"20px"}}]}]
["u_ops","content","addChild",{"title":"经营分分数","ns":"pc.text","comId":"u_oss","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"97.6"},{"path":"样式/默认/默认","style":{"fontSize":"32px","color":"#333333","lineHeight":"40px","fontWeight":"600"}}]}]
["u_ops","content","addChild",{"title":"经营分变化","ns":"pc.custom-container","comId":"u_osc","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_osc","content","addChild",{"title":"较昨日文字","ns":"pc.text","comId":"u_yst","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"较昨日"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_osc","content","addChild",{"title":"上升箭头","ns":"pc.icon","comId":"u_yup","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_osc","content","addChild",{"title":"变化值","ns":"pc.text","comId":"u_ych","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"0.5"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_scr","content","addChild",{"title":"用户评分板块","ns":"pc.custom-container","comId":"u_usr2","enhance":true,"layout":{"width":"auto","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":12,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_usr2","content","addChild",{"title":"用户评分标题","ns":"pc.text","comId":"u_ust","layout":{"width":"fit-content","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"用户评分"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#999999","lineHeight":"20px"}}]}]
["u_usr2","content","addChild",{"title":"用户评分分数","ns":"pc.text","comId":"u_uss","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"4.6"},{"path":"样式/默认/默认","style":{"fontSize":"32px","color":"#333333","lineHeight":"40px","fontWeight":"600"}}]}]
["u_usr2","content","addChild",{"title":"用户评分变化","ns":"pc.custom-container","comId":"u_usc","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_usc","content","addChild",{"title":"近7日新增文字","ns":"pc.text","comId":"u_u7t","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"近7日新增"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_usc","content","addChild",{"title":"上升箭头2","ns":"pc.icon","comId":"u_u7up","layout":{"width":12,"height":"fit-content","marginRight":2},"configs":[{"path":"常规/选择图标","value":"ArrowUpOutlined"},{"path":"样式/默认/颜色","style":{"color":"#ff4d4f","fontSize":"12px"}}]}]
["u_usc","content","addChild",{"title":"新增值","ns":"pc.text","comId":"u_u7ch","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"44"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_rgt","content","addChild",{"title":"常用应用卡片","ns":"pc.custom-container","comId":"u_app","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_app","content","addChild",{"title":"应用网格","ns":"pc.custom-container","comId":"u_agr","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","flexWrap":"wrap","justifyContent":"space-between"}}]}]
["u_agr","content","addChild",{"title":"我的门店应用","ns":"pc.custom-container","comId":"u_ap1","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap1","content","addChild",{"title":"门店图标","ns":"pc.icon","comId":"u_a1i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"ShopOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap1","content","addChild",{"title":"门店文字","ns":"pc.text","comId":"u_a1t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"我的门店"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"子账号管理应用","ns":"pc.custom-container","comId":"u_ap2","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap2","content","addChild",{"title":"账号图标","ns":"pc.icon","comId":"u_a2i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"TeamOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap2","content","addChild",{"title":"账号文字","ns":"pc.text","comId":"u_a2t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"子账号管理"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"商品列表应用","ns":"pc.custom-container","comId":"u_ap3","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap3","content","addChild",{"title":"列表图标","ns":"pc.icon","comId":"u_a3i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"UnorderedListOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap3","content","addChild",{"title":"商品列表文字","ns":"pc.text","comId":"u_a3t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品列表"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"商品诊断应用","ns":"pc.custom-container","comId":"u_ap4","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap4","content","addChild",{"title":"诊断图标","ns":"pc.icon","comId":"u_a4i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"MedicineBoxOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap4","content","addChild",{"title":"诊断文字","ns":"pc.text","comId":"u_a4t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"商品诊断"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"营销工具应用","ns":"pc.custom-container","comId":"u_ap5","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap5","content","addChild",{"title":"营销图标","ns":"pc.icon","comId":"u_a5i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"GiftOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap5","content","addChild",{"title":"营销文字","ns":"pc.text","comId":"u_a5t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"营销工具"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"智能创作应用","ns":"pc.custom-container","comId":"u_ap6","layout":{"width":130,"height":80,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap6","content","addChild",{"title":"智能创作图标","ns":"pc.icon","comId":"u_a6i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"BulbOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap6","content","addChild",{"title":"智能创作文字","ns":"pc.text","comId":"u_a6t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"智能创作"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"推广中心应用","ns":"pc.custom-container","comId":"u_ap7","layout":{"width":130,"height":80},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap7","content","addChild",{"title":"推广图标","ns":"pc.icon","comId":"u_a7i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"SoundOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap7","content","addChild",{"title":"推广文字","ns":"pc.text","comId":"u_a7t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"推广中心"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_agr","content","addChild",{"title":"活动报名应用","ns":"pc.custom-container","comId":"u_ap8","layout":{"width":130,"height":80},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"background":"#f0f2f5"}}]}]
["u_ap8","content","addChild",{"title":"活动报名容器","ns":"pc.custom-container","comId":"u_a8c","layout":{"position":"absolute","width":"fit-content","height":"fit-content","top":8,"right":8},"configs":[]}]
["u_a8c","content","addChild",{"title":"报名角标","ns":"pc.custom-container","comId":"u_bdg","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#ff4d4f","borderRadius":"10px","paddingLeft":"6px","paddingRight":"6px","paddingTop":"2px","paddingBottom":"2px"}}]}]
["u_bdg","content","addChild",{"title":"角标文字","ns":"pc.text","comId":"u_bdt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"去报名"},{"path":"样式/默认/默认","style":{"fontSize":"10px","color":"#ffffff","lineHeight":"14px"}}]}]
["u_ap8","content","addChild",{"title":"活动图标","ns":"pc.icon","comId":"u_a8i","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"32px"}}]}]
["u_ap8","content","addChild",{"title":"活动报名文字","ns":"pc.text","comId":"u_a8t","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"活动报名"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_rgt","content","addChild",{"title":"营销活动卡片","ns":"pc.custom-container","comId":"u_mkt","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_mkt","content","addChild",{"title":"营销活动标题栏","ns":"pc.custom-container","comId":"u_mth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":16,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_mth","content","addChild",{"title":"营销活动标题","ns":"pc.text","comId":"u_mtt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"营销活动"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_mth","content","addChild",{"title":"查看更多链接","ns":"pc.custom-container","comId":"u_vml","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_vml","content","addChild",{"title":"查看更多文字","ns":"pc.text","comId":"u_vmt","layout":{"width":"fit-content","height":"fit-content","marginRight":4},"configs":[{"path":"常规/内容","value":"查看更多"},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#1890ff","lineHeight":"20px"}}]}]
["u_vml","content","addChild",{"title":"更多箭头","ns":"pc.icon","comId":"u_vma","layout":{"width":12,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"RightOutlined"},{"path":"样式/默认/颜色","style":{"color":"#1890ff","fontSize":"12px"}}]}]
["u_mkt","content","addChild",{"title":"活动列表","ns":"pc.list-new","comId":"u_mls","layout":{"width":"100%","marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"布局/布局/布局类型","value":"vertical"},{"path":"布局/布局/列表项间隔","value":[0,12]}]}]
["u_mls","item","addChild",{"title":"活动列表项","ns":"pc.custom-container","comId":"u_mli","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}},{"path":"样式/默认/默认","style":{"background":"#fafafa","borderRadius":"8px","paddingTop":"12px","paddingBottom":"12px","paddingLeft":"12px","paddingRight":"12px"}}]}]
["u_mli","content","addChild",{"title":"活动封面","ns":"pc.single-image","comId":"u_mig","layout":{"width":80,"height":80,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=festival&w=80&h=80"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"4px"}}]}]
["u_mli","content","addChild",{"title":"活动信息区","ns":"pc.custom-container","comId":"u_min","ignore":true,"layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"space-between"}}]}]
["u_min","content","addChild",{"title":"活动标题","ns":"pc.text","comId":"u_mit","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"中秋国庆团购节"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":1},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px","fontWeight":"500"}}]}]
["u_min","content","addChild",{"title":"活动标签","ns":"pc.tagList","comId":"u_mtg","layout":{"width":"100%","marginBottom":8},"configs":[{"path":"常规/基础/方向","value":"horizontal"},{"path":"常规/基础/标签间距","value":4},{"path":"常规/数据源","value":[{"key":"tag1","content":"利益品类团购节","color":"processing"}]},{"path":"样式/默认/默认","style":{"fontSize":"11px","color":"#1890ff","background":"#e6f7ff","border":"none","lineHeight":"18px"}}]}]
["u_min","content","addChild",{"title":"活动描述","ns":"pc.text","comId":"u_mds","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"平台激发供给利益活动领域精选"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_min","content","addChild",{"title":"活动底部区","ns":"pc.custom-container","comId":"u_mbt","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_mbt","content","addChild",{"title":"报名按钮","ns":"pc.custom-button","comId":"u_mbtn","layout":{"width":72,"height":28},"configs":[{"path":"按钮/文字标题","value":"去报名"},{"path":"样式/风格","value":"primary"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","borderRadius":"14px"}}]}]
["u_mbt","content","addChild",{"title":"截止时间","ns":"pc.text","comId":"u_mdd","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2天后截止"},{"path":"样式/默认/默认","style":{"fontSize":"11px","color":"#ff4d4f","lineHeight":"18px"}}]}]
["u_rgt","content","addChild",{"title":"平台资讯卡片","ns":"pc.custom-container","comId":"u_nws","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_nws","content","addChild",{"title":"资讯标题栏","ns":"pc.custom-container","comId":"u_nth","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":20,"marginBottom":16,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_nth","content","addChild",{"title":"资讯标题","ns":"pc.text","comId":"u_ntt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"平台资讯"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#333333","lineHeight":"24px","fontWeight":"600"}}]}]
["u_nth","content","addChild",{"title":"切换按钮","ns":"pc.custom-container","comId":"u_swt","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_swt","content","addChild",{"title":"左切换","ns":"pc.icon","comId":"u_lft2","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"LeftOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"16px"}},{"path":"样式/Hover/颜色","style":{"color":"#1890ff"}}]}]
["u_swt","content","addChild",{"title":"右切换","ns":"pc.icon","comId":"u_rgt2","layout":{"width":20,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"RightOutlined"},{"path":"样式/默认/颜色","style":{"color":"#999999","fontSize":"16px"}},{"path":"样式/Hover/颜色","style":{"color":"#1890ff"}}]}]
["u_nws","content","addChild",{"title":"资讯Banner","ns":"pc.single-image","comId":"u_nba","layout":{"width":"100%","height":140,"marginBottom":16,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=guide&w=272&h=140"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}}]}]
["u_nws","content","addChild",{"title":"资讯列表","ns":"pc.custom-container","comId":"u_nll","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":20,"marginLeft":24,"marginRight":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
["u_nll","content","addChild",{"title":"资讯项1","ns":"pc.custom-container","comId":"u_ni1","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_ni1","content","addChild",{"title":"资讯标题1","ns":"pc.text","comId":"u_nt1","layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/内容","value":"这是一个公告的名称这是一个公告..."},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":1},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_ni1","content","addChild",{"title":"日期1","ns":"pc.text","comId":"u_nd1","layout":{"width":"fit-content","height":"fit-content","marginLeft":8},"configs":[{"path":"常规/内容","value":"今天"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_nll","content","addChild",{"title":"资讯项2","ns":"pc.custom-container","comId":"u_ni2","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_ni2","content","addChild",{"title":"资讯标题2","ns":"pc.text","comId":"u_nt2","layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/内容","value":"这是一个公告的名称这是一个公告..."},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":1},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_ni2","content","addChild",{"title":"日期2","ns":"pc.text","comId":"u_nd2","layout":{"width":"fit-content","height":"fit-content","marginLeft":8},"configs":[{"path":"常规/内容","value":"2022-12-01"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]
["u_nll","content","addChild",{"title":"资讯项3","ns":"pc.custom-container","comId":"u_ni3","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_ni3","content","addChild",{"title":"资讯标题3","ns":"pc.text","comId":"u_nt3","layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/内容","value":"这是一个公告的名称这是一个公告..."},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":1},{"path":"样式/默认/默认","style":{"fontSize":"13px","color":"#333333","lineHeight":"20px"}}]}]
["u_ni3","content","addChild",{"title":"日期3","ns":"pc.text","comId":"u_nd3","layout":{"width":"fit-content","height":"fit-content","marginLeft":8},"configs":[{"path":"常规/内容","value":"2022-11-30"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#999999","lineHeight":"18px"}}]}]`

// const mockActions = `["_root_",":root","setLayout",{"width":1440,"height":900}]
// ["_root_",":root","doConfig",{"path":"root/标题","value":"文件管理系统"}]
// ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"row"}}]
// ["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#f5f5f5"}}]
// ["_root_","_rootSlot_","addChild",{"title":"左侧导航栏","ns":"pc.custom-container","comId":"u_nav","layout":{"width":240,"height":"100%"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#20222a"}}]}]
// ["u_nav","content","addChild",{"title":"顶部信息区","ns":"pc.custom-container","comId":"u_top","layout":{"width":"100%","height":"fit-content","marginTop":16,"marginLeft":16,"marginRight":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center","justifyContent":"space-between"}}]}]
// ["u_top","content","addChild",{"title":"IP地址","ns":"pc.text","comId":"u_ip","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"47.111.7.45"},{"path":"样式/默认/默认","style":{"color":"#dddddd","fontSize":"14px","lineHeight":"20px"}}]}]
// ["u_top","content","addChild",{"title":"通知气泡","ns":"pc.custom-container","comId":"u_noti","layout":{"width":24,"height":24},"configs":[{"path":"常规/布局","value":{"display":"flex","alignItems":"center","justifyContent":"center"}},{"path":"样式/默认/默认","style":{"background":"#ff5722","borderRadius":"12px"}}]}]
// ["u_noti","content","addChild",{"title":"通知数字","ns":"pc.text","comId":"u_num","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"0"},{"path":"样式/默认/默认","style":{"color":"#ffffff","fontSize":"12px","lineHeight":"16px","fontWeight":"bold"}}]}]
// ["u_nav","content","addChild",{"title":"导航菜单","ns":"pc.menu","comId":"u_menu","layout":{"width":"100%","height":"fit-content","marginTop":24},"configs":[{"path":"导航菜单/样式","value":"vertical"},{"path":"样式/默认/菜单","style":{"background":"transparent"}},{"path":"样式/默认/菜单项","style":{"color":"#dddddd","fontSize":"14px","lineHeight":"40px","paddingLeft":"16px","paddingRight":"16px"}},{"path":"样式/选中/菜单项","style":{"color":"#ffffff","fontSize":"14px","lineHeight":"40px","paddingLeft":"16px","paddingRight":"16px","background":"#2c2f36"}},{"path":"常规/数据源","value":[{"key":"home","title":"首页","icon":"HomeOutlined","menuType":"menu"},{"key":"website","title":"网站","icon":"GlobalOutlined","menuType":"menu"},{"key":"ftp","title":"FTP","icon":"CloudServerOutlined","menuType":"menu"},{"key":"database","title":"数据库","icon":"DatabaseOutlined","menuType":"menu"},{"key":"docker","title":"Docker","icon":"ContainerOutlined","menuType":"menu"},{"key":"monitor","title":"监控","icon":"MonitorOutlined","menuType":"menu"},{"key":"security","title":"安全","icon":"SafetyOutlined","menuType":"menu"},{"key":"waf","title":"WAF","icon":"ShieldOutlined","menuType":"menu"},{"key":"file","title":"文件","icon":"FolderOutlined","menuType":"menu","defaultActive":true}]}]}]
// ["_root_","_rootSlot_","addChild",{"title":"右侧内容区","ns":"pc.custom-container","comId":"u_main","layout":{"width":"auto","height":"100%"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff"}}]}]
// ["u_main","content","addChild",{"title":"标签页区域","ns":"pc.tabs","comId":"u_tabs","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/外观","value":"editable-card"},{"path":"常规/可新增","value":true},{"path":"常规/可删除","value":true},{"path":"常规/隐藏插槽占位","value":true},{"path":"样式/默认/标签","style":{"fontSize":"12px","lineHeight":"32px","color":"#666666","paddingLeft":"12px","paddingRight":"8px"}},{"path":"样式/激活/标签","style":{"background":"#ffffff"}},{"path":"样式/激活/标签文本","style":{"fontSize":"12px","lineHeight":"32px","color":"#333333"}},{"path":"常规/标签项","value":[{"name":"根目录","key":"tab0","id":"tab0"},{"name":"sdk-for-ai","key":"tab1","id":"tab1"},{"name":"apaas-my-prod","key":"tab2","id":"tab2"},{"name":"server","key":"tab3","id":"tab3"},{"name":"_apps","key":"tab4","id":"tab4"},{"name":"compile","key":"tab5","id":"tab5"},{"name":"根目录","key":"tab6","id":"tab6"},{"name":"src","key":"tab7","id":"tab7"}]}]}]
// ["u_main","content","addChild",{"title":"导航工具栏","ns":"pc.custom-container","comId":"u_nav2","layout":{"width":"100%","height":"fit-content","marginTop":1},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center","justifyContent":"space-between"}},{"path":"样式/默认/默认","style":{"background":"#f8f9fa","borderBottom":"1px solid #e9ecef","paddingTop":"8px","paddingBottom":"8px","paddingLeft":"16px","paddingRight":"16px"}}]}]
// ["u_nav2","content","addChild",{"title":"面包屑导航","ns":"pc.breadcrumb","comId":"u_bread","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"面包屑/分割符","value":">"},{"path":"面包屑/数据源","value":[{"key":"root","label":"根目录"},{"key":"www","label":"www"},{"key":"wwwroot","label":"wwwroot"},{"key":"openrouter","label":"openrouter"},{"key":"src","label":"src"}]}]}]
// ["u_nav2","content","addChild",{"title":"右侧操作","ns":"pc.custom-container","comId":"u_ops","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
// ["u_ops","content","addChild",{"title":"刷新按钮","ns":"pc.icon","comId":"u_ref","layout":{"width":16,"height":"fit-content","marginRight":12},"configs":[{"path":"常规/选择图标","value":"ReloadOutlined"},{"path":"样式/默认/颜色","style":{"color":"#666666"}}]}]
// ["u_ops","content","addChild",{"title":"需求反馈","ns":"pc.text","comId":"u_feed","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"需求反馈"},{"path":"样式/默认/默认","style":{"color":"#009688","fontSize":"12px","lineHeight":"16px"}}]}]
// ["u_main","content","addChild",{"title":"操作工具栏","ns":"pc.custom-container","comId":"u_tool","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center","flexWrap":"wrap"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderBottom":"1px solid #e9ecef","paddingTop":"12px","paddingBottom":"12px","paddingLeft":"16px","paddingRight":"16px"}}]}]
// ["u_tool","content","addChild",{"title":"上传下载","ns":"pc.dropdown","comId":"u_up","layout":{"width":"fit-content","height":"fit-content","marginRight":8},"configs":[{"path":"常规/提示内容","value":"上传/下载"},{"path":"常规/触发方式","value":"click"},{"path":"常规/选项配置","value":[{"label":"上传文件","key":"upload","useIcon":true,"icon":"UploadOutlined"},{"label":"下载文件","key":"download","useIcon":true,"icon":"DownloadOutlined"}]}]}]
// ["u_tool","content","addChild",{"title":"新建","ns":"pc.dropdown","comId":"u_new","layout":{"width":"fit-content","height":"fit-content","marginRight":8},"configs":[{"path":"常规/提示内容","value":"新建"},{"path":"常规/触发方式","value":"click"},{"path":"常规/选项配置","value":[{"label":"新建文件夹","key":"folder","useIcon":true,"icon":"FolderAddOutlined"},{"label":"新建文件","key":"file","useIcon":true,"icon":"FileAddOutlined"}]}]}]
// ["u_tool","content","addChild",{"title":"收藏夹","ns":"pc.dropdown","comId":"u_fav","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/提示内容","value":"收藏夹"},{"path":"常规/触发方式","value":"click"},{"path":"常规/选项配置","value":[{"label":"添加到收藏夹","key":"add","useIcon":true,"icon":"StarOutlined"},{"label":"管理收藏夹","key":"manage","useIcon":true,"icon":"SettingOutlined"}]}]}]
// ["u_tool","content","addChild",{"title":"文件内容搜索","ns":"pc.custom-button","comId":"u_sea","layout":{"width":"fit-content","height":32,"marginRight":8},"configs":[{"path":"按钮/文字标题","value":"文件内容搜索"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"SearchOutlined"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_tool","content","addChild",{"title":"分享列表","ns":"pc.custom-button","comId":"u_sha","layout":{"width":"fit-content","height":32,"marginRight":8},"configs":[{"path":"按钮/文字标题","value":"分享列表"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_tool","content","addChild",{"title":"终端","ns":"pc.custom-button","comId":"u_ter","layout":{"width":"fit-content","height":32,"marginRight":8},"configs":[{"path":"按钮/文字标题","value":"终端"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"CodeOutlined"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_tool","content","addChild",{"title":"文件操作记录","ns":"pc.custom-button","comId":"u_log","layout":{"width":"fit-content","height":32,"marginRight":8},"configs":[{"path":"按钮/文字标题","value":"文件操作记录"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_tool","content","addChild",{"title":"查看大小","ns":"pc.custom-button","comId":"u_siz","layout":{"width":"fit-content","height":32,"marginRight":8},"configs":[{"path":"按钮/文字标题","value":"/(根目录)179G"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_tool","content","addChild",{"title":"企业级防篡改","ns":"pc.custom-button","comId":"u_pro","layout":{"width":"fit-content","height":32},"configs":[{"path":"按钮/文字标题","value":"企业级防篡改"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"fontSize":"12px","paddingLeft":"8px","paddingRight":"8px"}}]}]
// ["u_main","content","addChild",{"title":"文件列表表格","ns":"pc.table","comId":"u_tab","layout":{"width":"100%","height":"auto"},"configs":[{"path":"常规/列/列宽分配","value":"fixedWidth"},{"path":"样式/默认/表格容器","style":{"background":"#ffffff"}},{"path":"样式/默认/表头","style":{"background":"#fafafa","fontSize":"12px","color":"#666666","fontWeight":"500","borderBottom":"1px solid #e9ecef"}},{"path":"样式/默认/单元格","style":{"fontSize":"12px","color":"#333333","borderBottom":"1px solid #f0f0f0","paddingTop":"8px","paddingBottom":"8px"}},{"path":"常规/表格列","value":[{"key":"select","title":"","width":40,"contentType":"text","dataIndex":"select"},{"key":"name","title":"文件名称","width":300,"contentType":"slotItem","dataIndex":"name"},{"key":"protection","title":"企业级防篡改","width":120,"contentType":"text","dataIndex":"protection"},{"key":"permission","title":"权限/拥有者","width":120,"contentType":"text","dataIndex":"permission"},{"key":"size","title":"大小","width":100,"contentType":"slotItem","dataIndex":"size"},{"key":"time","title":"修改时间","width":180,"contentType":"text","dataIndex":"time"},{"key":"remark","title":"备注","width":100,"contentType":"text","dataIndex":"remark"}]}]}]
// ["u_tab","name","addChild",{"title":"文件名容器","ns":"pc.custom-container","comId":"u_nam","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
// ["u_nam","content","addChild",{"title":"文件图标","ns":"pc.icon","comId":"u_ico","layout":{"width":16,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"FolderFilled"},{"path":"样式/默认/颜色","style":{"color":"#ffca28"}}]}]
// ["u_nam","content","addChild",{"title":"文件名文本","ns":"pc.text","comId":"u_txt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"controllers"},{"path":"样式/默认/默认","style":{"fontSize":"12px","lineHeight":"16px","color":"#333333"}}]}]
// ["u_tab","size","addChild",{"title":"大小显示","ns":"pc.text","comId":"u_szt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"计算"},{"path":"样式/默认/默认","style":{"fontSize":"12px","lineHeight":"16px","color":"#009688"}}]}]`

window.getActions = () => {
  const parser = createActionsParser();

  const actions = parser(mockActions);

  console.log(actions)

  return actions
}

/**
 * 测试执行actions，支持组件和页面两种模式
 * @param type - 'com' 表示组件模式，'page' 表示页面模式
 * @param id - 组件ID或页面ID
 * @param delay - 每个action之间的延迟时间（毫秒），默认200ms
 */
window.testActions = async (
  type = 'page',
  id = type === 'com' ? 'u_bP96M' : 'u_zjHOb',
  delay = 200
) => {
  const api = window.plugin_ai_context.api;
  const actionsToExecute = window.getActions();
  
  if (type === 'com') {
    // 组件模式
    const updateApi = api?.uiCom?.api?.updateCom;
    if (!updateApi) {
      console.error('Component API not available');
      return;
    }
    
    // 开始执行
    await updateApi(id, [], 'start');
    
    // 遍历执行每个action
    for (let i = 0; i < actionsToExecute.length; i++) {
      // 添加延迟
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // 执行当前action
      await updateApi(id, [actionsToExecute[i]], 'ing');
    }
    
    // 最后调用空数组，参数为complete
    await new Promise((resolve) => setTimeout(resolve, delay));
    await updateApi(id, [], 'complete');
  } else {
    // 页面模式
    const updateApi = api?.page?.api?.updatePage;
    if (!updateApi) {
      console.error('Page API not available');
      return;
    }
    
    // 开始执行
    await updateApi(id, [], 'start');
    
    // 遍历执行每个action
    for (let i = 0; i < actionsToExecute.length; i++) {
      // 添加延迟
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // 执行当前action
      await updateApi(id, [actionsToExecute[i]], 'ing');
    }
    
    // 最后调用空数组，参数为complete
    await new Promise((resolve) => setTimeout(resolve, delay));
    await updateApi(id, [], 'complete');
  }
};

// Helper function to format a value as JavaScript code with proper indentation
function formatValue(value, indent = 0) {
  const indentStr = '  '.repeat(indent);
  const nextIndentStr = '  '.repeat(indent + 1);
  
  if (value === null) {
    return 'null';
  }
  
  if (value === undefined) {
    return 'undefined';
  }
  
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map(item => {
      const itemStr = formatValue(item, indent + 1);
      // Handle multi-line items
      if (itemStr.includes('\n')) {
        return `${nextIndentStr}${itemStr}`;
      }
      return `${nextIndentStr}${itemStr}`;
    }).join(',\n');
    return `[\n${items}\n${indentStr}]`;
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    const items = keys.map(key => {
      const val = formatValue(value[key], indent + 1);
      // If the value is multi-line, format it properly
      if (val.includes('\n')) {
        return `${nextIndentStr}"${key}": ${val}`;
      }
      return `${nextIndentStr}"${key}": ${val}`;
    }).join(',\n');
    return `{\n${items}\n${indentStr}}`;
  }
  
  return String(value);
}

// Helper function to format a single action object as JavaScript code
function formatAction(action, indent = 1) {
  const indentStr = '  '.repeat(indent);
  const nextIndent = indent + 1;
  const nextIndentStr = '  '.repeat(nextIndent);
  
  const parts = [];
  parts.push(`${indentStr}{`);
  
  if (action.comId !== undefined) {
    parts.push(`${nextIndentStr}"comId": ${JSON.stringify(action.comId)},`);
  }
  
  if (action.type !== undefined) {
    parts.push(`${nextIndentStr}"type": ${JSON.stringify(action.type)},`);
  }
  
  if (action.target !== undefined) {
    parts.push(`${nextIndentStr}"target": ${JSON.stringify(action.target)},`);
  }
  
  if (action.params !== undefined) {
    const paramsStr = formatValue(action.params, nextIndent);
    // Remove trailing comma from params if it's an object/array
    const cleanParams = paramsStr.replace(/,\s*$/, '');
    parts.push(`${nextIndentStr}"params": ${cleanParams}`);
  }
  
  parts.push(`${indentStr}}`);
  
  return parts.join('\n');
}

// Function to format the entire actions array as mockActions variable declaration
function formatActionsArray(actions) {
  if (actions.length === 0) {
    return 'let mockActions = [];';
  }
  
  const formattedActions = actions.map((action, index) => {
    const actionStr = formatAction(action, 1);
    return index < actions.length - 1 ? `${actionStr},` : actionStr;
  }).join('\n');
  
  return `let mockActions = [\n${formattedActions}\n];`;
}

// Main function to generate the complete actions.ts file content
window.generateActionsFile = (pageId, delay = 200) => {
  const actionsToFormat = window.getActions();
  const actionsArrayStr = formatActionsArray(actionsToFormat);
  
  const executeFunctionStr = `async function executeActionsWithDelay(pageId, actions, delay, api) {
// 开始执行
await api.updatePage(pageId, [], "start");

// 遍历执行每个action
for (let i = 0; i < actions.length; i++) {
  // 添加延迟
  await new Promise((resolve) => setTimeout(resolve, delay));

  // 执行当前action
  await api.updatePage(pageId, [actions[i]], "ing");
}

// 最后调用空数组，参数为complete
await new Promise((resolve) => setTimeout(resolve, delay));
await api.updatePage(pageId, [], "complete");
}`;

  const defaultPageId = pageId || "'u_l3x7M'";
  const executeCallStr = `\nexecuteActionsWithDelay(${defaultPageId}, mockActions, ${delay}, window.plugin_ai_context.api?.page?.api)`;

  const fullContent = `${actionsArrayStr}\n\n${executeFunctionStr}${executeCallStr}\n`;

  console.log('Generated actions.ts content:');
  console.log(fullContent);
  
  return fullContent;
};