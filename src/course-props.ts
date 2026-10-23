import * as THREE from 'three';
import {RAINBOWS,SLIDE,WINDMILL_S,sample,world} from './track';
type Moving={kind:string;root:THREE.Group;part:THREE.Group};
const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.68,side:THREE.DoubleSide});
const cream=material('#fff4d9'),wood=material('#986643'),blue=material('#68bace'),yellow=material('#f8ca61');
function add(parent:THREE.Object3D,geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function pipe(parent:THREE.Object3D,points:THREE.Vector3[],radius:number,mat:THREE.Material){return add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),points.length*2,radius,6,false),mat);}
/** Cosmetic arches and chute follow the same centerline and water profile as physics. */
export function addLongCourseProps(scene:THREE.Scene,moving:Moving[],height:(x:number,z:number)=>number){
 for(const s of RAINBOWS){
  const p=sample(s),root=new THREE.Group();root.name='rainbow-arch';root.position.set(p.x,p.y+.12,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);
  const inner=Math.max(p.width+.65,Math.hypot(p.width-.65,3.3));
  ['#f37d87','#f8b260','#f4da72','#8bcba4','#79bfd6','#aa9dd5'].forEach((color,i)=>{
   add(root,new THREE.RingGeometry(inner+i*.16,inner+(i+1)*.16,40,1,0,Math.PI),material(color));
  });
  // Cloud feet stay outside the navigable channel; the middle remains fully open.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const cloud=add(root,new THREE.SphereGeometry(1,10,8),cream,side*(inner+.45)+(i-1)*.35,.15+(.3-Math.abs(i-1)*.14),0);cloud.scale.set(.5,.34,.4);
  }
  scene.add(root);
 }
 const slide=new THREE.Group();slide.name='waterslide-chute';const positions:number[]=[],indices:number[]=[];
 for(let i=0;i<=48;i++){
  const s=SLIDE.start+(SLIDE.end-SLIDE.start)*i/48,p=sample(s);
  for(const lane of [-p.width-.28,p.width+.28]){const v=world(s,lane);positions.push(v.x,p.y-.2,v.z);}
  if(i<48){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const floor=new THREE.BufferGeometry();floor.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));floor.setIndex(indices);floor.computeVertexNormals();add(slide,floor,blue);
 for(const side of [-1,1]){
  const wallPoints:number[]=[],wallIndices:number[]=[];
  for(let i=0;i<=48;i++){
   const s=SLIDE.start+(SLIDE.end-SLIDE.start)*i/48,p=sample(s),v=world(s,side*(p.width+.28));
   wallPoints.push(v.x,p.y-.25,v.z,v.x,p.y+.65,v.z);
   if(i<48){const a=i*2;wallIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const wall=new THREE.BufferGeometry();wall.setAttribute('position',new THREE.Float32BufferAttribute(wallPoints,3));wall.setIndex(wallIndices);wall.computeVertexNormals();add(slide,wall,blue);
  for(const y of [.05,.65]){
   const points=Array.from({length:49},(_,i)=>{const s=SLIDE.start+(SLIDE.end-SLIDE.start)*i/48,p=sample(s),v=world(s,side*(p.width+.28));return new THREE.Vector3(v.x,p.y+y,v.z);});pipe(slide,points,y>.1?.14:.3,y>.1?yellow:blue);
  }
  for(let i=0;i<=6;i++){
   const s=SLIDE.start+(SLIDE.end-SLIDE.start)*i/6,p=sample(s),v=world(s,side*(p.width+.3)),bottom=Math.min(p.y-.8,height(v.x,v.z));
   add(slide,new THREE.CylinderGeometry(.13,.18,p.y-bottom+.6,6),wood,v.x,(p.y+bottom+.6)/2,v.z);
  }
 }
 scene.add(slide);
 const p=sample(WINDMILL_S),v=world(WINDMILL_S,-p.width-2.8),root=new THREE.Group(),rotor=new THREE.Group();
 root.name='windmill-tower';root.position.set(v.x,p.y-.4,v.z);root.rotation.y=Math.atan2(p.tx,p.tz);
 add(root,new THREE.CylinderGeometry(.85,1.3,6.5,8),cream,0,3.25,0);add(root,new THREE.ConeGeometry(1.3,1.5,8),material('#c77f65'),0,7,0);
 rotor.position.set(0,5.5,1.1);root.add(rotor);
 const sail=material('#e9b16f');
 for(let i=0;i<4;i++){
  const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;
  add(arm,new THREE.BoxGeometry(.13,3.8,.15),wood,0,1.8,0);
  add(arm,new THREE.BoxGeometry(.7,2.2,.12),sail,.22,2.4,.02);rotor.add(arm);
 }
 add(rotor,new THREE.SphereGeometry(.32,12,8),wood,0,0,.2);
 scene.add(root);moving.push({kind:'wind-rotor',root,part:rotor});
 // A vertical rim-and-bucket wheel dips into the river beside the windmill.
 const wheelRoot=new THREE.Group(),wheel=new THREE.Group(),bank=world(WINDMILL_S,-p.width-.25);
 wheelRoot.name='mill-waterwheel';wheelRoot.position.set(bank.x,p.y+1.35,bank.z);wheelRoot.rotation.y=Math.atan2(p.tx,p.tz);wheelRoot.add(wheel);
 for(const x of [-.45,.45]){const rim=add(wheel,new THREE.TorusGeometry(2,.12,6,32),wood,x,0,0);rim.rotation.y=Math.PI/2;}
 for(let i=0;i<10;i++){
  const a=i/10*Math.PI*2,spoke=add(wheel,new THREE.BoxGeometry(.13,4,.13),wood);spoke.rotation.x=a;
  const bucket=add(wheel,new THREE.BoxGeometry(1.1,.32,.6),blue,0,Math.cos(a)*2,Math.sin(a)*2);bucket.rotation.x=a;
 }
 const axle=add(wheelRoot,new THREE.CylinderGeometry(.15,.15,3,8),wood,1,0,0);axle.rotation.z=Math.PI/2;
 scene.add(wheelRoot);moving.push({kind:'mill-waterwheel',root:wheelRoot,part:wheel});
 console.info('[world] long course props ready',{rainbows:RAINBOWS.length,slide:SLIDE,windmill:WINDMILL_S});
}
