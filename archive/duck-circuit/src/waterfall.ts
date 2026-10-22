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
  // One sheet material carries the whole fall: a glassy tongue at the lip, corded aerated white
  // through the middle, and a torn, holed tail; base colour is driven entirely in the shader.
  const material = new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: .09, metalness: 0,
    transmission: .12, thickness: .3, ior: 1.333, attenuationColor: 0x0d5c55, attenuationDistance: 1.4,
    envMap: environment ?? null, envMapIntensity: .6, specularColor: 0xbfe8e2,
    transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false});
  materials.push(material);
  material.customProgramCacheKey = () => 'headwater-sheet-v2';
  material.onBeforeCompile = shader => {
    shader.uniforms.uFallTime = clock; shader.uniforms.uFallNormal = {value: normalMap};
    shader.vertexShader = 'uniform float uFallTime; varying vec2 vFallUv;\n' + WATER_WAVE_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvFallUv=uv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float lipWidth=${sampleCourse(HEADWATER.lip).width.toFixed(8)};
        float lateral=(uv.x-.5)*lipWidth;
        transformed.y += riverSurfaceWave(${HEADWATER.lip.toFixed(1)},lateral,min(uv.x,1.-uv.x)*lipWidth,uFallTime)*pow(1.-uv.y,2.);
        // Three out-of-phase trains: the fold travels downwards, neighbouring strands diverge.
        float amp=.12*smoothstep(.02,.5,uv.y)*(.55+.45*uv.y);
        transformed.y += amp*(sin(uv.x*9.4+uv.y*7.5-uFallTime*2.6)*.5
          +sin(uv.x*4.1-uv.y*11.-uFallTime*3.9+1.7)*.3+sin(uv.x*21.+uv.y*13.-uFallTime*5.2+4.1)*.16);
        transformed += objectNormal*(sin(uv.x*6.3+uv.y*9.-uFallTime*3.1)*.045*uv.y);
      `);
    shader.fragmentShader = `uniform float uFallTime; uniform sampler2D uFallNormal; varying vec2 vFallUv;
      float fallHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float fallNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(fallHash(i),fallHash(i+vec2(1,0)),f.x),mix(fallHash(i+vec2(0,1)),fallHash(i+vec2(1,1)),f.x),f.y);}
      float fallFbm(vec2 p){return fallNoise(p)*.57+fallNoise(p*2.03+7.1)*.28+fallNoise(p*4.17+3.3)*.15;}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // uv.y is flight time: aerated white is keyed on it, and cords only drift in uv.y.
      float y=vFallUv.y, tongue=1.-smoothstep(.04,.24,y);
      // Cords are near-vertical filaments: little variation along uv.y, drifting sideways as they fall.
      float drift=(fallNoise(vec2(vFallUv.x*2.2,vFallUv.y*.3-uFallTime*.3))-.5)*1.4;
      float cord=fallNoise(vec2(vFallUv.x*3.4+drift*.6,vFallUv.y*.3-uFallTime*.34));
      float fil=fallNoise(vec2(vFallUv.x*31.+drift*1.6,vFallUv.y*2.-uFallTime*1.2));
      float fil2=fallNoise(vec2(vFallUv.x*37.+3.1,vFallUv.y*2.4-uFallTime*1.5));
      float churn=smoothstep(.05,.42,y),aerated=smoothstep(.22,.58,y);
      // Ropes carry white first; by mid-fall the whole width aerates. Thin bright filaments and thin
      // dark seams ride on top, so the tail is grainy churn instead of a soft-edged sheet.
      float filament=smoothstep(.46,.66,fil),seam=smoothstep(.55,.74,fil2);
      float white=clamp(max(aerated*aerated*.62,smoothstep(.44,.66,cord)*(churn*.7+aerated*.34))
        +filament*(churn*.14+aerated*.5)+(fil-.5)*(churn*.06+aerated*.16)-seam*(churn*.05+aerated*.42),0.,1.);
      // Linear working-space versions of #2f6b63 / #4d8c84 and the grey-green gap they open onto.
      vec3 core=mix(mix(vec3(.016,.058,.049),vec3(.036,.104,.091),smoothstep(0.,.4,y)),vec3(.09,.135,.125),smoothstep(.25,.62,y));
      diffuseColor.rgb=mix(core,vec3(1.,1.08,1.05),white);
      float graze=1.-clamp(abs(dot(normalize(vNormal),normalize(vViewPosition))),0.,1.);
      diffuseColor.rgb+=vec3(.025,.035,.033)*pow(graze,4.)*(1.-white*.85)
        +vec3(.09,.12,.115)*exp(-pow((y-.045)/.04,2.))*mix(.25,1.,graze*graze);
      // Edges fray into separate strands, widening with height fallen.
      float edge=min(vFallUv.x,1.-vFallUv.x),fray=.02+.075*y;
      float strand=fallNoise(vec2(vFallUv.x*22.,vFallUv.y*.6-uFallTime*.5));
      // Just above the pool each strand reaches its own depth: some run on, others tear off early.
      float tear=smoothstep(.72,1.,y);
      float reach=.74+.26*fallNoise(vec2(vFallUv.x*7.3,uFallTime*.35));
      float holes=smoothstep(.5,.62,fallFbm(vec2(vFallUv.x*7.+drift*1.4,vFallUv.y*5.-uFallTime*.5)));
      diffuseColor.a*=mix(1.,smoothstep(fray*.08,fray,edge)*smoothstep(.24,.7,strand+edge*3.-.26*y),smoothstep(.04,.42,y));
      diffuseColor.a*=mix(1.,.93+.07*smoothstep(.3,.72,cord),churn)
        *(1.-smoothstep(reach-.012,reach,y)*(.8+.2*fil))*(1.-holes*tear*.8);
    `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=.07+.16*smoothstep(.04,.34,y)+white*.34;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 ripple=texture2D(uFallNormal,vec2(vFallUv.x*3.2+drift,vFallUv.y*.62-uFallTime*.5)).rg*2.-1.;
        // Sharp filaments jitter the normal too, so white water glitters instead of blurring.
        vec2 spark=vec2(filament-.5,seam-.5)*1.8*aerated;
        normal=normalize(normal+vec3(ripple.x*.22+spark.x*.24,ripple.y*.07+spark.y*.14,0.)*(1.-white*.7)*smoothstep(0.,.08,y));
      `).replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        // Aerated water is rough and matte, so it reflects far less than the glassy tongue.
        material.specularColor *= mix(1., .28, aerated); material.specularF90 *= mix(1., .55, aerated);
      `).replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment
        .replace('material.transmission = transmission;','material.transmission = transmission * (1.0 - aerated * .85) * mix(.35, 1.0, 1.0 - tongue);')
        .replace('material.thickness = thickness;','material.thickness = thickness * mix(1.0, .35, white);'));
  };
  const upper = sampleCourse(HEADWATER.lip), lower = sampleCourse(HEADWATER.impact);
  const drop = upper.y-lower.y;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns=56, rows=96;
  // The jet necks just under the lip, then spreads; every column leaves the lip at its own angle.
  const profile=(t:number)=>1-.07*THREE.MathUtils.smoothstep(t,0,.17)*(1-THREE.MathUtils.smoothstep(t,.17,.8))
    +.055*THREE.MathUtils.smoothstep(t,.4,1);
  for(let row=0;row<=rows;row++) {
    const t=row/rows,s=THREE.MathUtils.lerp(HEADWATER.lip,HEADWATER.impact,t),f=sampleCourse(s);
    for(let col=0;col<=columns;col++) {
      const u=col/columns, jitter=(Math.sin(col*.73)*.55+Math.sin(col*2.17+1.3)*.45)*t*t*.09;
      const lateral=(u-.5)*upper.width*profile(t)+jitter, forward=Math.sin(col*.63+t*2.2)*t*t*.06;
      positions.push(f.x+f.nx*lateral+f.tx*forward,upper.y+.035-drop*t*t,f.z+f.nz*lateral+f.tz*forward);
      uv.push(u,t);
      if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometries.push(geometry);
  const sheet=new THREE.Mesh(geometry,material);sheet.name='free-falling-water-sheet';sheet.renderOrder=1;root.add(sheet);
  // The cliff stays behind the free jet, exposing air between rock and falling water.
  const rockMaterial=new THREE.MeshStandardMaterial({color:0x697d72,roughness:.89});materials.push(rockMaterial);
  const rockGeo=new THREE.IcosahedronGeometry(1,2);
  const rp=rockGeo.getAttribute('position');for(let i=0;i<rp.count;i++){
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+.065*Math.sin(x*19+y*13)*Math.cos(z*17+y*9);rp.setXYZ(i,x*n,y*n,z*n);
  }rockGeo.computeVertexNormals();geometries.push(rockGeo);
  // Five base rocks: unequal step, size, depth and turning so the cliff reads as broken stone
  // rather than a row of eggs. [lateral fraction, width, height fraction, depth, turn, lift]
  const baseRocks=[[-.93,2.35,1.03,2.55,-.16,.16],[-.47,1.8,.9,1.8,.1,.4],[-.04,2.5,1.06,2.3,.18,-.24],
    [.44,1.7,.88,1.95,-.12,.3],[.92,2.4,1.,2.45,.22,-.08]];
  for(const [lat,sx,sy,sz,turn,lift] of baseRocks){
    const lateral=lat*upper.width*.5,back=.62+lift*.3;
    const rock=new THREE.Mesh(rockGeo,rockMaterial);
    rock.position.set(upper.x+upper.nx*lateral-upper.tx*back,upper.y-drop*.49-.45+lift,upper.z+upper.nz*lateral-upper.tz*back);
    rock.scale.set(sx,drop*.55*sy,sz);rock.rotation.set(lift*.07,Math.atan2(upper.tx,upper.tz)+turn,turn*.25);
    rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
  }
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const s=HEADWATER.lip-1.3+i*2.8,f=sampleCourse(s),span=sampleChannel(s,'main'),lateral=side*(f.width/2+.4);
    const rock=new THREE.Mesh(rockGeo,rockMaterial);rock.position.set(f.x+f.nx*lateral,span.y+.15,f.z+f.nz*lateral);
    rock.scale.set(1.1+i*.13,.75+(i%2)*.4,1.35);rock.rotation.set(.1,i*.8,side*.16);rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
  }
  // The plunge zone is one mesh in two halves: a standing crest that hugs the impact line, and an
  // apron that streams the churn downstream. Both advect along +uv.y, so the seam stays bright.
  const foamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:clock},
    vertexShader:`attribute float aCrest;varying vec2 vUv;varying float vCrest;
      void main(){vUv=uv;vCrest=aCrest;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying float vCrest;
      float foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);}
      float foamFbm(vec2 p){return foamNoise(p)*.57+foamNoise(p*2.03+7.1)*.28+foamNoise(p*4.17+3.3)*.15;}
      void main(){
        // The two halves advect along +uv.y: the apron streams downstream, the crest boils upward.
        vec2 flow=mix(vec2(vUv.x*3.1,vUv.y*1.1-uTime*.2),vec2(vUv.x*3.6,vUv.y*2.3-uTime*1.15),vCrest);
        float cells=foamFbm(flow*.62),fine=foamFbm(flow*vec2(2.8,1.35)+vec2(4.3,-uTime*.05));
        float dens=cells*.68+fine*.32,lateral=1.-smoothstep(.56,1.,abs(vUv.x*2.-1.));
        float alpha;vec3 rgb;
        if(vCrest>.5){
          // Solid white below a noise-thresholded crest line, then fast-scrolling tongues: the
          // sheet's frayed tail ends inside the churn instead of sliding neatly onto the pool.
          float cover=.68+.3*dens,edge=smoothstep(cover-.3,cover+.06,vUv.y);
          alpha=lateral*(1.-smoothstep(cover-.16,cover+.08,vUv.y))*(.74+.26*dens);
          rgb=mix(vec3(.58,.76,.74),vec3(.97,1.02,1.),clamp(dens*1.25-edge*.5,0.,1.));
        }else{
          float boil=foamFbm(vec2(vUv.x*7.5,vUv.y*2.4-uTime*.9));
          float foam=mix(smoothstep(.34,.62,boil),smoothstep(.36,.60,dens),smoothstep(0.,.22,vUv.y));
          alpha=lateral*exp(-vUv.y*2.9)*smoothstep(0.,.04,vUv.y)*(.3+.7*foam);
          rgb=mix(vec3(.72,.86,.84),vec3(.92,.99,.97),foam);
        }
        gl_FragColor=vec4(rgb,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});materials.push(foamMaterial);
  const poolPos:number[]=[],poolUv:number[]=[],poolCrest:number[]=[],poolIdx:number[]=[];
  const crestHalf=upper.width*.56,crestBase=sampleChannel(HEADWATER.impact,'main').y+.085;
  const addPatch=(crest:number,rows:number,cols:number,point:(u:number,v:number)=>void)=>{
    const base=poolPos.length/3;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows;point(u,v);poolUv.push(u,v);poolCrest.push(crest);
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const a=base+row*(cols+1)+col,b=a+cols+1;poolIdx.push(a,b,a+1,a+1,b,b+1);
    }
  };
  // The crest is a standing wave: its foot flares downstream onto the pool and its face rises back
  // upstream, tallest midstream, several tongues high enough to swallow the sheet's last metre.
  addPatch(1,10,30,(u,v)=>{
    const off=Math.abs(2*u-1),side=(u-.5)*2*crestHalf,bow=1-off*off;
    const height=2.95*(1-.22*Math.pow(off,1.7))*(1+.07*Math.sin(u*17.3+2.1)+.05*Math.sin(u*7.1));
    const down=1.15*Math.pow(1-v,1.45)-.3*v*v+.3*bow;
    poolPos.push(lower.x+lower.nx*side+lower.tx*down,crestBase+height*Math.pow(v,1.62),lower.z+lower.nz*side+lower.tz*down);
  });
  addPatch(0,24,18,(u,v)=>{
    const s=HEADWATER.impact-.15+v*10,f=sampleCourse(s),span=sampleChannel(s,'main');
    const side=(u-.5)*Math.min(f.width-.5,upper.width+3+v*4);
    poolPos.push(f.x+f.nx*side,span.y+.095,f.z+f.nz*side);
  });
  const foamGeo=new THREE.BufferGeometry();
  foamGeo.setAttribute('position',new THREE.Float32BufferAttribute(poolPos,3));
  foamGeo.setAttribute('uv',new THREE.Float32BufferAttribute(poolUv,2));
  foamGeo.setAttribute('aCrest',new THREE.Float32BufferAttribute(poolCrest,1));
  foamGeo.setIndex(poolIdx);geometries.push(foamGeo);
  const poolFoam=new THREE.Mesh(foamGeo,foamMaterial);poolFoam.name='plunge-pool-aeration';poolFoam.renderOrder=2;root.add(poolFoam);
  // Soft sprite, with mottled density so stacked mist reads as a veil rather than visible discs.
  const size=64,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5)/32-1,(y+.5)/32-1),i=(y*size+x)*4;
    const grain=.74+.14*Math.sin(x*.83+Math.sin(y*.47)*3)+.12*Math.sin(y*1.23+x*.31);
    pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r*r)**2.3*grain);
  }
  const sprite=new THREE.DataTexture(pixels,size,size);sprite.needsUpdate=true;sprite.magFilter=THREE.LinearFilter;textures.push(sprite);
  const dropMaterial=new THREE.MeshBasicMaterial({map:sprite,transparent:true,depthWrite:false,color:0xffffff});
  const mistMaterial=new THREE.MeshBasicMaterial({map:sprite,transparent:true,depthWrite:false,color:0xffffff});
  materials.push(dropMaterial,mistMaterial);
  const batch=new BatchedRenderer();batch.name='quarks-waterfall-spray';root.add(batch);
  const systems:ParticleSystem[]=[];
  const white=new Vector3(.88,.96,.93);
  const overPool=sampleCourse(HEADWATER.impact+.3),poolSurface=sampleChannel(HEADWATER.impact,'main').y;
  const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(overPool.nx,0,overPool.nz),
    new THREE.Vector3(-overPool.tx,0,-overPool.tz),new THREE.Vector3(0,1,0));
  // Emitters sit in a row across the impact line: each holds one ring, together they line the whole
  // sheet width with droplets, and nothing relies on a non-uniform emitter scale.
  const onImpactLine=(emitter:THREE.Object3D,lateral:number,down:number,y:number)=>{
    emitter.position.set(overPool.x+overPool.nx*lateral+overPool.tx*down,y,overPool.z+overPool.nz*lateral+overPool.tz*down);
    emitter.quaternion.setFromRotationMatrix(basis);root.add(emitter);
  };
  // Droplets: fine drizzle falling out of the crest, plus fatter drops thrown up and outward that
  // arc back down over the line. Stretched billboards on one shared material, so one batch.
  const droplets=(lateral:number,bounce:boolean)=>{
    const sys=new ParticleSystem({duration:4,looping:true,prewarm:true,worldSpace:true,
      shape:new ConeEmitter({radius:bounce?.6:.5,angle:bounce?.45:.8,thickness:1}),
      startLife:new IntervalValue(bounce?.5:.3,bounce?1.:.85),
      startSpeed:new IntervalValue(bounce?4.6:2.2,bounce?8.6:5.4),
      startSize:new IntervalValue(bounce?.04:.03,bounce?.11:.13),
      startColor:new ConstantColor(new Vector4(.9,.97,.95,1)),
      emissionOverTime:new ConstantValue(bounce?26:44),material:dropMaterial,
      renderMode:RenderMode.StretchedBillBoard,speedFactor:.1,renderOrder:3,behaviors:[
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[0,0],[.08,.6],[.6,.26],[1,0]])),
        new SizeOverLife(new PiecewiseBezier([[new Bezier(.6,.95,1.05,1.),0]])),
        new ApplyForce(new Vector3(0,-1,0),new ConstantValue(HEADWATER.gravity)),
      ]});
    onImpactLine(sys.emitter,lateral,-.12,poolSurface+(bounce?.16:.32));
    batch.addSystem(sys);systems.push(sys);
  };
  for(const u of [-.34,0,.34])droplets(u*upper.width*.5,false);
  for(const u of [-.42,-.14,.14,.42])droplets(u*upper.width*.5,true);
  // Mist: big, soft, low-alpha puffs that rise slowly and drift downstream, thinning as they go.
  const drifting=new Vector3(overPool.tx*.5,.34,overPool.tz*.5);
  const mist=(lateral:number)=>{
    const sys=new ParticleSystem({duration:4,looping:true,prewarm:true,worldSpace:true,
      shape:new ConeEmitter({radius:1.25,angle:.62,thickness:1}),
      startLife:new IntervalValue(2.1,3.8),startSpeed:new IntervalValue(.3,.8),
      startSize:new IntervalValue(1.,2.2),startColor:new ConstantColor(new Vector4(.9,.96,.95,1)),
      emissionOverTime:new ConstantValue(4),material:mistMaterial,renderMode:RenderMode.BillBoard,
      renderOrder:4,behaviors:[
        // A few percent of alpha each: stacked loosely they veil, never fog.
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[0,0],[.16,.05],[.62,.032],[1,0]])),
        new SizeOverLife(new PiecewiseBezier([[new Bezier(.45,.85,1.1,1.),0]])),
        new ApplyForce(drifting,new ConstantValue(.7)),
      ]});
    onImpactLine(sys.emitter,lateral,-.2,poolSurface+.25);
    batch.addSystem(sys);systems.push(sys);
  };
  for(const u of [-.4,-.13,.13,.4])mist(u*upper.width*.5);
  // Duck entry bursts are pooled: a thrown crown plus a short mist puff per racer, reused on reset.
  const entries=Array.from({length:5},()=>{
    const crownSpeed=new IntervalValue(2.6,5.2),crownSize=new IntervalValue(.05,.15),
      puffSpeed=new IntervalValue(.5,1.5),puffSize=new IntervalValue(.9,2.3);
    const crown=new ParticleSystem({duration:.1,looping:false,worldSpace:true,
      shape:new ConeEmitter({radius:.36,angle:.5,thickness:1}),startLife:new IntervalValue(.35,.8),
      startSpeed:crownSpeed,startSize:crownSize,startColor:new ConstantColor(new Vector4(.9,.97,.94,.85)),
      emissionOverTime:new ConstantValue(0),emissionBursts:[{time:0,count:new ConstantValue(34),cycle:1,interval:.1,probability:1}],
      material:dropMaterial,renderMode:RenderMode.StretchedBillBoard,speedFactor:.1,renderOrder:3,
      behaviors:[new ApplyForce(new Vector3(0,-1,0),new ConstantValue(HEADWATER.gravity)),
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[.85,0],[.55,.35],[0,1]]))]});
    const puff=new ParticleSystem({duration:.1,looping:false,worldSpace:true,
      shape:new ConeEmitter({radius:.5,angle:1.1,thickness:1}),startLife:new IntervalValue(1.1,2.2),
      startSpeed:puffSpeed,startSize:puffSize,startColor:new ConstantColor(new Vector4(.9,.96,.95,.9)),
      emissionOverTime:new ConstantValue(0),emissionBursts:[{time:0,count:new ConstantValue(16),cycle:1,interval:.1,probability:1}],
      material:mistMaterial,renderMode:RenderMode.BillBoard,renderOrder:4,
      behaviors:[new ApplyForce(drifting,new ConstantValue(1.2)),
        new ColorOverLife(new Gradient([[white,0],[white,1]],[[0,0],[.2,.05],[.65,.032],[1,0]])),
        new SizeOverLife(new PiecewiseBezier([[new Bezier(.5,.9,1.2,1.05),0]]))]});
    for(const sys of [crown,puff]){
      sys.emitter.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0));
      root.add(sys.emitter);batch.addSystem(sys);systems.push(sys);sys.pause();
    }
    return {crown,puff,crownSpeed,crownSize,puffSpeed,puffSize};
  });
  const landed=new Map<number,number>();let lastTime=-1,disposed=false;
  console.info('[duck-circuit] waterfall_vfx_ready',{provider:'three.quarks',version:'0.17.1',waterfall:'headwater-drop'});
  // TODO(metrics): expose active spray count and waterfall GPU time in the shared renderer span.
  return {
    update(ducks:Duck[],time:number,waterTime:number,delta:number,paused:boolean){
      if(disposed)return;clock.value=waterTime;
      if(time<lastTime){landed.clear();for(const entry of entries)for(const sys of [entry.crown,entry.puff])sys.stop();}
      for(const duck of ducks)if(duck.landedAt!==undefined&&landed.get(duck.id)!==duck.landedAt){
        landed.set(duck.id,duck.landedAt);
        // A frozen checkpoint may be after impact: do not replay historical splashes.
        if(time-duck.landedAt<.15){
          const f=sampleCourse(duck.s),entry=entries[duck.id],k=THREE.MathUtils.clamp((duck.entrySpeed??13.5)/13.5,.8,1.25),
            x=f.x+f.nx*duck.lateral,y=sampleChannel(duck.s,'main').y+.12,z=f.z+f.nz*duck.lateral;
          // A faster entry throws a taller, wider crown.
          entry.crownSpeed.a=2.6*k;entry.crownSpeed.b=5.2*k;entry.crownSize.a=.05*k;entry.crownSize.b=.15*k;
          entry.puffSpeed.a=.5*k;entry.puffSpeed.b=1.5*k;entry.puffSize.a=.9*k;entry.puffSize.b=2.3*k;
          entry.crown.emitter.position.set(x,y,z);entry.puff.emitter.position.set(x,y+.05,z);
          entry.crown.restart();entry.puff.restart();
        }
      }
      lastTime=time;
      if(!paused)batch.update(Math.min(delta,.1));
    },
    dispose(){if(disposed)return;disposed=true;systems.forEach(sys=>sys.dispose());
      batch.batches.forEach(b=>{b.dispose(); const m=(b as THREE.Mesh).material; (Array.isArray(m)?m:[m]).forEach(material=>material.dispose());});root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
  };
}
