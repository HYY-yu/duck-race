import type * as THREE from 'three';
import {Vector2} from 'three';

type PreviewView={position:[number,number,number];target:[number,number,number]};

declare global {
 interface Window {__DUCK_RUSH_CAPTURE_PREVIEW__?:(width?:number,height?:number,view?:PreviewView)=>string;}
}

/** Development-only native-resolution scene export, without DOM overlays or upscaling.
 * Rendering state is restored immediately so captures never change gameplay sizing. */
export function installPreviewCapture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
 window.__DUCK_RUSH_CAPTURE_PREVIEW__=(width=3200,height=2000,view)=>{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||width>4096||height>4096)throw new RangeError('Preview dimensions must be integers from 64 to 4096');
  const ratio=renderer.getPixelRatio(),aspect=camera.aspect,canvas=renderer.domElement,size=renderer.getSize(new Vector2());
  const position=camera.position.clone(),quaternion=camera.quaternion.clone();
  const style={width:canvas.style.width,height:canvas.style.height};
  try{
   renderer.setPixelRatio(1);renderer.setSize(width,height,false);
   if(view){camera.position.fromArray(view.position);camera.lookAt(...view.target);}
   camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);
   const png=canvas.toDataURL('image/png');console.info('[preview] scene captured',{width,height});return png;
  }catch(error){console.error('[preview] scene capture failed',{width,height,error});throw error;}
  finally{
   renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);
   canvas.style.width=style.width;canvas.style.height=style.height;
   camera.position.copy(position);camera.quaternion.copy(quaternion);
   camera.aspect=aspect;camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
 };
}
