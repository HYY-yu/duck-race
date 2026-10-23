import * as THREE from 'three';

// Shared geometry: a closed collar and solid, rounded ribbons avoid the holes
// and thin floating fragments in the generated scarf mesh. Render-only costume.
const collar=new THREE.TorusGeometry(.54,.13,8,40);
collar.rotateX(Math.PI/2);
collar.scale(1,1.15,.88);
collar.translate(0,1.08,.22);
// Two short cloth points hang at the centre of the chest, away from both wings.
const left=new THREE.Shape();
left.moveTo(-.09,1.01);left.quadraticCurveTo(-.17,.79,-.34,.53);
left.quadraticCurveTo(-.17,.55,-.07,.61);left.quadraticCurveTo(.04,.78,.08,.97);left.closePath();
const right=new THREE.Shape();
right.moveTo(-.05,.98);right.quadraticCurveTo(.01,.71,.12,.43);
right.quadraticCurveTo(.23,.49,.3,.59);right.quadraticCurveTo(.18,.8,.1,1.01);right.closePath();
const tails=[left,right].map(shape=>{
 let geometry:THREE.BufferGeometry=new THREE.ExtrudeGeometry(shape,{depth:.025,steps:1,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2,curveSegments:12});
 // Subdivide before bending so the broad front faces follow the chest too;
 // bending only the outline would leave flat triangles cutting into the body.
 for(let pass=0;pass<2;pass++){
  const source=geometry.getAttribute('position'),vertices:number[]=[];
  for(let i=0;i<source.count;i+=3){
   const a=new THREE.Vector3().fromBufferAttribute(source,i),b=new THREE.Vector3().fromBufferAttribute(source,i+1),c=new THREE.Vector3().fromBufferAttribute(source,i+2);
   const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
   for(const point of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])vertices.push(point.x,point.y,point.z);
  }
  geometry.dispose();geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 }
 const positions=geometry.getAttribute('position');
 // Follow chest samples from the shipped 1.9-high duck, including its lateral
 // curvature. The previous straight depth offset left the knot under the bill
 // and the cloth floating in front of the concave upper chest.
 const profile=[.9294,.9628,.9791,.9709,.9406,.8781,.7737,.7461];
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=.86+(positions.getY(i)-1)*.8;
  const sample=THREE.MathUtils.clamp((y-.3)*10,0,profile.length-1),low=Math.floor(sample);
  const chest=THREE.MathUtils.lerp(profile[low],profile[Math.min(low+1,profile.length-1)],sample-low)-x*x;
  positions.setY(i,y);positions.setZ(i,positions.getZ(i)+chest+.04);
 }
 geometry.computeVertexNormals();return geometry;
});
const knot=new THREE.SphereGeometry(.13,16,10);knot.scale(.9,.75,.45);knot.translate(0,.89,.81);
const material=new THREE.MeshStandardMaterial({color:'#c52b3d',roughness:.88,metalness:0});

export function duckScarf(){
 const root=new THREE.Group();root.name='duck-scarf';
 for(const [i,geometry]of [collar,knot,...tails].entries()){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=i===0?'scarf-collar':i===1?'scarf-knot':`scarf-tail-${i-1}`;
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
 return root;
}
