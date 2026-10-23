import * as THREE from 'three';
import {FALLS,sample,world,bankWidth} from './track';
import {createWaterNormalTexture} from './water-material';
import {ParticleField} from './particles';
const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
/** The parent duck project's free sheet / aerated cords / plunge apron approach,
 * adapted to this course. The waterfall has real 3D geometry and air behind it. */
export function createFalls(scene:THREE.Scene,clock:{value:number},environment:THREE.Texture){
 const normalMap=createWaterNormalTexture(8129,128);
 const sheetMat=new THREE.MeshPhysicalMaterial({color:'#c2ede5',roughness:.17,metalness:0,transmission:.2,thickness:.3,ior:1.333,envMap:environment,envMapIntensity:.7,transparent:true,side:THREE.DoubleSide,depthWrite:false});
 sheetMat.customProgramCacheKey=()=> 'duck-rush-free-fall-v3';
 sheetMat.onBeforeCompile=shader=>{
  shader.uniforms.uFallTime=clock;shader.uniforms.uFallNormal={value:normalMap};
  shader.vertexShader='uniform float uFallTime;varying vec2 vFallUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFallUv=uv;').replace('#include <begin_vertex>',`#include <begin_vertex>
   transformed+=objectNormal*(sin(uv.x*18.+uv.y*10.-uFallTime*4.)*.065+sin(uv.x*37.-uFallTime*6.+uv.y*9.)*.025)*smoothstep(0.,.3,uv.y);
  `);
  shader.fragmentShader='uniform float uFallTime;uniform sampler2D uFallNormal;varying vec2 vFallUv;\n'+noise+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float fy=vFallUv.y;float drift=(noise(vec2(vFallUv.x*3.,fy*.5-uFallTime*.3))-.5)*.8;
   float cord=noise(vec2(vFallUv.x*25.+drift,fy*2.-uFallTime*2.));
   float seam=noise(vec2(vFallUv.x*48.-drift,fy*3.-uFallTime*2.7));
   float air=smoothstep(.08,.72,fy);float white=clamp(air*.36+smoothstep(.37,.7,cord)*air*.75-seam*.2,0.,.93);
   diffuseColor.rgb=mix(vec3(.08,.34,.32),vec3(.95,1.,.97),white);
   float edge=min(vFallUv.x,1.-vFallUv.x);float fray=.015+.055*fy;
   diffuseColor.a*=smoothstep(0.,fray,edge)*(.7+.3*cord)*(1.-smoothstep(.88,1.,fy)*smoothstep(.45,.75,seam)*.55);
  `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.12+white*.5;')
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 rn=texture2D(uFallNormal,vec2(vFallUv.x*3.4+drift,fy*.6-uFallTime*.5)).rg*2.-1.;
   normal=normalize(normal+vec3(rn.x*.32,rn.y*.13,0.)*(1.-white*.65));
  `);
 };
 const foamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:clock},vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.y+=sin(uv.x*24.+uv.y*8.-uTime*5.)*.08*sin(uv.y*3.14159);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uTime;varying vec2 vUv;${noise}void main(){float cells=noise(vec2(vUv.x*16.,vUv.y*6.-uTime*1.7));float fine=noise(vec2(vUv.x*41.+cells*2.,vUv.y*18.-uTime*3.));float foam=smoothstep(.28,.72,cells*.7+fine*.3);float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);float alpha=edge*exp(-vUv.y*2.7)*(.35+foam*.65);gl_FragColor=vec4(mix(vec3(.57,.81,.74),vec3(.94,1.,.96),foam),alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 for(const fall of FALLS){
  const top=sample(fall.lip),bottom=sample(fall.impact),drop=top.y-bottom.y;
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];const rows=48,cols=44;
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
   const t=r/rows,u=c/cols,s=fall.lip+(fall.impact-fall.lip)*t;
   const lane=(u*2-1)*bankWidth(fall.lip,u*2-1)*(1-.04*Math.sin(t*Math.PI)+.04*t*t),p=world(s,lane);
   pos.push(p.x,top.y+.035-drop*t*t,p.z);uv.push(u,t);
   if(r<rows&&c<cols){const a=r*(cols+1)+c,b=a+cols+1;idx.push(a,a+1,b,a+1,b+1,b);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const sheet=new THREE.Mesh(geo,sheetMat);sheet.name=`free-waterfall-${fall.lip}`;sheet.renderOrder=2;scene.add(sheet);
  const fp:number[]=[],fu:number[]=[],fi:number[]=[];
  for(let r=0;r<=28;r++)for(let c=0;c<=28;c++){
   const v=r/28,u=c/28,s=fall.impact-.12+v*7,p=sample(s),lane=(u*2-1)*(bankWidth(s,u*2-1)-.15),w=world(s,lane);
   const crest=Math.exp(-(((v-.10)/.10)**2))*.56*(.7+.3*Math.sin(u*Math.PI));
   fp.push(w.x,w.y+.10+crest,w.z);fu.push(u,v);if(r<28&&c<28){const a=r*29+c,b=a+29;fi.push(a,a+1,b,a+1,b+1,b);}
  }
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(fu,2));fg.setIndex(fi);const apron=new THREE.Mesh(fg,foamMat);apron.name='plunge-pool-standing-wave';apron.renderOrder=3;scene.add(apron);
 }
 const sprays=new ParticleField(360);scene.add(sprays.object);
 return {update(time:number){
  for(let i=0;i<360;i++){
   const fall=FALLS[Math.floor(i/180)],j=i%180,phase=((time*(j>155?.23:1.1)+j*.618033)%1),mist=j>155;
   const p=sample(fall.impact),lane=Math.sin(i*12.989)*p.width*.9,w=world(fall.impact,lane),life=mist?3:1.05,age=phase*life;
   const vy=2.1+((i*7)%11)*.2,down=age*(.8+(i%5)*.21),side=Math.sin(i*17)*age*.8;
   const y=mist?w.y+.25+age*.5:w.y+.18+vy*age-4.905*age*age;
   sprays.set(i,w.x+p.tx*down-p.tz*side,y,w.z+p.tz*down+p.tx*side,mist?1.1+age*.8:.10+(i%4)*.035,y<w.y?0:mist?Math.sin(phase*Math.PI)*.075:Math.sin(phase*Math.PI)*.8);
  }sprays.commit();
 }};
}
