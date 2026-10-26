const PUBLIC_PATHS = [
  '/en/',
  '/zh/',
  '/vi/',
  '/en/how-to-play/',
  '/zh/how-to-play/',
  '/vi/how-to-play/',
  '/en/privacy/',
  '/zh/privacy/',
  '/vi/privacy/',
];

export function normalizeSiteUrl(value?: string) {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:') throw new Error('SITE_URL must use https://');
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must contain only the production origin, without a path, query, or hash');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('SITE_URL must be the public production origin, not localhost');
  }
  return url.origin;
}

export function renderAbsoluteSeo(html: string, siteUrl: string | null) {
  if (!siteUrl) {
    return html
      .split('\n')
      .filter(line => !line.includes('__SITE_URL__') && !line.includes('data-site-url-dependent'))
      .join('\n');
  }
  return html.replaceAll('__SITE_URL__', siteUrl).replaceAll(' data-site-url-dependent','');
}

export function buildRobots(siteUrl: string | null) {
  return ['User-agent: *', 'Allow: /', ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : []), ''].join('\n');
}

export function buildSitemap(siteUrl: string, lastModified = new Date().toISOString().slice(0, 10)) {
  const urls = PUBLIC_PATHS.map(path => `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <lastmod>${lastModified}</lastmod>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export {PUBLIC_PATHS};
