import * as THREE from 'three';
/** Sparse small clouds and translucent crest mist; scene-owned, with no physics input. */
export function addAlpineAtmosphere(scene:THREE.Scene,reducedMotion:boolean,height:(x:number,z:number)=>number){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Cloud texture canvas unavailable');
 for(const [x,y,r]of [[72,76,38],[110,59,46],[151,70,38],[183,82,25],[111,88,48]]){
  const gradient=ctx.createRadialGradient(x,y,r*.1,x,y,r);gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.45,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const clouds:THREE.Sprite[]=[],group=new THREE.Group();group.name='alpine-clouds-and-summit-mist';
 const placements=[[-75,145,-10,24],[55,170,-5,25],[110,128,55,22],[-90,130,80,20],[30,155,125,24]];
 for(const [i,p]of placements.entries()){
  const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:.65,fog:false}));cloud.position.set(p[0],p[1],p[2]);cloud.scale.set(p[3],p[3]*.48,1);cloud.name=`small-white-cloud-${i}`;cloud.userData.base=cloud.position.clone();group.add(cloud);clouds.push(cloud);
 }
 const mist:THREE.Sprite[]=[];
 for(let i=0;i<3;i++){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:.11,fog:true}));const x=-15+i*15,z=-10+i*7;sprite.position.set(x,height(x,z)+5,z);sprite.scale.set(45,15,1);sprite.name='thin-summit-mist';sprite.userData.base=sprite.position.clone();group.add(sprite);mist.push(sprite);
 }
 scene.add(group);console.info('[world] alpine atmosphere ready',{clouds:clouds.length,mist:mist.length});
 return {update(time:number){if(reducedMotion)return;for(const [i,c]of clouds.entries()){c.position.x=c.userData.base.x+Math.sin(time*.025+i)*5;c.position.z=c.userData.base.z+Math.sin(time*.014+i*2)*2;}for(const [i,m]of mist.entries()){m.position.x=m.userData.base.x+Math.sin(time*.05+i)*4;m.material.opacity=.09+Math.sin(time*.08+i)*.015;}}};
}
