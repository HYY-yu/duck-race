export type PageLanguage = 'en' | 'zh';

export function pageLanguage(pathname = location.pathname): PageLanguage {
  return /^\/zh(?:\/|$)/.test(pathname) ? 'zh' : 'en';
}

export function languagePath(language: PageLanguage, pathname = location.pathname, search = location.search) {
  const suffix = pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/^\/$/, '');
  const page = suffix && suffix !== '/' ? suffix : '/';
  return `/${language}${page.startsWith('/') ? page : `/${page}`}${search}`;
}
