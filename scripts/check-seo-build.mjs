import {readFile, access, readdir} from 'node:fs/promises';

const required = [
  ['dist/en/index.html', 'lang="en"', '<h1>Duck Race Name Picker</h1>'],
  ['dist/zh/index.html', 'lang="zh-CN"', '<h1>名单鸭子竞速器</h1>'],
  ['dist/en/how-to-play/index.html', 'How Duck Rush works'],
  ['dist/zh/how-to-play/index.html', 'Duck Rush 玩法与规则'],
  ['dist/en/privacy/index.html', 'Privacy'],
  ['dist/zh/privacy/index.html', '隐私说明'],
  ['dist/404.html', 'Page not found'],
];

const htmlByPath = new Map();
for (const [path, ...needles] of required) {
  const html = await readFile(path, 'utf8');
  htmlByPath.set(path, html);
  for (const needle of needles) {
    if (!html.includes(needle)) throw new Error(`${path} is missing ${needle}`);
  }
  if (html.includes('__SITE_URL__') || /https?:\/\/(?:localhost|example\.com)/.test(html)) {
    throw new Error(`${path} contains an unsafe production URL`);
  }
}

const en = await readFile('dist/en/index.html', 'utf8');
const zh = await readFile('dist/zh/index.html', 'utf8');
const enRules = await readFile('dist/en/how-to-play/index.html', 'utf8');
const zhRules = await readFile('dist/zh/how-to-play/index.html', 'utf8');
const socialImage = await readFile('dist/social/duck-rush-og.jpg');
if (!socialImage.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) throw new Error('Social image must contain JPEG bytes');
for(const width of [1600,3200]){
  const preview=await readFile(`dist/previews/duck-rush-race-${width}.webp`);
  if(preview.toString('ascii',0,4)!=='RIFF'||preview.toString('ascii',8,12)!=='WEBP')throw new Error('Loading preview must contain WebP bytes');
  if(preview.length>180000)throw new Error('Loading preview exceeds its 180 kB download budget');
  for(const html of [en,zh])if(!html.includes(`/previews/duck-rush-race-${width}.webp`))throw new Error('Localized home is missing a responsive loading preview');
}
if (process.env.SITE_URL && (!en.includes('social/duck-rush-og.jpg') || !en.includes('content="image/jpeg"'))) throw new Error('English social metadata must reference the JPEG share image');
if (process.env.SITE_URL && (!zh.includes('social/duck-rush-og.jpg') || !zh.includes('content="image/jpeg"'))) throw new Error('Chinese social metadata must reference the JPEG share image');
for (const path of ['dist/en/index.html','dist/zh/index.html']) {
  const html=htmlByPath.get(path);
  if ((html.match(/<title>/g) || []).length !== 1 || (html.match(/<meta name="description"/g) || []).length !== 1 || (html.match(/<h1(?:\s|>)/g) || []).length !== 1) {
    throw new Error(`${path} must contain exactly one title, description, and crawlable H1`);
  }
}
if (!htmlByPath.get('dist/404.html').includes('name="robots" content="noindex,follow"')) throw new Error('404 page must be noindex,follow');
for (const [path, html] of [['dist/en/index.html', en], ['dist/zh/index.html', zh], ['dist/en/how-to-play/index.html', enRules], ['dist/zh/how-to-play/index.html', zhRules]]) {
  if (/manual control|manual steering|optional voice|人工控制|人工拨水|可选语音|语音控制/i.test(html)) {
    throw new Error(`${path} exposes the local-only manual mode`);
  }
}
if (process.env.DUCK_RUSH_MANUAL_BUILD !== 'true') {
  const mainAsset = (await readdir('dist/assets')).find(name => /^main-.*\.js$/.test(name));
  if (!mainAsset) throw new Error('Default build is missing the main application asset');
  const bundle = await readFile(`dist/assets/${mainAsset}`, 'utf8');
  for (const forbidden of ['Local manual mode enabled', '[voice] command accepted', 'id="voice"', 'id="voice-log"', 'KeyA']) {
    if (bundle.includes(forbidden)) throw new Error(`Default build still contains manual runtime entry: ${forbidden}`);
  }
}
if (process.env.SITE_URL) {
  for (const path of required.slice(0,6).map(([path])=>path)) {
    const html=htmlByPath.get(path);
    if (!html.includes('rel="canonical"') || !html.includes('hreflang="en"') || !html.includes('hreflang="zh-CN"') || !html.includes('hreflang="x-default"')) {
      throw new Error(`${path} is missing canonical or hreflang links`);
    }
  }
  await access('dist/sitemap.xml');
} else {
  if (en.includes('rel="canonical"') || zh.includes('rel="canonical"')) throw new Error('Unconfigured build must not emit production canonicals');
}

console.info('[seo] production HTML checks passed', {siteUrlConfigured: Boolean(process.env.SITE_URL)});
