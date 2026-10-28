import {resolve} from 'node:path';
import {readdirSync,readFileSync} from 'node:fs';
import {defineConfig} from 'vite';

// Separate root, environment and output: never copy the website's routes or telemetry.
export default defineConfig({
 root:resolve('youtube'),base:'./',envDir:false,publicDir:false,
 server:{host:'127.0.0.1',port:5184,strictPort:true,fs:{allow:[resolve('.')]}},
 plugins:[{name:'youtube-preview-sdk',apply:'serve',transformIndexHtml(html){
  // Local development must not wait for YouTube connectivity. Production retains the SDK.
  return html.replace('<script src="https://www.youtube.com/game_api/v1"></script>','');
 }},{name:'youtube-local-models',
  configureServer(server){server.middlewares.use('/models/',(req,res,next)=>{
   const file=req.url?.split('?')[0];
   if(!file||!/^\/[a-z-]+\.glb$/.test(file))return next();
   try{res.setHeader('Content-Type','model/gltf-binary');res.end(readFileSync(resolve('public/models',file.slice(1))));}
   catch(error){console.warn('[youtube-assets] model unavailable',{file,error});res.statusCode=404;res.end();}
  });},
  generateBundle(){for(const name of readdirSync(resolve('public/models'))){if(name.endsWith('.glb'))this.emitFile({type:'asset',fileName:`models/${name}`,source:readFileSync(resolve('public/models',name))});}},
 }],
 build:{outDir:resolve('dist-youtube'),emptyOutDir:true,rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/three'))return 'three';}}}},
});
