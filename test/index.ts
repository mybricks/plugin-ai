// @ts-nocheck
import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'

window.plugin_ai_context = context

const mockActions = `["_root_",":root","setLayout",{"height":3200}]
["_root_",":root","doConfig",{"path":"root/标题","value":"个人博客首页"}]
["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]
["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#F5F7FA"}}]
["_root_","_rootSlot_","addChild",{"title":"顶部导航栏","ns":"pc.custom-container","comId":"u_nav","enhance":true,"layout":{"width":"100%","height":64},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"rgba(255,255,255,0.95)","boxShadow":"0 2px 8px rgba(0,0,0,0.06)"}}]}]
["u_nav","content","addChild",{"title":"Logo文字","ns":"pc.text","comId":"u_log","layout":{"width":"fit-content","height":"fit-content","marginLeft":32},"configs":[{"path":"常规/内容","value":"MY BLOG"},{"path":"样式/默认/默认","style":{"fontSize":"20px","fontWeight":"bold","color":"#2C3E50","lineHeight":"24px"}}]}]
["u_nav","content","addChild",{"title":"导航菜单","ns":"pc.menu","comId":"u_men","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"导航菜单/样式","value":"horizontal"},{"path":"样式/默认/菜单","style":{"background":"transparent"}},{"path":"样式/默认/菜单项","style":{"fontSize":"15px","color":"#333333","lineHeight":"64px"}},{"path":"样式/选中/菜单项","style":{"fontSize":"15px","color":"#409EFF","lineHeight":"64px"}},{"path":"样式/选中/选中标记","style":{"borderWidth":"2px","borderColor":"#409EFF"}},{"path":"常规/数据源","value":[{"key":"home","title":"首页","menuType":"menu","defaultActive":true},{"key":"article","title":"文章","menuType":"menu"},{"key":"category","title":"分类","menuType":"menu"},{"key":"tag","title":"标签","menuType":"menu"},{"key":"about","title":"关于","menuType":"menu"}]}]}]
["u_nav","content","addChild",{"title":"右侧图标组","ns":"pc.custom-container","comId":"u_ric","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginRight":32},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_ric","content","addChild",{"title":"搜索图标","ns":"pc.icon","comId":"u_ser","layout":{"width":20,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"SearchOutlined"},{"path":"样式/默认/颜色","style":{"color":"#333333"}}]}]
["u_ric","content","addChild",{"title":"主题切换图标","ns":"pc.icon","comId":"u_the","layout":{"width":20,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"BulbOutlined"},{"path":"样式/默认/颜色","style":{"color":"#333333"}}]}]
["_root_","_rootSlot_","addChild",{"title":"首屏展示区","ns":"pc.custom-container","comId":"u_ban","enhance":true,"layout":{"width":"100%","height":500},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"linear-gradient(180deg, #E3F2FD 0%, #FFFFFF 100%)"}}]}]
["u_ban","content","addChild",{"title":"头像","ns":"pc.single-image","comId":"u_ava","layout":{"width":100,"height":100,"marginBottom":16},"configs":[{"path":"常规/图片地址","value":"https://placehold.co/100x100/409EFF/FFFFFF?text=Avatar"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"50%","border":"4px solid #FFFFFF","boxShadow":"0 4px 12px rgba(0,0,0,0.1)"}}]}]
["u_ban","content","addChild",{"title":"博主名称","ns":"pc.text","comId":"u_nam","layout":{"width":"fit-content","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"技术博主"},{"path":"样式/默认/默认","style":{"fontSize":"32px","fontWeight":"bold","color":"#2C3E50","lineHeight":"40px"}}]}]
["u_ban","content","addChild",{"title":"个人介绍","ns":"pc.text","comId":"u_int","layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/内容","value":"全栈开发者 / 技术写作者 / 开源贡献者"},{"path":"样式/默认/默认","style":{"fontSize":"16px","color":"#606266","lineHeight":"24px"}}]}]
["u_ban","content","addChild",{"title":"社交图标组","ns":"pc.custom-container","comId":"u_soc","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginBottom":40},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_soc","content","addChild",{"title":"GitHub图标","ns":"pc.icon","comId":"u_git","layout":{"width":24,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"GithubOutlined"},{"path":"样式/默认/颜色","style":{"color":"#606266"}},{"path":"样式/Hover/颜色","style":{"color":"#409EFF"}}]}]
["u_soc","content","addChild",{"title":"微博图标","ns":"pc.icon","comId":"u_wei","layout":{"width":24,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"WeiboOutlined"},{"path":"样式/默认/颜色","style":{"color":"#606266"}},{"path":"样式/Hover/颜色","style":{"color":"#409EFF"}}]}]
["u_soc","content","addChild",{"title":"邮箱图标","ns":"pc.icon","comId":"u_mai","layout":{"width":24,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"MailOutlined"},{"path":"样式/默认/颜色","style":{"color":"#606266"}},{"path":"样式/Hover/颜色","style":{"color":"#409EFF"}}]}]
["u_ban","content","addChild",{"title":"向下箭头","ns":"pc.icon","comId":"u_arr","layout":{"width":24,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"DownOutlined"},{"path":"样式/默认/颜色","style":{"color":"#C0C4CC"}}]}]
["_root_","_rootSlot_","addChild",{"title":"数据统计区","ns":"pc.custom-container","comId":"u_sta","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]}]
["u_sta","content","addChild",{"title":"内容容器","ns":"pc.custom-container","comId":"u_stc","ignore":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_stc","content","addChild",{"title":"统计卡片1","ns":"pc.custom-container","comId":"u_st1","enhance":true,"layout":{"width":228,"height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)"}}]}]
["u_st1","content","addChild",{"title":"图标1","ns":"pc.icon","comId":"u_ic1","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"FileTextOutlined"},{"path":"样式/默认/颜色","style":{"color":"#409EFF"}}]}]
["u_st1","content","addChild",{"title":"数字1","ns":"pc.text","comId":"u_nu1","layout":{"width":"fit-content","height":"fit-content","marginBottom":4},"configs":[{"path":"常规/内容","value":"128"},{"path":"样式/默认/默认","style":{"fontSize":"28px","fontWeight":"bold","color":"#409EFF","lineHeight":"36px"}}]}]
["u_st1","content","addChild",{"title":"说明1","ns":"pc.text","comId":"u_de1","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"文章总数"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_stc","content","addChild",{"title":"统计卡片2","ns":"pc.custom-container","comId":"u_st2","enhance":true,"layout":{"width":228,"height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)"}}]}]
["u_st2","content","addChild",{"title":"图标2","ns":"pc.icon","comId":"u_ic2","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"FolderOutlined"},{"path":"样式/默认/颜色","style":{"color":"#67C23A"}}]}]
["u_st2","content","addChild",{"title":"数字2","ns":"pc.text","comId":"u_nu2","layout":{"width":"fit-content","height":"fit-content","marginBottom":4},"configs":[{"path":"常规/内容","value":"12"},{"path":"样式/默认/默认","style":{"fontSize":"28px","fontWeight":"bold","color":"#67C23A","lineHeight":"36px"}}]}]
["u_st2","content","addChild",{"title":"说明2","ns":"pc.text","comId":"u_de2","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"分类数量"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_stc","content","addChild",{"title":"统计卡片3","ns":"pc.custom-container","comId":"u_st3","enhance":true,"layout":{"width":228,"height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)"}}]}]
["u_st3","content","addChild",{"title":"图标3","ns":"pc.icon","comId":"u_ic3","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"TagsOutlined"},{"path":"样式/默认/颜色","style":{"color":"#E6A23C"}}]}]
["u_st3","content","addChild",{"title":"数字3","ns":"pc.text","comId":"u_nu3","layout":{"width":"fit-content","height":"fit-content","marginBottom":4},"configs":[{"path":"常规/内容","value":"45"},{"path":"样式/默认/默认","style":{"fontSize":"28px","fontWeight":"bold","color":"#E6A23C","lineHeight":"36px"}}]}]
["u_st3","content","addChild",{"title":"说明3","ns":"pc.text","comId":"u_de3","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"标签数量"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_stc","content","addChild",{"title":"统计卡片4","ns":"pc.custom-container","comId":"u_st4","enhance":true,"layout":{"width":228,"height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)"}}]}]
["u_st4","content","addChild",{"title":"图标4","ns":"pc.icon","comId":"u_ic4","layout":{"width":32,"height":"fit-content","marginBottom":8},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#F56C6C"}}]}]
["u_st4","content","addChild",{"title":"数字4","ns":"pc.text","comId":"u_nu4","layout":{"width":"fit-content","height":"fit-content","marginBottom":4},"configs":[{"path":"常规/内容","value":"25.6K"},{"path":"样式/默认/默认","style":{"fontSize":"28px","fontWeight":"bold","color":"#F56C6C","lineHeight":"36px"}}]}]
["u_st4","content","addChild",{"title":"说明4","ns":"pc.text","comId":"u_de4","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"总访问量"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["_root_","_rootSlot_","addChild",{"title":"最新文章区容器","ns":"pc.custom-container","comId":"u_new","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]}]
["u_new","content","addChild",{"title":"最新文章卡片","ns":"pc.custom-container","comId":"u_nec","enhance":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_nec","content","addChild",{"title":"标题栏","ns":"pc.custom-container","comId":"u_neh","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_neh","content","addChild",{"title":"区块标题","ns":"pc.text","comId":"u_net","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"最新文章"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_neh","content","addChild",{"title":"查看全部链接","ns":"pc.text","comId":"u_nel","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"查看全部 →"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#409EFF","lineHeight":"22px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"14px","color":"#66B1FF","lineHeight":"22px"}}]}]
["u_nec","content","addChild",{"title":"文章1","ns":"pc.custom-container","comId":"u_ar1","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}},{"path":"样式/默认/默认","style":{"borderBottom":"1px solid #EBEEF5","paddingBottom":"16px"}}]}]
["u_ar1","content","addChild",{"title":"文章1缩略图","ns":"pc.single-image","comId":"u_a1i","layout":{"width":200,"height":140,"marginRight":16},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=technology&w=200&h=140"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}}]}]
["u_ar1","content","addChild",{"title":"文章1内容","ns":"pc.custom-container","comId":"u_a1c","ignore":true,"layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"space-between"}}]}]
["u_a1c","content","addChild",{"title":"文章1标题","ns":"pc.text","comId":"u_a1t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"深入理解JavaScript异步编程：从回调到Async/Await"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"18px","color":"#409EFF","lineHeight":"26px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"18px","color":"#66B1FF","lineHeight":"26px"}}]}]
["u_a1c","content","addChild",{"title":"文章1摘要","ns":"pc.text","comId":"u_a1d","layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"本文将深入探讨JavaScript中的异步编程演进历程，从最初的回调函数，到Promise的出现，再到ES2017引入的Async/Await语法糖，帮助你全面理解异步编程的本质和最佳实践。"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":3},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#909399","lineHeight":"22px"}}]}]
["u_a1c","content","addChild",{"title":"文章1底部信息","ns":"pc.custom-container","comId":"u_a1f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_a1f","content","addChild",{"title":"分类标签1","ns":"pc.tagList","comId":"u_a1g","layout":{"width":"fit-content","height":"fit-content","marginRight":12},"configs":[{"path":"常规/数据源","value":[{"key":"tag1","content":"JavaScript","color":"default"}]},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#606266","background":"#F5F7FA","borderRadius":"4px","border":"none"}}]}]
["u_a1f","content","addChild",{"title":"日期图标1","ns":"pc.icon","comId":"u_a1i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a1f","content","addChild",{"title":"日期文字1","ns":"pc.text","comId":"u_a1d1","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-15"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_a1f","content","addChild",{"title":"阅读图标1","ns":"pc.icon","comId":"u_a1i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a1f","content","addChild",{"title":"阅读量1","ns":"pc.text","comId":"u_a1v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"1.2K"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_nec","content","addChild",{"title":"文章2","ns":"pc.custom-container","comId":"u_ar2","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}},{"path":"样式/默认/默认","style":{"borderBottom":"1px solid #EBEEF5","paddingBottom":"16px"}}]}]
["u_ar2","content","addChild",{"title":"文章2缩略图","ns":"pc.single-image","comId":"u_a2i","layout":{"width":200,"height":140,"marginRight":16},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=programming&w=200&h=140"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}}]}]
["u_ar2","content","addChild",{"title":"文章2内容","ns":"pc.custom-container","comId":"u_a2c","ignore":true,"layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"space-between"}}]}]
["u_a2c","content","addChild",{"title":"文章2标题","ns":"pc.text","comId":"u_a2t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"Vue 3.0组合式API实战指南"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"18px","color":"#409EFF","lineHeight":"26px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"18px","color":"#66B1FF","lineHeight":"26px"}}]}]
["u_a2c","content","addChild",{"title":"文章2摘要","ns":"pc.text","comId":"u_a2d","layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"Vue 3.0带来了全新的组合式API（Composition API），让组件逻辑的组织和复用变得更加灵活。本文将通过实际案例，带你掌握setup函数、ref、reactive等核心概念。"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":3},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#909399","lineHeight":"22px"}}]}]
["u_a2c","content","addChild",{"title":"文章2底部信息","ns":"pc.custom-container","comId":"u_a2f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_a2f","content","addChild",{"title":"分类标签2","ns":"pc.tagList","comId":"u_a2g","layout":{"width":"fit-content","height":"fit-content","marginRight":12},"configs":[{"path":"常规/数据源","value":[{"key":"tag2","content":"Vue","color":"default"}]},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#606266","background":"#F5F7FA","borderRadius":"4px","border":"none"}}]}]
["u_a2f","content","addChild",{"title":"日期图标2","ns":"pc.icon","comId":"u_a2i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a2f","content","addChild",{"title":"日期文字2","ns":"pc.text","comId":"u_a2d1","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-12"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_a2f","content","addChild",{"title":"阅读图标2","ns":"pc.icon","comId":"u_a2i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a2f","content","addChild",{"title":"阅读量2","ns":"pc.text","comId":"u_a2v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"856"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_nec","content","addChild",{"title":"文章3","ns":"pc.custom-container","comId":"u_ar3","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_ar3","content","addChild",{"title":"文章3缩略图","ns":"pc.single-image","comId":"u_a3i","layout":{"width":200,"height":140,"marginRight":16},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=coding&w=200&h=140"},{"path":"常规/填充模式","value":"cover"},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}}]}]
["u_ar3","content","addChild",{"title":"文章3内容","ns":"pc.custom-container","comId":"u_a3c","ignore":true,"layout":{"width":"auto","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"space-between"}}]}]
["u_a3c","content","addChild",{"title":"文章3标题","ns":"pc.text","comId":"u_a3t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"TypeScript高级类型系统完全指南"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"18px","color":"#409EFF","lineHeight":"26px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"18px","color":"#66B1FF","lineHeight":"26px"}}]}]
["u_a3c","content","addChild",{"title":"文章3摘要","ns":"pc.text","comId":"u_a3d","layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"TypeScript的类型系统非常强大，掌握高级类型可以让你的代码更加健壮和灵活。本文将介绍联合类型、交叉类型、条件类型、映射类型等高级特性。"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":3},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#909399","lineHeight":"22px"}}]}]
["u_a3c","content","addChild",{"title":"文章3底部信息","ns":"pc.custom-container","comId":"u_a3f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_a3f","content","addChild",{"title":"分类标签3","ns":"pc.tagList","comId":"u_a3g","layout":{"width":"fit-content","height":"fit-content","marginRight":12},"configs":[{"path":"常规/数据源","value":[{"key":"tag3","content":"TypeScript","color":"default"}]},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#606266","background":"#F5F7FA","borderRadius":"4px","border":"none"}}]}]
["u_a3f","content","addChild",{"title":"日期图标3","ns":"pc.icon","comId":"u_a3i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a3f","content","addChild",{"title":"日期文字3","ns":"pc.text","comId":"u_a3d1","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-10"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_a3f","content","addChild",{"title":"阅读图标3","ns":"pc.icon","comId":"u_a3i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_a3f","content","addChild",{"title":"阅读量3","ns":"pc.text","comId":"u_a3v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"723"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["_root_","_rootSlot_","addChild",{"title":"精选推荐区容器","ns":"pc.custom-container","comId":"u_fea","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]}]
["u_fea","content","addChild",{"title":"精选推荐卡片","ns":"pc.custom-container","comId":"u_fec","enhance":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_fec","content","addChild",{"title":"精选标题","ns":"pc.text","comId":"u_fet","layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/内容","value":"精选推荐"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_fec","content","addChild",{"title":"精选卡片组","ns":"pc.custom-container","comId":"u_feg","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"flex-start"}}]}]
["u_feg","content","addChild",{"title":"精选卡片1","ns":"pc.custom-container","comId":"u_fe1","enhance":true,"layout":{"width":300,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"boxShadow":"0 4px 16px rgba(0,0,0,0.12)"}}]}]
["u_fe1","content","addChild",{"title":"精选图1容器","ns":"pc.custom-container","comId":"u_f1c","layout":{"position":"smart","width":"100%","height":180,"marginBottom":12},"configs":[{"path":"常规/布局","value":{"position":"smart"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px","overflow":"hidden"}}]}]
["u_f1c","content","addChild",{"title":"精选图1","ns":"pc.single-image","comId":"u_f1i","layout":{"width":"100%","height":180},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=web-development&w=300&h=180"},{"path":"常规/填充模式","value":"cover"}]}]
["u_f1c","content","addChild",{"title":"精选标签1","ns":"pc.custom-container","comId":"u_f1b","enhance":true,"layout":{"position":"absolute","width":"fit-content","height":"fit-content","top":12,"right":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#F56C6C","borderRadius":"4px","padding":"4px 8px"}}]}]
["u_f1b","content","addChild",{"title":"精选文字1","ns":"pc.text","comId":"u_f1l","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"精选"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#FFFFFF","lineHeight":"18px"}}]}]
["u_fe1","content","addChild",{"title":"精选标题1","ns":"pc.text","comId":"u_f1t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"React Hooks最佳实践与性能优化"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"16px","fontWeight":"bold","color":"#333333","lineHeight":"24px"}}]}]
["u_fe1","content","addChild",{"title":"精选信息1","ns":"pc.custom-container","comId":"u_f1f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_f1f","content","addChild",{"title":"日期图标f1","ns":"pc.icon","comId":"u_f1i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f1f","content","addChild",{"title":"日期f1","ns":"pc.text","comId":"u_f1d","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-08"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_f1f","content","addChild",{"title":"阅读图标f1","ns":"pc.icon","comId":"u_f1i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f1f","content","addChild",{"title":"阅读量f1","ns":"pc.text","comId":"u_f1v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"2.1K"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_feg","content","addChild",{"title":"精选卡片2","ns":"pc.custom-container","comId":"u_fe2","enhance":true,"layout":{"width":300,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"boxShadow":"0 4px 16px rgba(0,0,0,0.12)"}}]}]
["u_fe2","content","addChild",{"title":"精选图2容器","ns":"pc.custom-container","comId":"u_f2c","layout":{"position":"smart","width":"100%","height":180,"marginBottom":12},"configs":[{"path":"常规/布局","value":{"position":"smart"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px","overflow":"hidden"}}]}]
["u_f2c","content","addChild",{"title":"精选图2","ns":"pc.single-image","comId":"u_f2i","layout":{"width":"100%","height":180},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=design-pattern&w=300&h=180"},{"path":"常规/填充模式","value":"cover"}]}]
["u_f2c","content","addChild",{"title":"精选标签2","ns":"pc.custom-container","comId":"u_f2b","enhance":true,"layout":{"position":"absolute","width":"fit-content","height":"fit-content","top":12,"right":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#F56C6C","borderRadius":"4px","padding":"4px 8px"}}]}]
["u_f2b","content","addChild",{"title":"精选文字2","ns":"pc.text","comId":"u_f2l","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"精选"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#FFFFFF","lineHeight":"18px"}}]}]
["u_fe2","content","addChild",{"title":"精选标题2","ns":"pc.text","comId":"u_f2t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"设计模式在前端开发中的实践应用"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"16px","fontWeight":"bold","color":"#333333","lineHeight":"24px"}}]}]
["u_fe2","content","addChild",{"title":"精选信息2","ns":"pc.custom-container","comId":"u_f2f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_f2f","content","addChild",{"title":"日期图标f2","ns":"pc.icon","comId":"u_f2i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f2f","content","addChild",{"title":"日期f2","ns":"pc.text","comId":"u_f2d","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-05"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_f2f","content","addChild",{"title":"阅读图标f2","ns":"pc.icon","comId":"u_f2i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f2f","content","addChild",{"title":"阅读量f2","ns":"pc.text","comId":"u_f2v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"1.8K"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_feg","content","addChild",{"title":"精选卡片3","ns":"pc.custom-container","comId":"u_fe3","enhance":true,"layout":{"width":300,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px"}},{"path":"样式/Hover/Hover","style":{"boxShadow":"0 4px 16px rgba(0,0,0,0.12)"}}]}]
["u_fe3","content","addChild",{"title":"精选图3容器","ns":"pc.custom-container","comId":"u_f3c","layout":{"position":"smart","width":"100%","height":180,"marginBottom":12},"configs":[{"path":"常规/布局","value":{"position":"smart"}},{"path":"样式/默认/默认","style":{"borderRadius":"8px","overflow":"hidden"}}]}]
["u_f3c","content","addChild",{"title":"精选图3","ns":"pc.single-image","comId":"u_f3i","layout":{"width":"100%","height":180},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=performance&w=300&h=180"},{"path":"常规/填充模式","value":"cover"}]}]
["u_f3c","content","addChild",{"title":"精选标签3","ns":"pc.custom-container","comId":"u_f3b","enhance":true,"layout":{"position":"absolute","width":"fit-content","height":"fit-content","top":12,"right":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#F56C6C","borderRadius":"4px","padding":"4px 8px"}}]}]
["u_f3b","content","addChild",{"title":"精选文字3","ns":"pc.text","comId":"u_f3l","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"精选"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#FFFFFF","lineHeight":"18px"}}]}]
["u_fe3","content","addChild",{"title":"精选标题3","ns":"pc.text","comId":"u_f3t","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"前端性能优化实战：从理论到实践"},{"path":"常规/文本溢出/省略","value":true},{"path":"常规/最大显示行数","value":2},{"path":"样式/默认/默认","style":{"fontSize":"16px","fontWeight":"bold","color":"#333333","lineHeight":"24px"}}]}]
["u_fe3","content","addChild",{"title":"精选信息3","ns":"pc.custom-container","comId":"u_f3f","ignore":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_f3f","content","addChild",{"title":"日期图标f3","ns":"pc.icon","comId":"u_f3i1","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"CalendarOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f3f","content","addChild",{"title":"日期f3","ns":"pc.text","comId":"u_f3d","layout":{"width":"fit-content","height":"fit-content","marginRight":16},"configs":[{"path":"常规/内容","value":"2024-01-03"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_f3f","content","addChild",{"title":"阅读图标f3","ns":"pc.icon","comId":"u_f3i2","layout":{"width":14,"height":"fit-content","marginRight":4},"configs":[{"path":"常规/选择图标","value":"EyeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#909399"}}]}]
["u_f3f","content","addChild",{"title":"阅读量f3","ns":"pc.text","comId":"u_f3v","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"1.5K"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["_root_","_rootSlot_","addChild",{"title":"分类标签区容器","ns":"pc.custom-container","comId":"u_cat","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]}]
["u_cat","content","addChild",{"title":"分类标签卡片","ns":"pc.custom-container","comId":"u_cac","ignore":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"flex-start"}}]}]
["u_cac","content","addChild",{"title":"分类区","ns":"pc.custom-container","comId":"u_cay","enhance":true,"layout":{"width":370,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_cay","content","addChild",{"title":"分类标题","ns":"pc.text","comId":"u_cyt","layout":{"width":"fit-content","height":"fit-content","marginBottom":20},"configs":[{"path":"常规/内容","value":"文章分类"},{"path":"样式/默认/默认","style":{"fontSize":"20px","fontWeight":"bold","color":"#2C3E50","lineHeight":"28px"}}]}]
["u_cay","content","addChild",{"title":"分类1","ns":"pc.custom-container","comId":"u_cy1","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRadius":"6px","padding":"8px 12px","background":"#F5F7FA"}},{"path":"样式/Hover/Hover","style":{"borderRadius":"6px","padding":"8px 12px","background":"#E6F4FF"}}]}]
["u_cy1","content","addChild",{"title":"分类1左侧","ns":"pc.custom-container","comId":"u_c1l","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_c1l","content","addChild",{"title":"分类1图标","ns":"pc.icon","comId":"u_c1i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"CodeOutlined"},{"path":"样式/默认/颜色","style":{"color":"#409EFF"}}]}]
["u_c1l","content","addChild",{"title":"分类1名称","ns":"pc.text","comId":"u_c1n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"前端开发"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_cy1","content","addChild",{"title":"分类1数量","ns":"pc.text","comId":"u_c1c","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"42"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_cay","content","addChild",{"title":"分类2","ns":"pc.custom-container","comId":"u_cy2","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRadius":"6px","padding":"8px 12px","background":"#F5F7FA"}},{"path":"样式/Hover/Hover","style":{"borderRadius":"6px","padding":"8px 12px","background":"#E6F4FF"}}]}]
["u_cy2","content","addChild",{"title":"分类2左侧","ns":"pc.custom-container","comId":"u_c2l","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_c2l","content","addChild",{"title":"分类2图标","ns":"pc.icon","comId":"u_c2i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"BugOutlined"},{"path":"样式/默认/颜色","style":{"color":"#67C23A"}}]}]
["u_c2l","content","addChild",{"title":"分类2名称","ns":"pc.text","comId":"u_c2n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"后端技术"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_cy2","content","addChild",{"title":"分类2数量","ns":"pc.text","comId":"u_c2c","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"28"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_cay","content","addChild",{"title":"分类3","ns":"pc.custom-container","comId":"u_cy3","enhance":true,"layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRadius":"6px","padding":"8px 12px","background":"#F5F7FA"}},{"path":"样式/Hover/Hover","style":{"borderRadius":"6px","padding":"8px 12px","background":"#E6F4FF"}}]}]
["u_cy3","content","addChild",{"title":"分类3左侧","ns":"pc.custom-container","comId":"u_c3l","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_c3l","content","addChild",{"title":"分类3图标","ns":"pc.icon","comId":"u_c3i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"CloudOutlined"},{"path":"样式/默认/颜色","style":{"color":"#E6A23C"}}]}]
["u_c3l","content","addChild",{"title":"分类3名称","ns":"pc.text","comId":"u_c3n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"云计算"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_cy3","content","addChild",{"title":"分类3数量","ns":"pc.text","comId":"u_c3c","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"15"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_cay","content","addChild",{"title":"分类4","ns":"pc.custom-container","comId":"u_cy4","enhance":true,"layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}},{"path":"样式/默认/默认","style":{"borderRadius":"6px","padding":"8px 12px","background":"#F5F7FA"}},{"path":"样式/Hover/Hover","style":{"borderRadius":"6px","padding":"8px 12px","background":"#E6F4FF"}}]}]
["u_cy4","content","addChild",{"title":"分类4左侧","ns":"pc.custom-container","comId":"u_c4l","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_c4l","content","addChild",{"title":"分类4图标","ns":"pc.icon","comId":"u_c4i","layout":{"width":20,"height":"fit-content","marginRight":8},"configs":[{"path":"常规/选择图标","value":"ReadOutlined"},{"path":"样式/默认/颜色","style":{"color":"#F56C6C"}}]}]
["u_c4l","content","addChild",{"title":"分类4名称","ns":"pc.text","comId":"u_c4n","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"生活随笔"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#333333","lineHeight":"22px"}}]}]
["u_cy4","content","addChild",{"title":"分类4数量","ns":"pc.text","comId":"u_c4c","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"23"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"#909399","lineHeight":"18px"}}]}]
["u_cac","content","addChild",{"title":"标签云区","ns":"pc.custom-container","comId":"u_tag","enhance":true,"layout":{"width":558,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_tag","content","addChild",{"title":"标签云标题","ns":"pc.text","comId":"u_tgt","layout":{"width":"fit-content","height":"fit-content","marginBottom":20},"configs":[{"path":"常规/内容","value":"热门标签"},{"path":"样式/默认/默认","style":{"fontSize":"20px","fontWeight":"bold","color":"#2C3E50","lineHeight":"28px"}}]}]
["u_tag","content","addChild",{"title":"标签列表","ns":"pc.tagList","comId":"u_tgl","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/基础/方向","value":"horizontal"},{"path":"常规/基础/标签间距","value":12},{"path":"常规/数据源","value":[{"key":"t1","content":"JavaScript","color":"default"},{"key":"t2","content":"Vue","color":"default"},{"key":"t3","content":"React","color":"default"},{"key":"t4","content":"TypeScript","color":"default"},{"key":"t5","content":"Node.js","color":"default"},{"key":"t6","content":"Webpack","color":"default"},{"key":"t7","content":"CSS","color":"default"},{"key":"t8","content":"HTML","color":"default"},{"key":"t9","content":"性能优化","color":"default"},{"key":"t10","content":"设计模式","color":"default"}]},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#606266","background":"#F5F7FA","borderRadius":"16px","border":"none","padding":"6px 16px"}}]}]
["_root_","_rootSlot_","addChild",{"title":"归档时间线区容器","ns":"pc.custom-container","comId":"u_arc","ignore":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]}]
["u_arc","content","addChild",{"title":"归档时间线卡片","ns":"pc.custom-container","comId":"u_ard","enhance":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}},{"path":"样式/默认/默认","style":{"background":"#FFFFFF","borderRadius":"8px","boxShadow":"0 2px 12px rgba(0,0,0,0.08)","padding":"24px"}}]}]
["u_ard","content","addChild",{"title":"归档标题栏","ns":"pc.custom-container","comId":"u_arh","ignore":true,"layout":{"width":"100%","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
["u_arh","content","addChild",{"title":"归档标题","ns":"pc.text","comId":"u_art","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"文章归档"},{"path":"样式/默认/默认","style":{"fontSize":"24px","fontWeight":"bold","color":"#2C3E50","lineHeight":"32px"}}]}]
["u_arh","content","addChild",{"title":"查看全部归档","ns":"pc.text","comId":"u_arl","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"查看全部 →"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"#409EFF","lineHeight":"22px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"14px","color":"#66B1FF","lineHeight":"22px"}}]}]
["u_ard","content","addChild",{"title":"时间轴","ns":"pc.timeline","comId":"u_tim","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/属性/内容位置","value":"left"},{"path":"常规/属性/排序方式","value":false},{"path":"样式/时间轴点","style":{"background":"#409EFF","borderRadius":"50%"}},{"path":"样式/标题","style":{"fontSize":"16px","color":"#434343","lineHeight":"24px"}},{"path":"样式/副标题","style":{"fontSize":"14px","color":"#909399","lineHeight":"22px"}},{"path":"样式/描述","style":{"fontSize":"14px","color":"#606266","lineHeight":"22px"}},{"path":"常规/数据源","value":[{"id":"m1","title":"2024年1月","subTitle":"","description":""},{"id":"a1","title":"TypeScript高级类型系统完全指南","subTitle":"01-10","description":""},{"id":"a2","title":"Vue 3.0组合式API实战指南","subTitle":"01-12","description":""},{"id":"a3","title":"深入理解JavaScript异步编程","subTitle":"01-15","description":""},{"id":"m2","title":"2023年12月","subTitle":"","description":""},{"id":"a4","title":"前端工程化实践总结","subTitle":"12-28","description":""},{"id":"a5","title":"React性能优化技巧","subTitle":"12-20","description":""}]}]}]
["_root_","_rootSlot_","addChild",{"title":"页脚区域","ns":"pc.custom-container","comId":"u_foo","enhance":true,"layout":{"width":"100%","height":"fit-content","marginTop":48},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","justifyContent":"center","alignItems":"center"}},{"path":"样式/默认/默认","style":{"background":"#2C3E50","padding":"48px 0"}}]}]
["u_foo","content","addChild",{"title":"页脚内容","ns":"pc.custom-container","comId":"u_foc","ignore":true,"layout":{"width":960,"height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
["u_foc","content","addChild",{"title":"博客简介","ns":"pc.text","comId":"u_fod","layout":{"width":"100%","height":"fit-content","marginBottom":16},"configs":[{"path":"常规/内容","value":"专注于前端技术分享与交流，记录技术成长的每一步"},{"path":"样式/默认/默认","style":{"fontSize":"14px","color":"rgba(255,255,255,0.8)","lineHeight":"22px","textAlign":"center"}}]}]
["u_foc","content","addChild",{"title":"页脚社交图标","ns":"pc.custom-container","comId":"u_fos","ignore":true,"layout":{"width":"fit-content","height":"fit-content","marginBottom":24},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_fos","content","addChild",{"title":"页脚GitHub","ns":"pc.icon","comId":"u_fg1","layout":{"width":24,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"GithubOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.8)"}},{"path":"样式/Hover/颜色","style":{"color":"#FFFFFF"}}]}]
["u_fos","content","addChild",{"title":"页脚微博","ns":"pc.icon","comId":"u_fg2","layout":{"width":24,"height":"fit-content","marginRight":16},"configs":[{"path":"常规/选择图标","value":"WeiboOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.8)"}},{"path":"样式/Hover/颜色","style":{"color":"#FFFFFF"}}]}]
["u_fos","content","addChild",{"title":"页脚邮箱","ns":"pc.icon","comId":"u_fg3","layout":{"width":24,"height":"fit-content"},"configs":[{"path":"常规/选择图标","value":"MailOutlined"},{"path":"样式/默认/颜色","style":{"color":"rgba(255,255,255,0.8)"}},{"path":"样式/Hover/颜色","style":{"color":"#FFFFFF"}}]}]
["u_foc","content","addChild",{"title":"分割线","ns":"pc.custom-container","comId":"u_fol","layout":{"width":"100%","height":1,"marginBottom":24},"configs":[{"path":"样式/默认/默认","style":{"background":"rgba(255,255,255,0.2)"}}]}]
["u_foc","content","addChild",{"title":"版权信息","ns":"pc.text","comId":"u_fcp","layout":{"width":"100%","height":"fit-content","marginBottom":8},"configs":[{"path":"常规/内容","value":"Copyright © 2024 MY BLOG. All Rights Reserved."},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"20px","textAlign":"center"}}]}]
["u_foc","content","addChild",{"title":"备案信息","ns":"pc.text","comId":"u_fic","layout":{"width":"100%","height":"fit-content","marginBottom":12},"configs":[{"path":"常规/内容","value":"ICP备案号：京ICP备xxxxxxxx号"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"20px","textAlign":"center"}}]}]
["u_foc","content","addChild",{"title":"次要链接","ns":"pc.custom-container","comId":"u_fli","ignore":true,"layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
["u_fli","content","addChild",{"title":"关于链接","ns":"pc.text","comId":"u_fl1","layout":{"width":"fit-content","height":"fit-content","marginRight":24},"configs":[{"path":"常规/内容","value":"关于本站"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"20px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"12px","color":"rgba(255,255,255,0.9)","lineHeight":"20px"}}]}]
["u_fli","content","addChild",{"title":"联系链接","ns":"pc.text","comId":"u_fl2","layout":{"width":"fit-content","height":"fit-content","marginRight":24},"configs":[{"path":"常规/内容","value":"联系方式"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"20px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"12px","color":"rgba(255,255,255,0.9)","lineHeight":"20px"}}]}]
["u_fli","content","addChild",{"title":"RSS链接","ns":"pc.text","comId":"u_fl3","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/内容","value":"RSS订阅"},{"path":"样式/默认/默认","style":{"fontSize":"12px","color":"rgba(255,255,255,0.6)","lineHeight":"20px"}},{"path":"样式/Hover/Hover","style":{"fontSize":"12px","color":"rgba(255,255,255,0.9)","lineHeight":"20px"}}]}]`

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