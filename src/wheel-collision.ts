/** Shared dimensions for the horizontal rotor, in its rendered local coordinates. */
export const WHEEL={speed:.9,height:1.1,arms:4,duckRadius:1.2,
 arm:{z:1.5,y:0,width:.15,height:.2,length:3},
 paddle:{z:2.6,y:-.1,width:1.5,height:1.2,length:.3},
 hub:{z:0,y:.2,width:1.2,height:.5,length:1.2}} as const;
export interface WheelContact {x:number;z:number;nx:number;nz:number;depth:number;}
/** Circle vs. the actual rotating boxes, including the full spokes, not tip circles.
 * x/z and normals use the obstacle root's frame (x is the negative lane direction).
 * The duck's vertical body interval avoids hitting rotors it is flying over/under. */
export function wheelContacts(x:number,z:number,y:number,time:number):WheelContact[]{
 const contacts:WheelContact[]=[];
 for(let i=-1;i<WHEEL.arms;i++){
  const angle=i<0?0:time*WHEEL.speed+i*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
  const rx=c*x-s*z,rz=s*x+c*z;
  for(const shape of i<0?[WHEEL.hub]:[WHEEL.arm,WHEEL.paddle]){
   const bottom=WHEEL.height+shape.y-shape.height/2,top=bottom+shape.height;
   if(y>top||y+1.9<bottom)continue;
   const hx=shape.width/2,hz=shape.length/2,px=rx,pz=rz-shape.z;
   const qx=Math.max(-hx,Math.min(hx,px)),qz=Math.max(-hz,Math.min(hz,pz));
   let nx=px-qx,nz=pz-qz,distance=Math.hypot(nx,nz),depth=WHEEL.duckRadius-distance;
   if(depth<=0)continue;
   if(distance>1e-8){nx/=distance;nz/=distance;}
   else if(hx-Math.abs(px)<hz-Math.abs(pz)){nx=Math.sign(px)||1;nz=0;depth=WHEEL.duckRadius+hx-Math.abs(px);}
   else{nx=0;nz=Math.sign(pz)||-1;depth=WHEEL.duckRadius+hz-Math.abs(pz);}
   contacts.push({x:c*qx+s*(qz+shape.z),z:-s*qx+c*(qz+shape.z),nx:c*nx+s*nz,nz:-s*nx+c*nz,depth});
  }
 }
 return contacts;
}
