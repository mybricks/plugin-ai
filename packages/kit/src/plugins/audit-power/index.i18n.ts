export function getAuditPowerTitles(locale = "zh") {
  return /^en(?:[-_]|$)/i.test(locale.trim())
    ? { agent: "Page audit", understandPage: "Page analysis", validatePage: "Page document validation" }
    : { agent: "页面审计", understandPage: "页面分析", validatePage: "页面文档校验" };
}
