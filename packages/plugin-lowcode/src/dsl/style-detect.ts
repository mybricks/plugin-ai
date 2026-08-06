const STYLE_PROPS = new Set([
  "background", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
  "color", "opacity",
  "fontSize", "fontWeight", "fontStyle", "fontFamily", "lineHeight", "letterSpacing", "textAlign", "textDecoration", "textOverflow", "whiteSpace",
  "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
  "borderWidth", "borderStyle", "borderColor", "borderRadius",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "boxShadow", "outline",
  "transform", "transition", "animation",
]);

export function isStyleValue(path: string, value: unknown): boolean {
  if (path.includes("样式")) return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value as object);
    return keys.length > 0 && keys.some((k) => STYLE_PROPS.has(k));
  }
  return false;
}

export function flatConfigsToArray(configs: Record<string, any>): Array<{ path: string; value?: any; style?: any }> {
  return Object.entries(configs).map(([path, value]) => {
    if (isStyleValue(path, value)) return { path, style: value };
    return { path, value };
  });
}
