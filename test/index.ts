// @ts-nocheck
import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'

window.plugin_ai_context = context

// ========== 默认配置变量 ==========
// 可以在这里修改默认值，方便测试时调整
const DEFAULT_TYPE = 'page'; // 'com' 或 'page'
const DEFAULT_COM_ID = 'u_bP96M'; // 默认组件ID
const DEFAULT_PAGE_ID = 'u_ail3e'; // 默认页面ID
const DEFAULT_TEST_DELAY = 10; // testActions 默认延迟（毫秒）
const DEFAULT_GENERATE_DELAY = 200; // generateActionsFile 默认延迟（毫秒）
// ==================================

const mockActions = `["_root_",":root","setLayout",{"height":1600}]
["_root_",":root","doConfig",{"path":"页面/顶部栏/标题","value":"基金投资"}]
["_root_",":root","doConfig",{"path":"页面/顶部栏/导航栏类型","value":"default"}]
["_root_",":root","doConfig",{"path":"页面/内容区/布局","value":{"display":"flex","flexDirection":"column"}}]
["_root_",":root","doConfig",{"path":"样式/内容区/背景","style":{"background":"linear-gradient(180deg, #1A365D 0%, #2D5A87 100%)"}}]
["_root_","_rootSlot_","addChild",{"title":"顶部导航区","ns":"mb.containerBasic","comId":"u_nav","layout":{"width":"100%","height":"fit-content","marginTop":0,"marginTop": 15,"marginLeft":15,"marginRight":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/样式","style":{"background":"#FFFFFF","borderRadius":"12px","padding":"15px"}}]}]
["u_nav","content","addChild",{"title":"左侧用户信息","ns":"mb.containerBasic","comId":"u_usr","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_usr","content","addChild",{"title":"用户头像","ns":"mb.image","comId":"u_avt","layout":{"width":40,"height":40,"marginRight":10},"configs":[{"path":"图片/基础属性/图片链接","value":"https://placehold.co/40x40/1A365D/ffffff?text=U"},{"path":"样式/图片","style":{"borderRadius":"50%"}}]}]
["u_usr","content","addChild",{"title":"问候语","ns":"mb.text","comId":"u_grt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"早安，投资者"},{"path":"样式/样式","style":{"fontSize":"16px","color":"#262626","fontWeight":"500"}}]}]
["u_nav","content","addChild",{"title":"右侧功能图标","ns":"mb.containerBasic","comId":"u_ico","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_ico","content","addChild",{"title":"消息图标","ns":"mb.icon","comId":"u_msg","layout":{"width":24,"height":24,"marginRight":15},"configs":[{"path":"图标/基础属性/图标","value":"message"},{"path":"图标/高级属性/颜色","value":"#595959"}]}]
["u_ico","content","addChild",{"title":"搜索图标","ns":"mb.icon","comId":"u_src","layout":{"width":24,"height":24,"marginRight":15},"configs":[{"path":"图标/基础属性/图标","value":"magnifyingglass"},{"path":"图标/高级属性/颜色","value":"#595959"}]}]
["u_ico","content","addChild",{"title":"设置图标","ns":"mb.icon","comId":"u_set","layout":{"width":24,"height":24},"configs":[{"path":"图标/基础属性/图标","value":"gearshape"},{"path":"图标/高级属性/颜色","value":"#595959"}]}]
["_root_","_rootSlot_","addChild",{"title":"市场指数滚动","ns":"mb.marquee","comId":"u_mrq","layout":{"width":"100%","height":"fit-content","marginTop":15,"marginLeft":15,"marginRight":15},"configs":[{"path":"跑马灯/数据/数据源","value":"[{\"_id\":\"1\",\"name\":\"上证指数\",\"value\":\"3245.67\",\"change\":\"+1.23%\",\"color\":\"#FF4D4F\"},{\"_id\":\"2\",\"name\":\"深证成指\",\"value\":\"12456.89\",\"change\":\"-0.45%\",\"color\":\"#52C41A\"},{\"_id\":\"3\",\"name\":\"创业板指\",\"value\":\"2567.34\",\"change\":\"+2.11%\",\"color\":\"#FF4D4F\"}]"},{"path":"跑马灯/基础属性/排列方向","value":"row"},{"path":"跑马灯/基础属性/间距","value":"30"},{"path":"样式/样式","style":{"background":"rgba(255,255,255,0.1)","borderRadius":"8px","padding":"10px"}}]}]
["u_mrq","item","addChild",{"title":"指数项","ns":"mb.containerBasic","comId":"u_idx","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/样式","style":{"padding":"5px 10px"}}]}]
["u_idx","content","addChild",{"title":"指数名称","ns":"mb.text","comId":"u_inm","layout":{"width":"fit-content","height":"fit-content","marginRight":8},"configs":[{"path":"文本/基础属性/文本内容","value":"上证指数"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#FFFFFF","fontWeight":"400"}}]}]
["u_idx","content","addChild",{"title":"指数值","ns":"mb.text","comId":"u_ivl","layout":{"width":"fit-content","height":"fit-content","marginRight":5},"configs":[{"path":"文本/基础属性/文本内容","value":"3245.67"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#FFFFFF","fontWeight":"500"}}]}]
["u_idx","content","addChild",{"title":"涨跌幅","ns":"mb.text","comId":"u_chg","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"+1.23%"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#FF4D4F","fontWeight":"500"}}]}]
["_root_","_rootSlot_","addChild",{"title":"资产概览卡片","ns":"mb.containerBasic","comId":"u_ast","layout":{"width":"100%","height":"fit-content","marginTop":15,"marginLeft":15,"marginRight":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"background":"linear-gradient(135deg, #1A365D 0%, #2D5A87 100%)","borderRadius":"12px","padding":"20px","boxShadow":"0 4px 12px rgba(0,0,0,0.1)"}}]}]
["u_ast","content","addChild",{"title":"资产标题","ns":"mb.text","comId":"u_att","layout":{"width":"100%","height":"fit-content","marginBottom":10},"configs":[{"path":"文本/基础属性/文本内容","value":"我的资产"},{"path":"样式/样式","style":{"fontSize":"18px","color":"#FFFFFF","fontWeight":"600"}}]}]
["u_ast","content","addChild",{"title":"总资产金额","ns":"mb.text","comId":"u_amt","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"文本/基础属性/文本内容","value":"¥186,420.50"},{"path":"样式/样式","style":{"fontSize":"28px","color":"#FFFFFF","fontWeight":"700"}}]}]
["u_ast","content","addChild",{"title":"昨日收益","ns":"mb.text","comId":"u_pft","layout":{"width":"100%","height":"fit-content","marginBottom":20},"configs":[{"path":"文本/基础属性/文本内容","value":"昨日收益 +¥1,234.56 (+0.67%)"},{"path":"样式/样式","style":{"fontSize":"14px","color":"#52C41A","fontWeight":"500"}}]}]
["u_ast","content","addChild",{"title":"操作按钮区","ns":"mb.containerBasic","comId":"u_btn","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between"}}]}]
["u_btn","content","addChild",{"title":"充值按钮","ns":"mb.button","comId":"u_dep","layout":{"width":"48%","height":40},"configs":[{"path":"按钮/基础属性/按钮文案","value":"充值"},{"path":"样式/默认/按钮","style":{"background":"rgba(255,255,255,0.2)","color":"#FFFFFF","borderRadius":"8px","fontSize":"14px","fontWeight":"500","border":"1px solid rgba(255,255,255,0.3)"}}]}]
["u_btn","content","addChild",{"title":"提现按钮","ns":"mb.button","comId":"u_wit","layout":{"width":"48%","height":40},"configs":[{"path":"按钮/基础属性/按钮文案","value":"提现"},{"path":"样式/默认/按钮","style":{"background":"rgba(255,255,255,0.2)","color":"#FFFFFF","borderRadius":"8px","fontSize":"14px","fontWeight":"500","border":"1px solid rgba(255,255,255,0.3)"}}]}]
["_root_","_rootSlot_","addChild",{"title":"快捷功能区","ns":"mb.containerBasic","comId":"u_qck","layout":{"width":"100%","height":"fit-content","marginTop":15,"marginLeft":15,"marginRight":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between"}},{"path":"样式/样式","style":{"background":"#FFFFFF","borderRadius":"12px","padding":"20px"}}]}]
["u_qck","content","addChild",{"title":"买基金","ns":"mb.containerBasic","comId":"u_buy","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_buy","content","addChild",{"title":"买基金图标","ns":"mb.icon","comId":"u_byi","layout":{"width":32,"height":32,"marginBottom":8},"configs":[{"path":"图标/基础属性/图标","value":"plus_square"},{"path":"图标/基础属性/大小","value":32},{"path":"图标/高级属性/颜色","value":"#1A365D"}]}]
["u_buy","content","addChild",{"title":"买基金文字","ns":"mb.text","comId":"u_byt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"买基金"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#595959","fontWeight":"400"}}]}]
["u_qck","content","addChild",{"title":"定投计划","ns":"mb.containerBasic","comId":"u_inv","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_inv","content","addChild",{"title":"定投图标","ns":"mb.icon","comId":"u_ivi","layout":{"width":32,"height":32,"marginBottom":8},"configs":[{"path":"图标/基础属性/图标","value":"clock"},{"path":"图标/基础属性/大小","value":32},{"path":"图标/高级属性/颜色","value":"#1A365D"}]}]
["u_inv","content","addChild",{"title":"定投文字","ns":"mb.text","comId":"u_ivt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"定投计划"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#595959","fontWeight":"400"}}]}]
["u_qck","content","addChild",{"title":"基金诊断","ns":"mb.containerBasic","comId":"u_dia","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_dia","content","addChild",{"title":"诊断图标","ns":"mb.icon","comId":"u_dii","layout":{"width":32,"height":32,"marginBottom":8},"configs":[{"path":"图标/基础属性/图标","value":"magnifyingglass"},{"path":"图标/基础属性/大小","value":32},{"path":"图标/高级属性/颜色","value":"#1A365D"}]}]
["u_dia","content","addChild",{"title":"诊断文字","ns":"mb.text","comId":"u_dit","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"基金诊断"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#595959","fontWeight":"400"}}]}]
["u_qck","content","addChild",{"title":"投资学堂","ns":"mb.containerBasic","comId":"u_edu","enhance":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_edu","content","addChild",{"title":"学堂图标","ns":"mb.icon","comId":"u_edi","layout":{"width":32,"height":32,"marginBottom":8},"configs":[{"path":"图标/基础属性/图标","value":"book_open_fill"},{"path":"图标/基础属性/大小","value":32},{"path":"图标/高级属性/颜色","value":"#1A365D"}]}]
["u_edu","content","addChild",{"title":"学堂文字","ns":"mb.text","comId":"u_edt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"投资学堂"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#595959","fontWeight":"400"}}]}]
["_root_","_rootSlot_","addChild",{"title":"推荐基金区域","ns":"mb.containerBasic","comId":"u_rec","layout":{"width":"100%","height":"fit-content","marginTop":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"background":"#FFFFFF","borderRadius":"12px 12px 0 0","padding":"20px 0 15px 0"}}]}]
["u_rec","content","addChild",{"title":"推荐标题区","ns":"mb.containerBasic","comId":"u_rtt","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":15,"marginLeft":15,"marginRight":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_rtt","content","addChild",{"title":"推荐标题","ns":"mb.text","comId":"u_rtx","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"为你推荐"},{"path":"样式/样式","style":{"fontSize":"18px","color":"#262626","fontWeight":"600"}}]}]
["u_rtt","content","addChild",{"title":"查看更多","ns":"mb.text","comId":"u_mor","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"查看更多 >"},{"path":"样式/样式","style":{"fontSize":"14px","color":"#1A365D","fontWeight":"400"}}]}]
["u_rec","content","addChild",{"title":"基金卡片列表","ns":"mb.containerList","comId":"u_fnd","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"循环列表/基础属性/排列方向","value":"row"},{"path":"循环列表/基础属性/间距","value":"15"}]}]
["u_fnd","item","addChild",{"title":"基金卡片","ns":"mb.containerBasic","comId":"u_fcd","enhance":true,"layout":{"width":280,"height":"fit-content","marginLeft":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"background":"#F8F9FA","borderRadius":"12px","padding":"15px","border":"1px solid #E8E8E8"}}]}]
["u_fcd","content","addChild",{"title":"基金名称","ns":"mb.text","comId":"u_fnm","layout":{"width":"100%","height":"fit-content","marginBottom":5},"configs":[{"path":"文本/基础属性/文本内容","value":"易方达蓝筹精选"},{"path":"样式/样式","style":{"fontSize":"16px","color":"#262626","fontWeight":"500"}},{"path":"样式/开启文本省略","value":true},{"path":"样式/最大行数","value":1}]}]
["u_fcd","content","addChild",{"title":"基金代码","ns":"mb.text","comId":"u_fcd2","layout":{"width":"100%","height":"fit-content","marginBottom":10},"configs":[{"path":"文本/基础属性/文本内容","value":"110009"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#8C8C8C","fontWeight":"400"}}]}]
["u_fcd","content","addChild",{"title":"收益率","ns":"mb.text","comId":"u_frt","layout":{"width":"100%","height":"fit-content","marginBottom":10},"configs":[{"path":"文本/基础属性/文本内容","value":"近一年收益率 +15.67%"},{"path":"样式/样式","style":{"fontSize":"14px","color":"#FF4D4F","fontWeight":"500"}}]}]
["u_fcd","content","addChild",{"title":"卡片底部","ns":"mb.containerBasic","comId":"u_fbt","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_fbt","content","addChild",{"title":"风险等级","ns":"mb.text","comId":"u_rsk","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"中风险"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#595959","fontWeight":"400","background":"#F0F0F0","padding":"2px 8px","borderRadius":"4px"}}]}]
["u_fbt","content","addChild",{"title":"购买按钮","ns":"mb.button","comId":"u_fby","layout":{"width":60,"height":28},"configs":[{"path":"按钮/基础属性/按钮文案","value":"购买"},{"path":"样式/默认/按钮","style":{"background":"#1A365D","color":"#FFFFFF","borderRadius":"6px","fontSize":"12px","fontWeight":"500"}}]}]
["_root_","_rootSlot_","addChild",{"title":"我的持仓","ns":"mb.containerBasic","comId":"u_pos","layout":{"width":"100%","height":"fit-content","marginTop":0},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"background":"#FFFFFF","padding":"20px 15px"}}]}]
["u_pos","content","addChild",{"title":"持仓标题区","ns":"mb.containerBasic","comId":"u_ptt","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":15},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_ptt","content","addChild",{"title":"持仓标题","ns":"mb.text","comId":"u_ptx","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"我的持仓"},{"path":"样式/样式","style":{"fontSize":"18px","color":"#262626","fontWeight":"600"}}]}]
["u_ptt","content","addChild",{"title":"管理链接","ns":"mb.text","comId":"u_mgm","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"管理 >"},{"path":"样式/样式","style":{"fontSize":"14px","color":"#1A365D","fontWeight":"400"}}]}]
["u_pos","content","addChild",{"title":"持仓列表","ns":"mb.containerList","comId":"u_pls","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"循环列表/数据/数据源","value":"[{"path":"循环列表/基础属性/排列方向","value":"column"},{"path":"循环列表/基础属性/间距","value":"15"}]}]
["u_pls","item","addChild",{"title":"持仓项","ns":"mb.containerBasic","comId":"u_pit","enhance":true,"layout":{"width":"100%","height":80},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/样式","style":{"background":"#F8F9FA","borderRadius":"8px","padding":"15px"}}]}]
["u_pit","content","addChild",{"title":"左侧信息","ns":"mb.containerBasic","comId":"u_lft","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center"}}]}]
["u_lft","content","addChild",{"title":"基金名称","ns":"mb.text","comId":"u_pnm","layout":{"width":"fit-content","height":"fit-content","marginBottom":5},"configs":[{"path":"文本/基础属性/文本内容","value":"易方达蓝筹精选"},{"path":"样式/样式","style":{"fontSize":"16px","color":"#262626","fontWeight":"500"}}]}]
["u_lft","content","addChild",{"title":"持有份额","ns":"mb.text","comId":"u_shr","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"持有 1,250.00份"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#8C8C8C","fontWeight":"400"}}]}]
["u_pit","content","addChild",{"title":"右侧数据","ns":"mb.containerBasic","comId":"u_rgt","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column","alignItems":"flex-end","justifyContent":"center"}}]}]
["u_rgt","content","addChild",{"title":"当前市值","ns":"mb.text","comId":"u_val","layout":{"width":"fit-content","height":"fit-content","marginBottom":5},"configs":[{"path":"文本/基础属性/文本内容","value":"¥15,680.50"},{"path":"样式/样式","style":{"fontSize":"16px","color":"#262626","fontWeight":"500"}}]}]
["u_rgt","content","addChild",{"title":"收益金额","ns":"mb.text","comId":"u_prf","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"+¥1,280.50"},{"path":"样式/样式","style":{"fontSize":"14px","color":"#FF4D4F","fontWeight":"500"}}]}]
["_root_","_rootSlot_","addChild",{"title":"市场资讯","ns":"mb.containerBasic","comId":"u_nws","layout":{"width":"100%","height":"fit-content","marginTop":0,"marginBottom":20},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"background":"#FFFFFF","padding":"20px 15px"}}]}]
["u_nws","content","addChild",{"title":"资讯标题","ns":"mb.text","comId":"u_ntx","layout":{"width":"100%","height":"fit-content","marginBottom":15},"configs":[{"path":"文本/基础属性/文本内容","value":"市场动态"},{"path":"样式/样式","style":{"fontSize":"18px","color":"#262626","fontWeight":"600"}}]}]
["u_nws","content","addChild",{"title":"资讯列表","ns":"mb.containerList","comId":"u_nls","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"循环列表/数据/数据源","value":"[{"path":"循环列表/基础属性/排列方向","value":"column"},{"path":"循环列表/基础属性/间距","value":"15"}]}]
["u_nls","item","addChild",{"title":"资讯项","ns":"mb.containerBasic","comId":"u_nit","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/样式","style":{"padding":"10px 0","borderBottom":"1px solid #F0F0F0"}}]}]
["u_nit","content","addChild",{"title":"资讯标题","ns":"mb.text","comId":"u_ntt","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"文本/基础属性/文本内容","value":"A股三大指数集体上涨，基金投资迎来新机遇"},{"path":"样式/样式","style":{"fontSize":"15px","color":"#262626","fontWeight":"400","lineHeight":"22px"}},{"path":"样式/开启文本省略","value":true},{"path":"样式/最大行数","value":2}]}]
["u_nit","content","addChild",{"title":"资讯信息","ns":"mb.containerBasic","comId":"u_nif","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"容器/基础属性/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_nif","content","addChild",{"title":"发布时间","ns":"mb.text","comId":"u_ntm","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"2小时前"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#8C8C8C","fontWeight":"400"}}]}]
["u_nif","content","addChild",{"title":"来源标签","ns":"mb.text","comId":"u_src2","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"文本/基础属性/文本内容","value":"市场分析"},{"path":"样式/样式","style":{"fontSize":"12px","color":"#1A365D","fontWeight":"400","background":"#E6F7FF","padding":"2px 6px","borderRadius":"4px"}}]}]
`

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
  type = DEFAULT_TYPE,
  id = type === 'com' ? DEFAULT_COM_ID : DEFAULT_PAGE_ID,
  delay = DEFAULT_TEST_DELAY
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
window.generateActionsFile = (pageId, delay = DEFAULT_GENERATE_DELAY) => {
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

  const defaultPageId = pageId || `'${DEFAULT_PAGE_ID}'`;
  const executeCallStr = `\nexecuteActionsWithDelay(${defaultPageId}, mockActions, ${delay}, window.plugin_ai_context.api?.page?.api)`;

  const fullContent = `${actionsArrayStr}\n\n${executeFunctionStr}${executeCallStr}\n`;

  console.log('Generated actions.ts content:');
  console.log(fullContent);
  
  return fullContent;
};