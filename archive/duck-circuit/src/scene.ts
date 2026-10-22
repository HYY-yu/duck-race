import { createFloatState, updateFloatState, HULL_CENTRE_ABOVE_WATER, HULL_LOCAL_CENTRE, type FloatState } from './duck-buoyancy.ts';
import * as THREE from 'three';
import { bankShoulder, riverStations, HEADWATER, CASCADES, FORKS, RIVER_REACHES, COURSE_LENGTH, START_S, FINISH_S, OBSTACLES, channelAt, channelSpans, sampleChannel, sampleCourse, sampleSurface, obstaclePose, type ChannelSpan, type CourseFrame, type Route } from './course';
import { createRiverWater } from './water';
import { createTerrain } from './terrain';
import { createWaterEnvironment } from './water-environment';
import { createRiverbedDetails } from './riverbed';
import { duckWaterline, landingOffset, type Duck } from './simulation';
import { createHeadwaterFall } from './waterfall';

export const DUCK_COLORS = [0xffc848, 0xf28e76, 0x8bc7b0, 0xb6a1d4, 0xf4dfa0];
export type ScenePhase = 'ready' | 'countdown' | 'running' | 'paused' | 'done';
export type SceneOptions = { followId: number; overview: boolean; phase: ScenePhase; countdown: number; waterfallPreview?: boolean };
type Callbacks = { onSelect: (id: number) => void; onError: (kind: 'context-lost' | 'render-error', error?: unknown) => void };

