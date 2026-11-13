export type PlaygroundLocale = "zh" | "en";

const LOCALE_QUERY_KEY = "lang";

export function getPlaygroundLocale(): PlaygroundLocale {
  const locale = new URLSearchParams(window.location.search).get(LOCALE_QUERY_KEY);
  return locale?.toLowerCase().startsWith("en") ? "en" : "zh";
}

/** Applies the host-level locale before plugin UI is created. */
export function applyPlaygroundLocale(locale: PlaygroundLocale): void {
  (window as Window & { __lang_type__?: PlaygroundLocale }).__lang_type__ = locale;
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
}

/** URL is the source of truth; no local preference is persisted. */
export function navigateToPlaygroundLocale(locale: PlaygroundLocale): void {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(LOCALE_QUERY_KEY, locale);
  window.location.assign(nextUrl.toString());
}
