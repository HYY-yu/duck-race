import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LANGUAGES,pageLanguage,languagePath} from '../src/i18n-routing';
import {dict,drawCopy,voiceCopy} from '../src/ui-copy';
import {COLOR_NAMES} from '../src/duck-palette';
import {courseLabel} from '../src/track-navigation';
import {parseParticipants,resultText,type SavedDraw} from '../src/draw';
import {PUBLIC_PATHS} from '../scripts/seo-config';

test('Vietnamese routes switch among all languages without losing page, track, seed or fragment',()=>{
 assert.equal(pageLanguage('/vi/'),'vi');
 assert.equal(pageLanguage('/vi/privacy/'),'vi');
 assert.equal(pageLanguage('/vietnam/'),'en');
 for(const from of LANGUAGES)for(const to of LANGUAGES){
  assert.equal(languagePath(to,`/${from}/privacy/`,'?track=long&seed=42','#data'),`/${to}/privacy/?track=long&seed=42#data`);
 }
});

test('Vietnamese tool dictionaries cover every existing key and use distinct localized UI copy',()=>{
 for(const copy of [dict,drawCopy,voiceCopy])assert.deepEqual(Object.keys(copy.vi).sort(),Object.keys(copy.en).sort());
 assert.equal(COLOR_NAMES.vi.length,12);
 assert.equal(dict.vi.mountainTrack,courseLabel('mountain','vi'));
 assert.equal(dict.vi.longTrack,courseLabel('long','vi'));
 const copy=JSON.stringify({dict:dict.vi,draw:drawCopy.vi,colors:COLOR_NAMES.vi});
 assert.doesNotMatch(copy,/[\u4e00-\u9fff]|Start draw|Full finishing order|Copy results|Set up draw/);
 assert.match(drawCopy.vi.count,/2.*12/);
 assert.match(drawCopy.vi.length,/40/);
});

test('Vietnamese diacritics survive validation and copied full ranking without changing selection rules',()=>{
 assert.equal(parseParticipants('An\nBình\nChi').error,null);
 assert.equal(parseParticipants('Bình\nbình').error,'duplicate');
 assert.equal(parseParticipants('Bình\nBình').error,'duplicate');
 const record:SavedDraw={mode:'ranking',date:'2026-10-26T00:00:00Z',seed:42,course:'mountain',trackSeed:17,drawId:'DR-'+'a'.repeat(32),names:['An','Bình','Chi'],results:[{id:1,time:28},{id:2,time:29},{id:0,time:30}]};
 const text=resultText(record,'vi',String);
 assert.match(text,/Bảng xếp hạng đầy đủ\n1\. Bình\n2\. Chi\n3\. An/);
 assert.match(text,/Ghềnh Tuyết/);
 assert.match(text,/Mã ngẫu nhiên: 42/);
 assert.match(text,/không phải bằng chứng đã được kiểm toán độc lập/);
 assert.doesNotMatch(text,/Full finishing|Selected|Track seed|中签/);
});

test('all nine localized pages have reciprocal matching alternates, language navigation and sitemap routes',async()=>{
 assert.equal(PUBLIC_PATHS.length,9);
 for(const suffix of ['','how-to-play/','privacy/'])for(const language of LANGUAGES){
  const page=await readFile(`${language}/${suffix}index.html`,'utf8');
  assert.match(page,new RegExp(`<html lang="${language==='zh'?'zh-CN':language}"`));
  assert.ok(page.includes(`rel="canonical" href="__SITE_URL__/${language}/${suffix}"`));
  for(const other of LANGUAGES){
   const hreflang=other==='zh'?'zh-CN':other;
   assert.ok(page.includes(`hreflang="${hreflang}" href="__SITE_URL__/${other}/${suffix}"`));
   if(other!==language)assert.ok(page.includes(`href="/${other}/${suffix}"`),'matching language navigation');
  }
  assert.ok(page.includes(`hreflang="x-default" href="__SITE_URL__${suffix?'/en/'+suffix:'/'}"`));
 }
});

test('Vietnamese crawlable shell matches runtime intro and makes limits, privacy and illustrative results explicit',async()=>{
 const [home,main,help,privacy,entry]=await Promise.all(['vi/index.html','src/main.ts','vi/how-to-play/index.html','vi/privacy/index.html','src/entry.ts'].map(p=>readFile(p,'utf8')));
 const intro=home.match(/<p class="game-intro">([^<]+)<\/p>/)![1];
 assert.ok(main.includes(intro));
 const schema=JSON.parse(home.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)![1]);
 assert.equal(schema.isAccessibleForFree,true);
 assert.ok(schema.inLanguage.includes('vi'));
 assert.equal(schema.aggregateRating,undefined);
 assert.match(home,/Ví dụ minh họa/);
 assert.match(home,/hư cấu, không phải kết quả/);
 assert.match(home,/2–12 tên khác nhau/);
 assert.match(home,/không chứng minh mọi vịt có xác suất thắng bằng nhau/);
 assert.match(help,/không phải dịch vụ ngẫu nhiên được chứng nhận/);
 assert.match(privacy,/không dùng cookie phân tích lưu lâu dài/);
 assert.match(privacy,/không có tên hay nội dung sao chép/);
 assert.match(entry,/Không thể tải trò chơi 3D/);
 for(const page of [home,help,privacy])assert.doesNotMatch(page,/Start draw|Full finishing order|Copy results|How Duck Rush works/);
});