// The miniature landscape is generated from the same centerline and obstacle poses as collisions.
// Water markings explain the current; decorative movement never supplies propulsion to a duck.
export function createRaceScene(host: HTMLElement, callbacks: Callbacks, initialWaterTime = 0) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe3eade);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    const diagnostics = {
      programLog: gl.getProgramInfoLog(program) ?? '',
      vertexLog: gl.getShaderInfoLog(vertexShader) ?? '',
      fragmentLog: gl.getShaderInfoLog(fragmentShader) ?? '',
      linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
      vertexCompileStatus: gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS),
      fragmentCompileStatus: gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS),
      vertexSource: gl.getShaderSource(vertexShader),
      fragmentSource: gl.getShaderSource(fragmentShader),
    };
    // A custom callback replaces Three's default logger. Preserve driver logs and
    // sources, then fail through the existing visible initialization/render path.
    console.error('[duck-circuit]', 'shader_program_error', diagnostics);
    throw new Error([
      'WebGL shader compilation/link failed.',
      `Program: ${diagnostics.programLog || '(empty log)'}`,
      `Vertex: ${diagnostics.vertexLog || '(empty log)'}`,
      `Fragment: ${diagnostics.fragmentLog || '(empty log)'}`,
    ].join('\n'), { cause: diagnostics });
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.transmissionResolutionScale = .5;
  // Count the entire frame, including shadow and transmission passes. Three's
  // automatic reset runs after shadows and would hide part of the GPU workload.
  renderer.info.autoReset = false;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D duck water circuit');
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 700);
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: number, roughness = .8) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  };
  const limestone = material(0xcfcbbb), cliff = material(0xa9ac9b), cliffLower = material(0x889789);
  const underWater = material(0x457f73), riverbed = material(0xa7a18d), dark = material(0x365c54);
  const orange = material(0xec9670), hardware = material(0xf6e5bf);
  const point = (s: number, lateral = 0, height = 0) => {
    const f = sampleSurface(s, lateral);
    return new THREE.Vector3(f.x + f.nx * lateral, f.y + height, f.z + f.nz * lateral);
  };
  const samples = Array.from({ length: Math.ceil(COURSE_LENGTH / .65) + 1 }, (_, i) => i);
  const sampleCount = samples.length;
  const sampleFrames = samples.map((_, i) => sampleCourse(i / (sampleCount - 1) * COURSE_LENGTH));
  const bounds = new THREE.Box3();
  sampleFrames.forEach(f => {
    bounds.expandByPoint(new THREE.Vector3(f.x - f.width / 2 - 5, f.y - 4, f.z - f.width / 2 - 5));
    bounds.expandByPoint(new THREE.Vector3(f.x + f.width / 2 + 5, f.y + 7, f.z + f.width / 2 + 5));
  });
  const center = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
  scene.fog = new THREE.Fog(0xe3eade, 350, 700);
  scene.add(new THREE.HemisphereLight(0xfff7dd, 0x6b8878, 2.3));
  const sun = new THREE.DirectionalLight(0xffefd3, 3.3);
  sun.position.copy(center).add(new THREE.Vector3(-55, 120, 65));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowRange = Math.max(extent.x, extent.z) * .7;
  Object.assign(sun.shadow.camera, { left: -shadowRange, right: shadowRange, top: shadowRange, bottom: -shadowRange, near: 1, far: 400 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .07;
  scene.add(sun, sun.target);

  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = scene) {
    const object = new THREE.Mesh(geometry, mat);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function beam(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, parent: THREE.Object3D = scene, sides = 10) {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), sides), mat, parent);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  }
  type Reach = { start: number; end: number; route: Route };
  type BankCoordinate = (span: ChannelSpan, s: number, frame: CourseFrame) => { lateral: number; height: number };
  function ribbon(reach: Reach, edgeA: BankCoordinate, edgeB: BankCoordinate, mat: THREE.Material) {
    const stations=riverStations(reach.start,reach.end),rows=stations.length-1, positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const s = stations[i], frame = sampleCourse(s), span = sampleChannel(s, reach.route);
      for (const edge of [edgeA(span, s, frame), edgeB(span, s, frame)]) {
        positions.push(frame.x + frame.nx * edge.lateral, span.y + edge.height, frame.z + frame.nz * edge.lateral);
      }
      if (i < rows) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); mat.side = THREE.DoubleSide; return mesh(geometry, mat);
  }
  // Each branch has its own bed and banks. No surface crosses the island or connects
  // different branch elevations with a fictitious sheet of water.
  for (const reach of RIVER_REACHES) {
    ribbon(reach, span => ({ lateral: span.min, height: -span.depth }), span => ({ lateral: span.max, height: -span.depth }), riverbed);
    for (const side of [-1, 1]) {
      const isInner = reach.route === 'left' && side > 0 || reach.route === 'right' && side < 0;
      const edge = (span: ChannelSpan) => side < 0 ? span.min : span.max;
      const islandScale = (s: number) => {
        if (!isInner) return 1;
        const spans = channelSpans(s); return spans.length === 2 ? Math.min(1, Math.max(0, spans[1].min - spans[0].max) / 1.4) : 0;
      };
      const rockEdge = (s: number) => .26 + Math.sin(s * 1.8) * .055 + Math.sin(s * 4.1) * .035;
      ribbon(reach, span => ({ lateral: edge(span), height: -span.depth }), span => ({ lateral: edge(span), height: .04 }), underWater);
      ribbon(reach, span => ({ lateral: edge(span), height: .04 }), (span, s) => ({ lateral: edge(span), height: rockEdge(s) * islandScale(s) }), limestone);
      ribbon(reach, (span, s) => ({ lateral: edge(span), height: rockEdge(s) * islandScale(s) }),
        (span, s) => ({ lateral: edge(span) + side * (.42 + Math.sin(s * 2.7) * .05) * islandScale(s), height: (rockEdge(s) + .03) * islandScale(s) }), limestone);
      ribbon(reach, (span, s) => ({ lateral: edge(span) + side * bankShoulder(s).offset * islandScale(s), height: bankShoulder(s).height * islandScale(s) }),
        (span, s) => ({ lateral: edge(span) + side * .68 * islandScale(s), height: -.57 }), cliff);
      if (!isInner) {
        ribbon(reach, span => ({ lateral: edge(span) + side * .68, height: -.57 }),
          (span, s) => ({ lateral: edge(span) + side * (1.45 + Math.sin(s * .72) * .16), height: -.63 }), cliff);
        ribbon(reach, (span, s) => ({ lateral: edge(span) + side * (1.45 + Math.sin(s * .72) * .16), height: -.63 }),
          span => ({ lateral: edge(span) + side * 1.7, height: -span.depth - 1.3 }), cliffLower);
      }
    }
  }
  // Shared-position normal accumulation removes lighting cuts between bank ribbons.
  // Material boundaries intentionally keep their own normals (rock faces vs topsoil).
  const seamGroups=new Map<THREE.Material,Map<string,Array<{normal:THREE.BufferAttribute|THREE.InterleavedBufferAttribute;index:number}>>>();
  scene.traverse(object=>{if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
    const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal');if(!p||!n)return;
    let vertices=seamGroups.get(object.material);if(!vertices){vertices=new Map();seamGroups.set(object.material,vertices);}
    for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(4)).join(',');
      const refs=vertices.get(key)??[];refs.push({normal:n,index:i});vertices.set(key,refs);}
  });
  for(const vertices of seamGroups.values())for(const refs of vertices.values())if(refs.length>1){
    const n=new THREE.Vector3();for(const ref of refs)n.add(new THREE.Vector3().fromBufferAttribute(ref.normal,ref.index));n.normalize();
    for(const ref of refs)ref.normal.setXYZ(ref.index,n.x,n.y,n.z);
  }
  const terrain = createTerrain(scene);
  const riverbedDetails = createRiverbedDetails(scene);
  const waterEnvironment = createWaterEnvironment(renderer, scene);
  const riverWater = createRiverWater(scene, initialWaterTime, waterEnvironment.texture);
  const headwaterFall = createHeadwaterFall(scene, waterEnvironment.texture);

  for (const s of [0, COURSE_LENGTH]) {
    const f = sampleCourse(s);
    const endBank = mesh(new THREE.BoxGeometry(f.width + 1.28, f.depth + .64, .64), limestone);
    endBank.position.copy(point(s, 0, (.64 - f.depth) / 2));
    endBank.rotation.y = Math.atan2(f.nx, f.nz) - Math.PI / 2;
  }

  const startArchS = START_S - 3.2;
  const startFrame = sampleCourse(startArchS);
  const finishFrame = sampleCourse(FINISH_S);
  function arch(s: number, height: number, mat: THREE.Material) {
    const f = sampleCourse(s), half = f.width / 2 + .35;
    beam(point(s, -half, .3), point(s, -half, height), .21, dark);
    beam(point(s, half, .3), point(s, half, height), .21, dark);
    beam(point(s, -half, height), point(s, half, height), .24, mat);
  }
  arch(startArchS, 4.8, hardware);
  arch(FINISH_S, 3.3, hardware);
  const startLights: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const backing = mesh(new THREE.BoxGeometry(.7, .67, .3), dark);
    backing.position.copy(point(startArchS, (i - 2) * 1.05, 4.8));
    backing.rotation.y = Math.atan2(startFrame.tx, startFrame.tz);
    const light = mesh(new THREE.SphereGeometry(.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5e7668, emissive: 0x000000, roughness: .4 }));
    materials.push(light.material);
    light.position.copy(backing.position).add(new THREE.Vector3(startFrame.tx * .21, 0, startFrame.tz * .21));
    startLights.push(light);
  }
  const launchGate = beam(point(START_S + 1.6, -startFrame.width / 2, .37), point(START_S + 1.6, startFrame.width / 2, .37), .17, orange);
  for (let i = 0; i < 16; i++) {
    const tile = mesh(new THREE.BoxGeometry(finishFrame.width / 16, .05, .55), i % 2 ? limestone : dark);
    tile.position.copy(point(FINISH_S, -finishFrame.width / 2 + (i + .5) * finishFrame.width / 16, .06));
    tile.rotation.y = Math.atan2(finishFrame.nx, finishFrame.nz) - Math.PI / 2;
    const flag = mesh(new THREE.BoxGeometry(finishFrame.width / 16, .52, .16), i % 2 ? dark : limestone);
    flag.position.copy(point(FINISH_S, -finishFrame.width / 2 + (i + .5) * finishFrame.width / 16, 3.05));
    flag.rotation.y = tile.rotation.y;
  }
  const obstacleModels = OBSTACLES.map(obstacle => {
    const f = sampleCourse(obstacle.s), width = f.width;
    const group = new THREE.Group(); scene.add(group);
    if (obstacle.kind === 'pendulum') {
      arch(obstacle.s, 5.07, hardware);
      const arm = beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -4.5, 0), .12, dark, group);
      const ball = mesh(new THREE.SphereGeometry(.9, 20, 16), orange, group);
      const cap = mesh(new THREE.TorusGeometry(.92, .07, 6, 24), hardware, ball); cap.rotation.x = Math.PI / 2;
      const hub = mesh(new THREE.SphereGeometry(.28, 12, 8), hardware, group);
      return { obstacle, group, arm, ball, hub };
    }
    for (const side of [-1, 1]) {
      beam(point(obstacle.s, side * (width / 2 + .12), .3), point(obstacle.s, side * (width / 2 + .12), 3.0), .17, dark);
    }
    const arm = mesh(new THREE.CylinderGeometry(.25, .25, width + .1, 12), orange, group);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.nx, 0, f.nz));
    // Alternating cream sleeves make vertical gate movement legible from the follow camera.
    for (let i = -2; i <= 2; i++) {
      const stripe = mesh(new THREE.CylinderGeometry(.257, .257, .32, 12), hardware, group);
      stripe.quaternion.copy(arm.quaternion); stripe.position.set(f.nx * i * width / 5, 0, f.nz * i * width / 5);
    }
    return { obstacle, group, arm, ball: null, hub: null };
  });

  const bodies = DUCK_COLORS.map(color => material(color, .47));
  const beakMaterial = material(0xe88c38, .55), eyes = material(0x283a31, .36);
  const duckGeometry = new THREE.SphereGeometry(1, 20, 14);
  const duckModels: THREE.Group[] = [];
  const floatStates = new Map<number, FloatState>();
  let lastPoseTime = -1;
  const pickables: THREE.Object3D[] = [];
  function ellipsoid(parent: THREE.Object3D, mat: THREE.Material, xyz: number[], scale: number[]) {
    const m = mesh(duckGeometry, mat, parent); m.position.set(xyz[0], xyz[1], xyz[2]); m.scale.set(scale[0], scale[1], scale[2]); return m;
  }
  function numberTexture(text: string) {
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create racer marker');
    ctx.fillStyle = '#fff9e9'; ctx.beginPath(); ctx.arc(48, 48, 37, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#315c4f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#254b40'; ctx.font = '600 42px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 48, 49);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture); return texture;
  }
  for (let id = 0; id < 5; id++) {
    const g = new THREE.Group(); g.userData.duckId = id; scene.add(g); duckModels.push(g);
    const hull = new THREE.Group(); hull.position.y = -HULL_LOCAL_CENTRE; g.add(hull);
    const body = ellipsoid(hull, bodies[id], [0, .46, 0], [.65, .45, .47]);
    ellipsoid(hull, bodies[id], [.4, .91, 0], [.36, .39, .34]);
    ellipsoid(hull, beakMaterial, [.76, .81, 0], [.29, .105, .23]);
    for (const side of [-1, 1]) {
      ellipsoid(hull, eyes, [.52, 1.02, side * .285], [.052, .061, .045]);
      const wing = ellipsoid(hull, bodies[id], [-.14, .51, side * .4], [.38, .17, .13]); wing.rotation.z = -.18;
    }
    const tail = mesh(new THREE.ConeGeometry(.22, .5, 10), bodies[id], hull); tail.position.set(-.58, .56, 0); tail.rotation.z = Math.PI / 3;
    const badgeMaterial = new THREE.SpriteMaterial({ map: numberTexture(String(id + 1)), depthTest: false, transparent: true });
    materials.push(badgeMaterial);
    const badge = new THREE.Sprite(badgeMaterial); badge.position.y = 2.0 - HULL_LOCAL_CENTRE; badge.scale.set(.85, .85, 1); badge.renderOrder = 5; g.add(badge);
    body.userData.duckId = id; pickables.push(body);
  }
  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2a2, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false });
  materials.push(haloMaterial);
  const halo = mesh(new THREE.RingGeometry(.78, .87, 48), haloMaterial); halo.rotation.x = -Math.PI / 2; halo.castShadow = false;
  const haloAxis = new THREE.Vector3(0, 0, 1), haloNormal = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const pointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) callbacks.onSelect(hit.object.userData.duckId as number);
  };
  renderer.domElement.addEventListener('pointerup', pointerUp);
  let lost = false, disposed = false, cameraReady = false;
  const onContextLost = (event: Event) => { event.preventDefault(); lost = true; callbacks.onError('context-lost'); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  const cameraTarget = center.clone(), targetPosition = new THREE.Vector3(), desiredLook = new THREE.Vector3();
  const overviewPoints = sampleFrames.flatMap(f => [-1, 1].flatMap(side => [4.9, -f.depth - 2.3].map(height =>
    new THREE.Vector3(f.x + f.nx * side * (f.width / 2 + 2.4), f.y + height, f.z + f.nz * side * (f.width / 2 + 2.4)))));
  const overviewLook = new THREE.Vector3(), overviewPosition = new THREE.Vector3();
  function fitOverview() {
    // Fit the actual projected river banks, including perspective depth. Portrait framing
    // uses less yaw so the long channel stays legible without clipping the outside bends.
    const yaw = THREE.MathUtils.lerp(.12, .43, THREE.MathUtils.clamp((camera.aspect - .65) / .35, 0, 1));
    const direction = new THREE.Vector3(yaw, .86, .48).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const points = overviewPoints.map(p => new THREE.Vector3(p.dot(right), p.dot(up), p.dot(direction)));
    const projectionBounds = new THREE.Box3().setFromPoints(points), projectionCenter = projectionBounds.getCenter(new THREE.Vector3());
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const intervals = (distance: number) => {
      let left = -Infinity, right = Infinity, bottom = -Infinity, top = Infinity;
      for (const p of points) {
        const depth = distance - (p.z - projectionCenter.z);
        const halfWidth = depth * tangent * camera.aspect * .84, halfHeight = depth * tangent * .8;
        left = Math.max(left, p.x - halfWidth); right = Math.min(right, p.x + halfWidth);
        bottom = Math.max(bottom, p.y - halfHeight); top = Math.min(top, p.y + halfHeight);
      }
      return { left, right, bottom, top, fits: left <= right && bottom <= top };
    };
    let near = 1, far = 650;
    for (let i = 0; i < 30; i++) { const mid = (near + far) / 2; if (intervals(mid).fits) far = mid; else near = mid; }
    const box = intervals(far);
    overviewLook.copy(right).multiplyScalar((box.left + box.right) / 2)
      .addScaledVector(up, (box.bottom + box.top) / 2).addScaledVector(direction, projectionCenter.z);
    overviewPosition.copy(overviewLook).addScaledVector(direction, far);
  }
  function resize() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); fitOverview();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  function update(ducks: Duck[], time: number, delta: number, options: SceneOptions) {
    if (disposed || lost) return;
    try {
      riverWater.update(ducks, time, delta, options.phase === 'paused', options.phase === 'running');
      riverbedDetails.update(riverWater.time);
      headwaterFall.update(ducks, time, riverWater.time, delta, options.phase === 'paused');
      if (time < lastPoseTime) floatStates.clear();
      lastPoseTime = time;
      for (const d of ducks) {
        const g = duckModels[d.id];
        let floating = floatStates.get(d.id);
        if (!floating) { floating = createFloatState(d, riverWater.time); floatStates.set(d.id, floating); }
        updateFloatState(floating, d, riverWater.time, delta, options.phase === 'paused');
        g.position.copy(point(d.s, d.lateral));
        g.position.y = duckWaterline(d) + HULL_CENTRE_ABOVE_WATER + (d.airborne ? 0 : floating.heave - .035 + landingOffset(d,time));
        // Heading belongs to passive angular physics. Never aim the duck along
        // velocity or the next bend: drifting sideways/backwards is intentional.
        const frame=sampleCourse(d.s),forwardFacing=Math.cos(d.heading)*frame.tx+Math.sin(d.heading)*frame.tz;
        const fallPitch=d.airborne?Math.atan2(d.verticalSpeed??0,Math.max(.5,d.vs))*.48*forwardFacing:floating.pitch;
        g.rotation.set(d.airborne?floating.roll*.5:floating.roll, -d.heading, fallPitch, 'YZX');
      }
      const selected = ducks.find(d => d.id === options.followId) ?? ducks[0];
      const haloSurface = sampleSurface(selected.s, selected.lateral);
      halo.position.copy(point(selected.s, selected.lateral, .10));
      haloNormal.set(haloSurface.tx * haloSurface.slope, 1, haloSurface.tz * haloSurface.slope).normalize();
      halo.quaternion.setFromUnitVectors(haloAxis, haloNormal);
      halo.visible = !options.overview && !selected.airborne && !options.waterfallPreview;
      for (const model of obstacleModels) {
        const pose = obstaclePose(model.obstacle, time), f = sampleCourse(model.obstacle.s);
        if (model.ball && model.hub) {
          const pivot = point(model.obstacle.s, 0, 5.07), ballPoint = point(model.obstacle.s, pose.lateral, pose.height);
          model.group.position.set(0, 0, 0); model.ball.position.copy(ballPoint); model.hub.position.copy(pivot);
          const direction = ballPoint.clone().sub(pivot);
          model.arm.position.copy(pivot).add(ballPoint).multiplyScalar(.5);
          model.arm.scale.y = direction.length() / 4.5;
          model.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        } else model.group.position.set(f.x, f.y + pose.height, f.z);
      }
      const holdingStart = options.phase === 'ready' || options.countdown > 0;
      const lightsOn = options.countdown > 0 && options.phase !== 'ready' ? Math.ceil((3 - options.countdown) / 3 * 5) : 0;
      startLights.forEach((light, index) => {
        const m = light.material as THREE.MeshStandardMaterial;
        const green = !holdingStart;
        m.color.setHex(green ? 0x8ec9a5 : index < lightsOn ? 0xee775f : 0x556d5e);
        m.emissive.setHex(green ? 0x255d35 : index < lightsOn ? 0x8a1f11 : 0x000000);
      });
      launchGate.visible = holdingStart;
      if (options.waterfallPreview) {
        const f=sampleCourse(HEADWATER.lip+2.6);
        desiredLook.set(f.x, sampleCourse(HEADWATER.lip).y-3.4, f.z);
        targetPosition.copy(desiredLook).add(new THREE.Vector3(f.nx*18+f.tx*23,10,f.nz*18+f.tz*23));
      } else if (options.overview) {
        desiredLook.copy(overviewLook);
        targetPosition.copy(overviewPosition);
      } else {
        const f = sampleSurface(selected.s, selected.lateral), span = channelAt(selected.s, selected.lateral);
        const featureWeight = (start: number, end: number, lead: number) => {
          if (selected.s < start - lead || selected.s > end + 7) return 0;
          return Math.min(THREE.MathUtils.smoothstep(selected.s, start - lead, start + 3), 1 - THREE.MathUtils.smoothstep(selected.s, end, end + 7));
        };
        const forkFocus = Math.max(0, ...FORKS.map(fork => featureWeight(fork.start, fork.end, 14)));
        const rapidWeights = CASCADES.map(cascade => featureWeight(cascade.start, cascade.end, 12));
        const rapidFocus = Math.max(0, ...rapidWeights);
        const activeCascade = CASCADES[rapidWeights.indexOf(rapidFocus)];
        const lookAhead = 8 + forkFocus * 4 + rapidFocus * 5, aheadS = Math.min(COURSE_LENGTH, selected.s + lookAhead);
        const aheadSpan = sampleChannel(aheadS, span.route), lane = (selected.lateral - span.min) / Math.max(.1, span.max - span.min);
        const aheadLateral = aheadSpan.min + (aheadSpan.max - aheadSpan.min) * lane;
        const ahead = point(aheadS, aheadLateral, 0);
        desiredLook.copy(point(selected.s, selected.lateral, .3));
        if(selected.airborne)desiredLook.y=duckWaterline(selected)+.3;
        desiredLook.lerp(ahead, .6);
        // At junctions show both branches; a closer camera returns smoothly on ordinary reaches.
        const junctionCenter = point(selected.s + lookAhead * .5, 0, 1);
        desiredLook.lerp(junctionCenter, forkFocus * .3);
        if (activeCascade && rapidFocus > 0) {
          const dropCenter = (activeCascade.start + activeCascade.end) / 2 + 2;
          desiredLook.lerp(point(dropCenter, 0, .5), rapidFocus * .9);
        }
        const zoom = (camera.aspect < .8 ? 1.25 + rapidFocus * .12 : 1) * (1 + forkFocus * .34 + rapidFocus * .32);
        const forward = sampleCourse(Math.min(COURSE_LENGTH, selected.s + 9));
        const tx = f.tx * .55 + forward.tx * .45, tz = f.tz * .55 + forward.tz * .45;
        // A side view exposes the cascade's inclined profile and both pools. Ease into it
        // through the same feature weight, with a tighter lateral angle on narrow screens.
        const rapidSide = THREE.MathUtils.lerp(16, 25, THREE.MathUtils.smoothstep(camera.aspect, .7, 1.1));
        const setback = 12, sideLook = 5 + rapidFocus * (rapidSide - 5);
        targetPosition.copy(desiredLook).add(new THREE.Vector3((-tx * setback + f.nx * sideLook) * zoom, (25 + rapidFocus * 2) * zoom, (-tz * setback + f.nz * sideLook) * zoom));
      }
      const smoothing = cameraReady ? 1 - Math.exp(-Math.min(delta, .1) * 3.1) : 1;
      camera.position.lerp(targetPosition, smoothing); cameraTarget.lerp(desiredLook, smoothing); camera.lookAt(cameraTarget); cameraReady = true;
      renderer.info.reset();
      renderer.render(scene, camera);
    } catch (error) {
      lost = true; callbacks.onError('render-error', error);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    headwaterFall.dispose(); riverWater.dispose(); waterEnvironment.dispose(); riverbedDetails.dispose(); terrain.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    renderer.dispose();
    // This renderer owns the context. Releasing it also frees Three's private
    // transmission framebuffer, which has no public per-target disposal API.
    renderer.forceContextLoss(); renderer.domElement.remove();
  }
  const stats = () => ({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
  return { update, resize, dispose, stats };
}
