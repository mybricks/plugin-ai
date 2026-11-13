export type ShowcaseLocale = "zh" | "en";

const STORAGE_KEY = "@mybricks/plugin-ai/showcase/locale";

function normalizeLocale(value: string | null): ShowcaseLocale {
  return value?.toLowerCase().startsWith("en") ? "en" : "zh";
}

/**
 * plugin-ai reads this host-level value during render. Resolve it before the
 * Designer creates the plugin so every plugin panel uses the selected locale.
 */
export function getShowcaseLocale(): ShowcaseLocale {
  return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
}

export function applyShowcaseLocale(locale: ShowcaseLocale): void {
  window.localStorage.setItem(STORAGE_KEY, locale);
  (window as Window & { __lang_type__?: ShowcaseLocale }).__lang_type__ = locale;
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
}
