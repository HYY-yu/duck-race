import * as THREE from 'three';
import { BatchedRenderer, ParticleSystem, ConeEmitter, ConstantValue, IntervalValue, ConstantColor,
  ColorOverLife, Gradient, SizeOverLife, PiecewiseBezier, Bezier, ApplyForce, RenderMode, Vector3, Vector4 } from 'three.quarks';
import { HEADWATER, sampleCourse, sampleChannel } from './course.ts';
import type { Duck } from './simulation.ts';
import { WATER_WAVE_GLSL } from './water-wave.ts';
import { createWaterNormalTexture } from './water-material.ts';

/** A free water sheet plus quarks spray. This is authored VFX, not a fluid solver.
 * Particle randomness affects decoration only and never enters the race simulation.
 */
export function createHeadwaterFall(scene: THREE.Scene, environment?: THREE.Texture) {
  const root = new THREE.Group(); root.name = 'headwater-waterfall'; scene.add(root);
  const clock = { value: 0 }, textures: THREE.Texture[] = [], materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const normalMap = createWaterNormalTexture(8129); textures.push(normalMap);
  const material = new THREE.MeshPhysicalMaterial({color: 0x9adbd1, roughness: .19, metalness: 0,
    transmission: .48, thickness: .22, ior: 1.333, envMap: environment ?? null, envMapIntensity: .65,
    transparent: true, opacity: .94, side: THREE.DoubleSide, depthWrite: false});
  materials.push(material);
  material.customProgramCacheKey = () => 'headwater-sheet-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.uFallTime = clock; shader.uniforms.uFallNormal = {value: normalMap};
    shader.vertexShader = 'uniform float uFallTime; varying vec2 vFallUv;\n' + WATER_WAVE_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvFallUv=uv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float lipWidth=${sampleCourse(HEADWATER.lip).width.toFixed(8)};
        float lateral=(uv.x-.5)*lipWidth;
        transformed.y += riverSurfaceWave(${HEADWATER.lip.toFixed(1)},lateral,min(uv.x,1.-uv.x)*lipWidth,uFallTime)*pow(1.-uv.y,2.);
        transformed.y += sin(uv.x*61.+uv.y*24.-uFallTime*8.)*.035*sin(uv.y*3.14159265);
      `);
    shader.fragmentShader = `uniform float uFallTime; uniform sampler2D uFallNormal; varying vec2 vFallUv;
      float fallNoise(vec2 p) {return texture2D(uFallNormal,p).r;}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // Two scales of elongated water fingers, with irregular aeration towards impact.
      vec2 p = vec2(vFallUv.x * 5.2, vFallUv.y * .92 - uFallTime * .55);
      float broad = fallNoise(p + vec2(fallNoise(p*.6)*.18,0.));
      float fine = fallNoise(p * vec2(4.3, 1.9) - vec2(0.,uFallTime*.24));
      float finger = smoothstep(.49,.69,broad*.55+fine*.45);
      float aeration = smoothstep(.13,.94,vFallUv.y);
      float whitewater = clamp(finger * (.22 + aeration*.66),0.,.92);
      diffuseColor.rgb=mix(vec3(.19,.57,.55),vec3(.91,.98,.95),whitewater);
      diffuseColor.a *= mix(1., .62 + finger*.38, aeration);
    `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = .16 + whitewater*.38;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 ripple=texture2D(uFallNormal,p*vec2(2.,.7)).rg*2.-1.;
        normal=normalize(normal+vec3(ripple.x*.16,ripple.y*.08,0.));
      `);
  };
  const upper = sampleCourse(HEADWATER.lip), lower = sampleCourse(HEADWATER.impact);
  const drop = upper.y-lower.y;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns=36, rows=64;
  for(let row=0;row<=rows;row++) {
    const t=row/rows,s=THREE.MathUtils.lerp(HEADWATER.lip,HEADWATER.impact,t),f=sampleCourse(s);
    for(let col=0;col<=columns;col++) {
      const u=col/columns, lateral=(u-.5)*upper.width*(1-.04*Math.sin(t*Math.PI));
      const fold=Math.sin(u*49+t*15)*Math.sin(Math.PI*t)*.055;
      positions.push(f.x+f.nx*lateral,upper.y+.035-drop*t*t+fold,f.z+f.nz*lateral);
      uv.push(u,t);
      if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometries.push(geometry);
  const sheet=new THREE.Mesh(geometry,material);sheet.name='free-falling-water-sheet';sheet.renderOrder=1;root.add(sheet);
  // A narrow side wall gives the sheet a readable edge thickness at grazing angles.
  const edgeMaterial=new THREE.MeshPhysicalMaterial({color:0x7bc8be,roughness:.2,transmission:.4,thickness:.16,ior:1.333,envMap:environment ?? null,side:THREE.DoubleSide});materials.push(edgeMaterial);
  for(const side of [-1,1]) {
    const points:number[]=[],triangles:number[]=[];
    for(let row=0;row<=rows;row++) {
      const col=side<0?0:columns,index=(row*(columns+1)+col)*3;
      points.push(positions[index],positions[index+1],positions[index+2],positions[index],positions[index+1]-.13,positions[index+2]);
      if(row<rows){const a=row*2;triangles.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(triangles);g.computeVertexNormals();geometries.push(g);root.add(new THREE.Mesh(g,edgeMaterial));
  }
  // The cliff stays behind the free jet, exposing air between rock and falling water.
  const rockMaterial=new THREE.MeshStandardMaterial({color:0x697d72,roughness:.89});materials.push(rockMaterial);
  const rockGeo=new THREE.IcosahedronGeometry(1,2);
  const rp=rockGeo.getAttribute('position');for(let i=0;i<rp.count;i++){
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+.065*Math.sin(x*19+y*13)*Math.cos(z*17+y*9);rp.setXYZ(i,x*n,y*n,z*n);
  }rockGeo.computeVertexNormals();geometries.push(rockGeo);
  for(let i=0;i<5;i++){
    const lateral=(i-2)*upper.width/4.3;
    const rock=new THREE.Mesh(rockGeo,rockMaterial);
    rock.position.set(upper.x+upper.nx*lateral-upper.tx*.6,upper.y-drop*.49-.45,upper.z+upper.nz*lateral-upper.tz*.6);
    rock.scale.set(2.1,drop*.55,1.5);rock.rotation.y=Math.atan2(upper.tx,upper.tz)+(i%2)*.12;
    rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
  }
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const s=HEADWATER.lip-1.3+i*2.8,f=sampleCourse(s),span=sampleChannel(s,'main'),lateral=side*(f.width/2+.4);
    const rock=new THREE.Mesh(rockGeo,rockMaterial);rock.position.set(f.x+f.nx*lateral,span.y+.15,f.z+f.nz*lateral);
    rock.scale.set(1.1+i*.13,.75+(i%2)*.4,1.35);rock.rotation.set(.1,i*.8,side*.16);rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
  }
  const foamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:clock,uNoise:{value:normalMap}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;uniform sampler2D uNoise;varying vec2 vUv;
      void main(){vec2 p=vec2(vUv.x*2.4,vUv.y*1.6-uTime*.11);
        float a=texture2D(uNoise,p).r,b=texture2D(uNoise,p*3.1+vec2(.3,uTime*.06)).g;
        float edge=smoothstep(0.,.14,vUv.x)*smoothstep(0.,.14,1.-vUv.x);
        float impact=exp(-vUv.y*3.2),cells=smoothstep(.39,.64,a*.65+b*.35);
        float alpha=edge*(.22+cells*.65)*impact*smoothstep(0.,.045,vUv.y)*smoothstep(0.,.18,1.-vUv.y);
        gl_FragColor=vec4(vec3(.84,.94,.91),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});materials.push(foamMaterial);
  const poolPos:number[]=[],poolUv:number[]=[],poolIdx:number[]=[];
  for(let row=0;row<=32;row++){
    const t=row/32,s=HEADWATER.impact-.15+t*10,f=sampleCourse(s),span=sampleChannel(s,'main');
    for(let col=0;col<=18;col++){
      const u=col/18,lateral=(u-.5)*Math.min(f.width-.5,upper.width+3+t*4);
      poolPos.push(f.x+f.nx*lateral,span.y+.095,f.z+f.nz*lateral);poolUv.push(u,t);
      if(row<32&&col<18){const a=row*19+col,b=a+19;poolIdx.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const foamGeo=new THREE.BufferGeometry();foamGeo.setAttribute('position',new THREE.Float32BufferAttribute(poolPos,3));foamGeo.setAttribute('uv',new THREE.Float32BufferAttribute(poolUv,2));foamGeo.setIndex(poolIdx);geometries.push(foamGeo);
  const poolFoam=new THREE.Mesh(foamGeo,foamMaterial);poolFoam.name='plunge-pool-aeration';poolFoam.renderOrder=2;root.add(poolFoam);
  // Soft original sprite, with mottled density to avoid a stack of visible discs.
  const size=64,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+ .5)/32-1,(y+.5)/32-1),i=(y*size+x)*4;
    const grain=.72+.16*Math.sin(x*.83+Math.sin(y*.47)*3)+.12*Math.sin(y*1.23+x*.31);
    pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r*r)**2*grain);
  }
  const sprite=new THREE.DataTexture(pixels,size,size);sprite.needsUpdate=true;sprite.magFilter=THREE.LinearFilter;textures.push(sprite);
  const batch=new BatchedRenderer();batch.name='quarks-waterfall-spray';root.add(batch);
  const systems:ParticleSystem[]=[];
  const white=new Vector3(.88,.96,.93);
  const makeSystem=(mist:boolean) => {
    const m=new THREE.MeshBasicMaterial({map:sprite,transparent:true,depthWrite:false,color:0xffffff,blending:THREE.NormalBlending});materials.push(m);
    const system=new ParticleSystem({duration:4,looping:true,prewarm:true,worldSpace:true,
      shape:new ConeEmitter({radius:mist?.65:.45,angle:mist?1.05:.75,thickness:1}),
      startLife:new IntervalValue(mist?1.1:.3,mist?2.0:.9),startSpeed:new IntervalValue(mist?.45:2.1,mist?1.5:5.2),
      startSize:new IntervalValue(mist?1.1:.055,mist?2.7:.14),startColor:new ConstantColor(new Vector4(.88,.96,.93,1)),
      emissionOverTime:new ConstantValue(mist?36:145),material:m,renderMode:mist?RenderMode.BillBoard:RenderMode.StretchedBillBoard,
      speedFactor:.09,renderOrder:3,behaviors:[
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[0,0],[mist?.14:.65,.12],[mist?.08:.4,.65],[0,1]])),
        new SizeOverLife(new PiecewiseBezier([[new Bezier(.55,.85,1.15,mist?1.7:.2),0]])),
        new ApplyForce(new Vector3(0,mist?.28:-1,0),new ConstantValue(mist?.8:HEADWATER.gravity)),
      ]});
    const f=sampleCourse(HEADWATER.impact+.35);
    system.emitter.position.set(f.x,f.y+.15,f.z);
    const side=new THREE.Vector3(f.nx,0,f.nz),back=new THREE.Vector3(-f.tx,0,-f.tz),up=new THREE.Vector3(0,1,0);
    system.emitter.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,back,up));
    system.emitter.scale.set(upper.width*.54,1,1);
    root.add(system.emitter);batch.addSystem(system);systems.push(system);return system;
  };
  makeSystem(false);makeSystem(true);
  // Duck entry bursts are pooled: one emitter per racer, reused on each race reset.
  const entries=Array.from({length:5},()=>{
    const m=new THREE.MeshBasicMaterial({map:sprite,transparent:true,depthWrite:false});materials.push(m);
    const sys=new ParticleSystem({duration:.1,looping:false,worldSpace:true,
      shape:new ConeEmitter({radius:.4,angle:1.12,thickness:1}),startLife:new IntervalValue(.3,.65),
      startSpeed:new IntervalValue(2.2,4.4),startSize:new IntervalValue(.07,.17),
      startColor:new ConstantColor(new Vector4(.88,.97,.94,.85)),emissionOverTime:new ConstantValue(0),
      emissionBursts:[{time:0,count:new ConstantValue(42),cycle:1,interval:.1,probability:1}],
      material:m,renderMode:RenderMode.StretchedBillBoard,speedFactor:.07,renderOrder:4,
      behaviors:[new ApplyForce(new Vector3(0,-1,0),new ConstantValue(HEADWATER.gravity)),
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[.8,0],[.5,.4],[0,1]]))]});
    sys.emitter.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0));
    root.add(sys.emitter);batch.addSystem(sys);systems.push(sys);sys.pause();return sys;
  });
  const landed=new Map<number,number>();let lastTime=-1,disposed=false;
  console.info('[duck-circuit] waterfall_vfx_ready',{provider:'three.quarks',version:'0.17.1',waterfall:'headwater-drop'});
  // TODO(metrics): expose active spray count and waterfall GPU time in the shared renderer span.
  return {
    update(ducks:Duck[],time:number,waterTime:number,delta:number,paused:boolean){
      if(disposed)return;clock.value=waterTime;
      if(time<lastTime){landed.clear();for(const entry of entries){entry.stop();entry.pause();}}
      for(const duck of ducks)if(duck.landedAt!==undefined&&landed.get(duck.id)!==duck.landedAt){
        landed.set(duck.id,duck.landedAt);
        // A frozen checkpoint may be after impact: do not replay historical splashes.
        if(time-duck.landedAt<.15){const f=sampleCourse(duck.s),sys=entries[duck.id];
          sys.emitter.position.set(f.x+f.nx*duck.lateral,sampleChannel(duck.s,'main').y+.12,f.z+f.nz*duck.lateral);sys.restart();}
      }
      lastTime=time;
      if(!paused)batch.update(Math.min(delta,.1));
    },
    dispose(){if(disposed)return;disposed=true;systems.forEach(sys=>sys.dispose());
      batch.batches.forEach(b=>{b.dispose(); const m=(b as THREE.Mesh).material; (Array.isArray(m)?m:[m]).forEach(material=>material.dispose());});root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
  };
}
