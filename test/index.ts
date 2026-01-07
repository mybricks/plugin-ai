// @ts-nocheck
import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'

window.plugin_ai_context = context

const mockActions = `息4","ns":"pc.custom-container","comId":"u_hb4","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_hb4","content","addChild",{"title":"热门日期4","ns":"pc.text","comId":"u_hd4","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2023-12-20"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#95A5A6","lineHeight":"18px"}}]}]
["u_hb4","content","addChild",{"title":"热门阅读图标4","ns":"pc.icon","comId":"u_he4","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#95A5A6"}}]}]
["u_hb4","content","addChild",{"title":"热门阅读量4","ns":"pc.text","comId":"u_hr4","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"1.9K"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#95A5A6","lineHeight":"18px"}}]}]
["u_mai","content","addChild",{"title":"分类标签云","ns":"pc.custom-container","comId":"u_tag","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":40},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_tag","content","addChild",{"title":"区块标题","ns":"pc.text","comId":"u_tit","layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/内容","value":"热门标签"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_tag","content","addChild",{"title":"标签列表","ns":"pc.tagList","comId":"u_tls","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/基础/方向","value":"horizontal"},{"path":"常规/基础/标签间距","value":12},{"path":"常规/数据源","value":[{"key":"t1","content":"JavaScript","color":"default"},{"key":"t2","content":"React","color":"default"},{"key":"t3","content":"Vue","color":"default"},{"key":"t4","content":"CSS","color":"default"},{"key":"t5","content":"Node.js","color":"default"},{"key":"t6","content":"TypeScript","color":"default"},{"key":"t7","content":"Webpack","color":"default"},{"key":"t8","content":"性能优化","color":"default"},{"key":"t9","content":"设计模式","color":"default"},{"key":"t10","content":"算法","color":"default"}]},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#7F8C8D","background":"#ECF0F1","padding":"8px 16px","borderRadius":"16px","border":"none"}},{"path":"样式/Hover","style":{"background":"#3498DB","color":"#ffffff"}}]}]
["u_mai","content","addChild",{"title":"归档时间线","ns":"pc.custom-container","comId":"u_arc","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":40},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_arc","content","addChild",{"title":"标题栏","ns":"pc.custom-container","comId":"u_ath","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_ath","content","addChild",{"title":"区块标题","ns":"pc.text","comId":"u_att","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"文章归档"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_ath","content","addChild",{"title":"查看全部链接","ns":"pc.text","comId":"u_aal","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"查看全部 →"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#3498DB","lineHeight":"22px"}},{"path":"样式/Hover/Hover","style":{"color":"#2980B9"}}]}]
["u_arc","content","addChild",{"title":"时间轴","ns":"pc.timeline","comId":"u_tml","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/属性/内容位置","value":"right"},{"path":"样式/时间轴点","style":{"background":"#3498DB","border":"2px solid #ECF0F1"}},{"path":"样式/标题","style":{"fontSize":"16px","color":"#2C3E50","fontWeight":"bold","lineHeight":"24px"}},{"path":"样式/副标题","style":{"fontSize":"14px","color":"#7F8C8D","lineHeight":"22px"}},{"path":"样式/描述","style":{"fontSize":"14px","color":"#95A5A6","lineHeight":"22px"}},{"path":"常规/数据源","value":[{"id":"m1","title":"2024年01月","subTitle":"8篇文章","description":"本月更新了React、Vue、TypeScript等相关文章"},{"id":"m2","title":"2023年12月","subTitle":"12篇文章","description":"本月聚焦前端性能优化与工程化实践"},{"id":"m3","title":"2023年11月","subTitle":"10篇文章","description":"本月分享了CSS布局与设计模式相关内容"},{"id":"m4","title":"2023年10月","subTitle":"9篇文章","description":"本月深入探讨JavaScript核心原理"}]}]}]
["u_mai","content","addChild",{"title":"友情链接","ns":"pc.custom-container","comId":"u_fri","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":40},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#ffffff","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_fri","content","addChild",{"title":"区块标题","ns":"pc.text","comId":"u_ftt","layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/内容","value":"友情链接"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_fri","content","addChild",{"title":"链接列表","ns":"pc.custom-container","comId":"u_flc","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","flexWrap":"wrap"}}]}]
["u_flc","content","addChild",{"title":"友链1","ns":"pc.custom-container","comId":"u_fl1","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl1","content","addChild",{"title":"头像1","ns":"pc.single-image","comId":"u_fa1","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/9B59B6/ffffff?text=A"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl1","content","addChild",{"title":"名称1","ns":"pc.text","comId":"u_fn1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"阮一峰"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["u_flc","content","addChild",{"title":"友链2","ns":"pc.custom-container","comId":"u_fl2","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl2","content","addChild",{"title":"头像2","ns":"pc.single-image","comId":"u_fa2","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/3498DB/ffffff?text=B"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl2","content","addChild",{"title":"名称2","ns":"pc.text","comId":"u_fn2","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"廖雪峰"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["u_flc","content","addChild",{"title":"友链3","ns":"pc.custom-container","comId":"u_fl3","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl3","content","addChild",{"title":"头像3","ns":"pc.single-image","comId":"u_fa3","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/E74C3C/ffffff?text=C"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl3","content","addChild",{"title":"名称3","ns":"pc.text","comId":"u_fn3","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"张鑫旭"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["u_flc","content","addChild",{"title":"友链4","ns":"pc.custom-container","comId":"u_fl4","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl4","content","addChild",{"title":"头像4","ns":"pc.single-image","comId":"u_fa4","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/1ABC9C/ffffff?text=D"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl4","content","addChild",{"title":"名称4","ns":"pc.text","comId":"u_fn4","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"尤雨溪"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["u_flc","content","addChild",{"title":"友链5","ns":"pc.custom-container","comId":"u_fl5","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32,"marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl5","content","addChild",{"title":"头像5","ns":"pc.single-image","comId":"u_fa5","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/F39C12/ffffff?text=E"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl5","content","addChild",{"title":"名称5","ns":"pc.text","comId":"u_fn5","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"Winter"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["u_flc","content","addChild",{"title":"友链6","ns":"pc.custom-container","comId":"u_fl6","enhance":true,"layout":{"width":"fit-content","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fl6","content","addChild",{"title":"头像6","ns":"pc.single-image","comId":"u_fa6","layout":{"width":48,"height":48,"marginBottom":8},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/48x48/16A085/ffffff?text=F"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%"}}]}]
["u_fl6","content","addChild",{"title":"名称6","ns":"pc.text","comId":"u_fn6","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"Dan"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#7F8C8D","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"#3498DB"}}]}]
["_root_","_rootSlot_","addChild",{"title":"页脚区","ns":"pc.custom-container","comId":"u_foo","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#2C3E50","padding":"40px 0"}}]}]
["u_foo","content","addChild",{"title":"页脚内容容器","ns":"pc.custom-container","comId":"u_fcc","ignore":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fcc","content","addChild",{"title":"博客简介","ns":"pc.text","comId":"u_fds","layout":{"width":"fit-content","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/内容","value":"专注前端技术分享 / 记录学习成长历程"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"rgba(255,255,255,0.8)","lineHeight":"22px"}}]}]
["u_fcc","content","addChild",{"title":"页脚社交图标组","ns":"pc.custom-container","comId":"u_fsc","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_fsc","content","addChild",{"title":"页脚GitHub","ns":"pc.icon","comId":"u_fg1","layout":{"width":20,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"GithubOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.6)"}},{"path":"样式/Hover/颜色","style":{"color":"rgba(255,255,255,0.9)"}}]}]
["u_fsc","content","addChild",{"title":"页脚微信","ns":"pc.icon","comId":"u_fg2","layout":{"width":20,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"WechatOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.6)"}},{"path":"样式/Hover/颜色","style":{"color":"rgba(255,255,255,0.9)"}}]}]
["u_fsc","content","addChild",{"title":"页脚微博","ns":"pc.icon","comId":"u_fg3","layout":{"width":20,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"WeiboOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.6)"}},{"path":"样式/Hover/颜色","style":{"color":"rgba(255,255,255,0.9)"}}]}]
["u_fsc","content","addChild",{"title":"页脚邮箱","ns":"pc.icon","comId":"u_fg4","layout":{"width":20,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"MailOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.6)"}},{"path":"样式/Hover/颜色","style":{"color":"rgba(255,255,255,0.9)"}}]}]
["u_fcc","content","addChild",{"title":"分割线","ns":"pc.custom-container","comId":"u_fdv","layout":{"width":800,"height":1,"marginBottom":24},"configs":[{"path":"样式/默认/默认","style":{"background":"rgba(255,255,255,0.1)"}}]}]
["u_fcc","content","addChild",{"title":"底部信息容器","ns":"pc.custom-container","comId":"u_fbc","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_fbc","content","addChild",{"title":"版权信息","ns":"pc.text","comId":"u_fcp","layout":{"width":"fit-content","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"© 2024 我的博客. All Rights Reserved."},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"18px"}}]}]
["u_fbc","content","addChild",{"title":"备案与链接","ns":"pc.custom-container","comId":"u_flk","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_flk","content","addChild",{"title":"ICP备案","ns":"pc.text","comId":"u_icp","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"ICP备xxxxx号"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"18px"}}]}]
["u_flk","content","addChild",{"title":"关于链接","ns":"pc.text","comId":"u_abt","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"关于"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"rgba(255,255,255,0.9)"}}]}]
["u_flk","content","addChild",{"title":"联系链接","ns":"pc.text","comId":"u_cnt","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"联系我"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"18px"}},{"path":"样式/Hover/Hover","style":{"color":"rgba(255,255,255,0.9)"}}]}]`

