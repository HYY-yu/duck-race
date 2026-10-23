import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';
import {buildRobots, buildSitemap, normalizeSiteUrl, PUBLIC_PATHS, renderAbsoluteSeo} from '../scripts/seo-config';
import {languagePath, pageLanguage} from '../src/i18n-routing';

test('language URLs are independently addressable and preserve game state parameters', () => {
  assert.equal(pageLanguage('/en/'), 'en');
  assert.equal(pageLanguage('/zh/how-to-play/'), 'zh');
  assert.equal(languagePath('zh', '/en/', '?track=long&seed=917'), '/zh/?track=long&seed=917');
  assert.equal(languagePath('en', '/zh/privacy/', ''), '/en/privacy/');
});

test('absolute SEO output requires an explicit non-local HTTPS origin', () => {
  assert.equal(normalizeSiteUrl(''), null);
  assert.throws(() => normalizeSiteUrl('http://localhost:5183'));
  const source = '<link rel="canonical" href="__SITE_URL__/en/">\n<meta property="og:image:width" content="1200" data-site-url-dependent>\n<meta name="description" content="kept">';
  assert.equal(renderAbsoluteSeo(source, null), '<meta name="description" content="kept">');
  const configured=renderAbsoluteSeo(source, 'https://duckrush.invalid');
  assert.match(configured, /https:\/\/duckrush\.invalid\/en\//);
  assert.doesNotMatch(configured,/data-site-url-dependent/);
});

test('sitemap includes only intentional language and help pages, never state parameters', () => {
  const sitemap = buildSitemap('https://duckrush.invalid', '2026-10-23');
  for (const path of PUBLIC_PATHS) assert.ok(sitemap.includes(`https://duckrush.invalid${path}`));
  assert.doesNotMatch(sitemap, /[?](?:seed|track|debug|inspect)=/);
  assert.doesNotMatch(sitemap, /404/);
  assert.match(buildRobots('https://duckrush.invalid'), /Sitemap: https:\/\/duckrush\.invalid\/sitemap\.xml/);
});

test('localized home source contains crawlable product copy and matching structured data', async () => {
  const [en, zh] = await Promise.all([readFile('en/index.html', 'utf8'), readFile('zh/index.html', 'utf8')]);
  assert.match(en, /<h1>Duck Race Name Picker<\/h1>/);
  assert.match(en, /2–12/);
  assert.match(en, /How it works/);
  assert.match(en, /application\/ld\+json/);
  assert.match(en, /Simple setup\. Wild 3D racing\. Transparent results\./);
  assert.match(en, /No preset winner/);
  assert.match(en, /Automatic-only public race/);
  assert.match(en, /no built-in endpoint that uploads the list/);
  assert.match(zh, /<h1>名单鸭子竞速器<\/h1>/);
  assert.match(zh, /2–12/);
  assert.match(zh, /使用方法/);
  assert.match(zh, /application\/ld\+json/);
  assert.match(zh, /设置简单。赛道刺激。自动结果透明。/);
  assert.match(zh, /无预设赢家/);
  assert.match(zh, /公开版本仅自动竞速/);
  assert.match(zh, /没有内置的名单上传接口/);
  assert.doesNotMatch(`${en}\n${zh}`,/manual control|manual steering|optional voice|人工控制|人工拨水|可选语音|语音控制/i);
  assert.doesNotMatch(`${en}\n${zh}`,/all data (?:always )?stays|所有数据.*(?:永不|只在本地)|no backdoor|无任何后门/i);
});

test('public build defaults to automatic-only while the local manual build needs an ignored flag', async () => {
  const [pkg, envExample, gitignore, main] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('.env.example', 'utf8'),
    readFile('.gitignore', 'utf8'),
    readFile('src/main.ts', 'utf8'),
  ]);
  assert.match(pkg, /"dev:manual":\s*"vite --mode manual/);
  assert.match(pkg, /"build:manual":\s*"tsc && vite build --mode manual/);
  assert.match(envExample, /VITE_ENABLE_MANUAL_MODE=false/);
  assert.match(gitignore, /\.env\.\*\.local/);
  assert.match(main, /const MANUAL_MODE=import\.meta\.env\.MODE==='manual'&&import\.meta\.env\.VITE_ENABLE_MANUAL_MODE==='true'/);
  assert.match(main, /if\(MANUAL_MODE\)\{\s*document\.addEventListener\('keydown'/);
  assert.match(main, /manualMode:MANUAL_MODE/);
});

test('generated favicon assets and the visual launch map are wired without becoming indexable pages', async () => {
  await Promise.all(['public/favicon-16.png','public/favicon-32.png','public/favicon.png','public/apple-touch-icon.png','assets/brand/favicon-imagegen-v1.png','public/social/duck-rush-og.jpg'].map(path=>access(path)));
  const [home,privacy,visual,socialImage]=await Promise.all([readFile('en/index.html','utf8'),readFile('en/privacy/index.html','utf8'),readFile('docs/seo-launch-visual.html','utf8'),readFile('public/social/duck-rush-og.jpg')]);
  assert.match(home,/href="\/favicon-32\.png"/);
  assert.doesNotMatch(home,/favicon\.svg/);
  assert.match(home,/social\/duck-rush-og\.jpg/);
  assert.match(home,/property="og:image:type" content="image\/jpeg"/);
  assert.deepEqual([...socialImage.subarray(0,3)],[0xff,0xd8,0xff]);
  assert.match(privacy,/no built-in account, name-upload endpoint, or remote name database/i);
  assert.match(privacy,/public build is automatic-only/i);
  assert.match(privacy,/does not render microphone controls, request microphone permission/i);
  assert.match(visual,/name="robots" content="noindex,nofollow"/);
  for(const id of ['market','position','architecture','performance','launch'])assert.match(visual,new RegExp(`id="${id}"`));
});
