export const LANGUAGES = ['en', 'zh', 'vi'] as const;
export type PageLanguage = typeof LANGUAGES[number];
export const LANGUAGE_NAMES = {en: 'English', zh: '中文', vi: 'Tiếng Việt'};
export const localized = (language: PageLanguage, zh: string, en: string, vi: string) => ({zh, en, vi})[language];

export function pageLanguage(pathname = location.pathname): PageLanguage {
  return /^\/zh(?:\/|$)/.test(pathname) ? 'zh' : /^\/vi(?:\/|$)/.test(pathname) ? 'vi' : 'en';
}

export function languagePath(language: PageLanguage, pathname = location.pathname, search = location.search, hash = typeof location === 'undefined' ? '' : location.hash) {
  const suffix = pathname.replace(/^\/(?:en|zh|vi)(?=\/|$)/, '').replace(/^\/$/, '');
  const page = suffix && suffix !== '/' ? suffix : '/';
  return `/${language}${page.startsWith('/') ? page : `/${page}`}${search}${hash}`;
}