// const mockActions = `["u_CwA84", ":root", "doConfig", {"path":"按钮/文字标题","value":"微信登录"}]
// ["u_CwA84", ":root", "doConfig", {"path":"按钮/图标","value":true}]
// ["u_CwA84", ":root", "doConfig", {"path":"按钮/图标配置/图标库","value":"WechatOutlined"}]
// ["u_CwA84", ":root", "doConfig", {"path":"样式/默认/按钮","style":{"background":"#07C160","color":"#FFFFFF","fontSize":"14px","fontWeight":"500"}]}]
// ["u_CwA84", ":root", "setLayout", {"position":"absolute","width":280,"height":44,"top":20,"left":31}]
// ["u_qjID_", ":root", "doConfig", {"path":"按钮/文字标题","value":"QQ登录"}]
// ["u_qjID_", ":root", "doConfig", {"path":"按钮/图标","value":true}]
// ["u_qjID_", ":root", "doConfig", {"path":"按钮/图标配置/图标库","value":"QqOutlined"}]
// ["u_qjID_", ":root", "doConfig", {"path":"样式/风格","value":"default"}]
// ["u_qjID_", ":root", "doConfig", {"path":"样式/默认/按钮","style":{"background":"#12B7F5","color":"#FFFFFF","fontSize":"14px","fontWeight":"500"}]}]
// ["u_qjID_", ":root", "setLayout", {"position":"absolute","width":135,"height":44,"top":80,"left":31}]
// ["u_IQA1w", "content", "addChild", {"title":"支付宝登录按钮","ns":"pc.custom-button","comId":"u_alipay","layout":{"position":"absolute","width":135,"height":44,"top":80,"left":176},"configs":[{"path":"按钮/文字标题","value":"支付宝登录"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"AlipayOutlined"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"background":"#1677FF","color":"#FFFFFF","fontSize":"14px","fontWeight":"500"}}]}]
// ["u_IQA1w", "content", "addChild", {"title":"Apple登录按钮","ns":"pc.custom-button","comId":"u_apple","layout":{"position":"absolute","width":135,"height":44,"top":140,"left":31},"configs":[{"path":"按钮/文字标题","value":"Apple登录"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"AppleOutlined"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"background":"#000000","color":"#FFFFFF","fontSize":"14px","fontWeight":"500"}}]}]
// ["u_IQA1w", "content", "addChild", {"title":"更多登录方式","ns":"pc.custom-button","comId":"u_more","layout":{"position":"absolute","width":135,"height":44,"top":140,"left":176},"configs":[{"path":"按钮/文字标题","value":"更多方式"},{"path":"按钮/图标","value":true},{"path":"按钮/图标配置/图标库","value":"EllipsisOutlined"},{"path":"样式/风格","value":"default"},{"path":"样式/默认/按钮","style":{"background":"#F5F5F5","color":"#666666","fontSize":"14px","fontWeight":"500"}}]}]
// ["u_22iRs", ":root", "delete"]
// ["u_IQA1w", ":root", "setLayout", {"width":"100%","height":204}]
// ["u_IQA1w", ":root", "doConfig", {"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"12px","padding":"20px","boxShadow":"0 2px 8px rgba(0,0,0,0.1)"}}]`

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