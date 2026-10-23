import {resolve} from 'node:path';
import {defineConfig,loadEnv,type Plugin} from 'vite';
import {buildRobots,buildSitemap,normalizeSiteUrl,renderAbsoluteSeo} from './scripts/seo-config';

function seoOutput(siteUrl:string|null):Plugin {
 return {
  name:'duck-rush-seo-output',
  transformIndexHtml:{order:'pre',handler(html){return renderAbsoluteSeo(html,siteUrl);}},
  generateBundle(){
   this.emitFile({type:'asset',fileName:'robots.txt',source:buildRobots(siteUrl)});
   if(siteUrl)this.emitFile({type:'asset',fileName:'sitemap.xml',source:buildSitemap(siteUrl)});
   else this.warn('SITE_URL is not set: canonical, hreflang, absolute social image URLs and sitemap.xml are omitted.');
  },
 };
}

export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 const siteUrl=normalizeSiteUrl(env.SITE_URL);
 return {
  appType:'mpa',
  plugins:[seoOutput(siteUrl)],
  optimizeDeps:{entries:['en/index.html','zh/index.html']},
  build:{rollupOptions:{
   input:{
    root:resolve('index.html'),
    en:resolve('en/index.html'),zh:resolve('zh/index.html'),
    enHelp:resolve('en/how-to-play/index.html'),zhHelp:resolve('zh/how-to-play/index.html'),
    enPrivacy:resolve('en/privacy/index.html'),zhPrivacy:resolve('zh/privacy/index.html'),
    notFound:resolve('404.html'),
   },
   output:{manualChunks(id){if(id.includes('node_modules/three'))return 'three';}},
  }},
 };
});
