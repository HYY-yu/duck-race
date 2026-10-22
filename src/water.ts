import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {createWaterMaterial} from './water-material';
import {FALLS,TRACK_LENGTH,LAKE_LEVEL,flow,inFall,sample,world} from './track';
import {createFalls} from './waterfall';

/** Adapted from the parent project's static canyon probe. A curved downhill river
 * is not a planar mirror: capture scenery once, then use a filtered cubemap. */
export function captureWaterEnvironment(renderer:THREE.WebGLRenderer,scene:THREE.Scene){
 const previousTarget=renderer.getRenderTarget(),auto=renderer.shadowMap.autoUpdate;
 const cube=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});
 const probe=new THREE.CubeCamera(.5,350,cube);probe.position.set(-3,33,2);
 const pmrem=new THREE.PMREMGenerator(renderer);const sky=new Sky();sky.scale.setScalar(1000);sky.material.uniforms.sunPosition.value.set(-35,70,30).normalize();sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.7;scene.add(sky);
 try{renderer.shadowMap.autoUpdate=false;probe.update(renderer,scene);const target=pmrem.fromCubemap(cube.texture);console.info('[water] static environment ready',{resolution:128});return target;}
 finally{scene.remove(sky);sky.geometry.dispose();sky.material.dispose();renderer.shadowMap.autoUpdate=auto;renderer.setRenderTarget(previousTarget);cube.dispose();pmrem.dispose();}
}
export class WaterSystem {
 readonly clock={value:0};readonly surface:THREE.MeshPhysicalMaterial;private falls:ReturnType<typeof createFalls>;
 constructor(scene:THREE.Scene,environment:THREE.Texture){
  this.surface=createWaterMaterial(this.clock,environment).material;
  this.river(scene);this.lake(scene);this.falls=createFalls(scene,this.clock,environment);
 }
 private river(scene:THREE.Scene){
  const positions:number[]=[],uv:number[]=[],data:number[]=[],shores:number[]=[],axes:number[]=[],impacts:number[]=[],banks:number[]=[],normals:number[]=[],indices:number[]=[];
  // Explicit lip/impact stations avoid triangles bridging the unsupported waterfall gap.
  const stations=new Set<number>(Array.from({length:1001},(_,i)=>i/1000*TRACK_LENGTH));
  FALLS.forEach(f=>{stations.add(f.lip);stations.add(f.impact)});
  const values=[...stations].sort((a,b)=>a-b),cols=24;
  for(let i=0;i<values.length;i++){
   const s=values[i],f=sample(s),next=sample(Math.min(TRACK_LENGTH,s+.15));const slope=Math.max(0,(f.y-next.y)/.15);
   for(let j=0;j<=cols;j++){
    const u=j/cols,l=(u*2-1)*f.width,p=world(s,l);
    positions.push(p.x,p.y+.035,p.z);uv.push(u,s);data.push(flow(s,l,0),.8+(1-(l/f.width)**2)*1.1,slope,2*f.width);shores.push(1,1,l);axes.push(f.tx,f.tz,-f.tz,f.tx);banks.push(f.width-Math.abs(l));
    impacts.push(Math.max(...FALLS.map(fall=>Math.exp(-(((s-fall.impact-1.3)/3.5)**2)))));
    const n=new THREE.Vector3(f.tx*slope,1,f.tz*slope).normalize();normals.push(n.x,n.y,n.z);
   }
   if(i<values.length-1&&!inFall((s+values[i+1])*.5))for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const geo=new THREE.BufferGeometry();for(const [key,arr,size]of [['position',positions,3],['uv',uv,2],['riverData',data,4],['riverShore',shores,3],['riverAxis',axes,4],['riverImpact',impacts,1],['riverBankDistance',banks,1],['normal',normals,3]]as [string,number[],number][])geo.setAttribute(key,new THREE.Float32BufferAttribute(arr,size));geo.setIndex(indices);
  const mesh=new THREE.Mesh(geo,this.surface);mesh.name='river-water';mesh.receiveShadow=true;scene.add(mesh);
  // A submerged bed gives transmission something spatial to refract. Depth varies
  // across the channel; the bottom is distinct from both the bank and water sheet.
  const bed=geo.clone(),pos=bed.attributes.position;const colors:number[]=[];
  for(let i=0;i<pos.count;i++){const u=uv[i*2];pos.setY(i,pos.getY(i)-.55-1.0*Math.sin(u*Math.PI));const c=new THREE.Color('#769d83');c.offsetHSL(0,0,Math.sin(pos.getX(i)*5+pos.getZ(i)*7)*.055);colors.push(c.r,c.g,c.b);}
  bed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bed.computeVertexNormals();
  const bedMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
  bedMaterial.onBeforeCompile=shader=>{shader.uniforms.uTime=this.clock;shader.vertexShader='varying vec3 vBed;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBed=position;');shader.fragmentShader='uniform float uTime;varying vec3 vBed;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float a=sin(vBed.x*3.+sin(vBed.z*2.+uTime)*.7+uTime*.7),b=sin(vBed.z*3.7+cos(vBed.x*2.-uTime)*.8-uTime*.5);
   float caustic=pow(1.-abs(a*b),18.);diffuseColor.rgb*=.82+caustic*.35;`);};
  const floor=new THREE.Mesh(bed,bedMaterial);floor.receiveShadow=true;floor.name='submerged-riverbed';scene.add(floor);
 }
 private lake(scene:THREE.Scene){
  // One continuous lake surrounds the mountain foot; exposed terrain forms its shoreline.
  const pos:number[]=[],uv:number[]=[],data:number[]=[],shore:number[]=[],axis:number[]=[],bank:number[]=[],norm:number[]=[],indices:number[]=[];const rings=64,segments=160;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){
   const radius=r/rings,angle=j/segments*Math.PI*2,coast=1+.055*Math.sin(angle*3)+.035*Math.cos(angle*5),x=Math.cos(angle)*radius*180*coast,z=Math.sin(angle)*radius*200*coast;
   pos.push(x,LAKE_LEVEL,12+z);uv.push((x/180+1)*.5,z+100);data.push(.32,3.2,.005,360);shore.push(0,0,x);axis.push(0,1,-1,0);bank.push((1-radius)*180);norm.push(0,1,0);
   if(r<rings&&j<segments){const a=r*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const geo=new THREE.BufferGeometry();for(const [k,arr,n]of [['position',pos,3],['uv',uv,2],['riverData',data,4],['riverShore',shore,3],['riverAxis',axis,4],['riverBankDistance',bank,1],['normal',norm,3],['riverImpact',bank.map(()=>0),1]]as [string,number[],number][])geo.setAttribute(k,new THREE.Float32BufferAttribute(arr,n));geo.setIndex(indices);
  const lake=new THREE.Mesh(geo,this.surface);lake.name='river-water-lake';scene.add(lake);
 }
 update(time:number){this.clock.value=time;this.falls.update(time);}
}
