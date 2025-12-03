import { context } from './../src/context';
import { createActionsParser } from './../src/tools/utils'

window.plugin_ai_context = context

window.getActions = () => {
  const parser = createActionsParser();

  const actions = parser(`["u_bP96M",":root","setLayout",{"height":812}]
["u_bP96M",":root","doConfig",{"path":"页面/顶部栏/导航栏类型","value":"none"}]
["u_bP96M",":root","doConfig",{"path":"样式/内容区/背景","style":{"background":"linear-gradient(180deg, #2C2C2C 0%, #1A1A1A 100%)"}}]
["u_9nu7q",":root","setLayout",{"height":60,"marginTop":40}]
["u_9nu7q",":root","doConfig",{"path":"样式/样式","style":{"background":"transparent"}}]
["u_VQsE6",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u__KtoC",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u__1wt2",":root","setLayout",{"width":260,"height":260,"marginTop":60}]
["u__1wt2",":root","doConfig",{"path":"图片/基础属性/图片链接","value":"https://ai.mybricks.world/image-search?term=music+album&w=260&h=260"}]
["u__1wt2",":root","doConfig",{"path":"样式/图片","style":{"borderRadius":"50%","boxShadow":"0 8px 24px rgba(236,65,65,0.4)","border":"8px solid rgba(236,65,65,0.2)"}}]
["u_SqSzi",":root","setLayout",{"height":80,"marginTop":40}]
["u_SqSzi",":root","doConfig",{"path":"样式/样式","style":{"background":"transparent"}}]
["u_us8Mh",":root","doConfig",{"path":"样式/样式","style":{"fontSize":"20px","fontWeight":"600","color":"#FFFFFF","lineHeight":"28px","textAlign":"center"}}]
["u_zzXqb",":root","doConfig",{"path":"样式/样式","style":{"fontSize":"14px","color":"#999999","lineHeight":"20px","textAlign":"center"}}]
["u_KeW8_",":root","setLayout",{"marginTop":40}]
["u_KeW8_",":root","doConfig",{"path":"进度条/进度条样式/进度条颜色","value":"#EC4141"}]
["u_KeW8_",":root","doConfig",{"path":"进度条/进度条样式/背景颜色","value":"#404040"}]
["u_1qTfg",":root","setLayout",{"height":80,"marginTop":40}]
["u_1qTfg",":root","doConfig",{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center","alignItems":"center"}}]
["u_1qTfg",":root","doConfig",{"path":"样式/样式","style":{"background":"transparent"}}]
["u_TQgO2",":root","setLayout",{"width":40,"height":40,"marginRight":60}]
["u_TQgO2",":root","doConfig",{"path":"图标/基础属性/大小","value":32}]
["u_TQgO2",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u_taXoA",":root","setLayout",{"width":64,"height":64}]
["u_taXoA",":root","doConfig",{"path":"图标/基础属性/大小","value":40}]
["u_taXoA",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u_taXoA",":root","doConfig",{"path":"样式/图标","style":{"background":"#EC4141","borderRadius":"50%","padding":"12px"}}]
["u_VES3L",":root","setLayout",{"width":40,"height":40,"marginLeft":60}]
["u_VES3L",":root","doConfig",{"path":"图标/基础属性/大小","value":32}]
["u_VES3L",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u_YuwH7",":root","setLayout",{"height":60,"marginTop":50}]
["u_YuwH7",":root","doConfig",{"path":"样式/样式","style":{"background":"transparent"}}]
["u_XfIIA",":root","doConfig",{"path":"图标/基础属性/大小","value":28}]
["u_XfIIA",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#EC4141"}]
["u_cLtQM",":root","doConfig",{"path":"图标/基础属性/大小","value":28}]
["u_cLtQM",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u_d4cyl",":root","doConfig",{"path":"图标/基础属性/大小","value":28}]
["u_d4cyl",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
["u_NW2ja",":root","doConfig",{"path":"图标/基础属性/大小","value":28}]
["u_NW2ja",":root","doConfig",{"path":"图标/高级属性/颜色","value":"#FFFFFF"}]
`);

  console.log(actions)

  return actions
}

window.testComActions = () => (async (api) => {
    // 移动元素
    await api?.uiCom?.api?.updateCom('u_bP96M', window.getActions(), 'start');
    
    // 延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 最后调用空数组，第三个参数为complete
    await api?.uiCom?.api?.updateCom('u_bP96M', [], 'complete');
    
})(window.plugin_ai_context.api);

window.testPageActions = () => (async (api) => {
    // 移动元素
    await api?.page?.api?.updatePage('u___Zn5', window.getActions(), 'start');
    
    // 延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 最后调用空数组，第三个参数为complete
    await api?.page?.api?.updatePage('u___Zn5', [], 'complete');
    
})(window.plugin_ai_context.api);