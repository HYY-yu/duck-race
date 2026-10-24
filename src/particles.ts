import * as THREE from 'three';
const DEFAULT_TINT:readonly number[]=[.88,.98,.95];
/** Fixed-capacity GPU billboard pool. No allocations, timers or growing particle lists. */
export class ParticleField {
 readonly object:THREE.Points;private positions:Float32Array;private sizes:Float32Array;private alphas:Float32Array;private colors:Float32Array;
 constructor(count:number){this.positions=new Float32Array(count*3);this.sizes=new Float32Array(count);this.alphas=new Float32Array(count);this.colors=new Float32Array(count*3).fill(1);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('size',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('tint',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('alpha',new THREE.BufferAttribute(this.alphas,1).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:`attribute float size;attribute float alpha;attribute vec3 tint;varying vec3 vTint;varying float vAlpha;void main(){vTint=tint;vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*650./max(1.,-p.z),0.,96.);}`,fragmentShader:`varying vec3 vTint;varying float vAlpha;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;float a=pow(1.-r,1.7)*vAlpha;gl_FragColor=vec4(vTint,a);#include <tonemapping_fragment>
#include <colorspace_fragment>
}`.replace(';#include',';\n#include')});this.object=new THREE.Points(geometry,material);this.object.frustumCulled=false;this.object.renderOrder=4;}
 set(i:number,x:number,y:number,z:number,size:number,alpha:number,tint:readonly number[]=DEFAULT_TINT){const offset=i*3;this.colors[offset]=tint[0];this.colors[offset+1]=tint[1];this.colors[offset+2]=tint[2];this.positions[offset]=x;this.positions[offset+1]=y;this.positions[offset+2]=z;this.sizes[i]=size;this.alphas[i]=alpha;}
 commit(){for(const key of ['position','size','alpha','tint'])this.object.geometry.attributes[key].needsUpdate=true;}
}
