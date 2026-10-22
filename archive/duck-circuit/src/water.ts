import * as THREE from 'three';
import { CASCADES, RIVER_REACHES, channelAt, channelSpans, flowAt, sampleChannel, sampleCourse, sampleSurface, riverStations, bankDistanceAt, inWaterfallGap, HEADWATER, type Route } from './course.ts';
import { createWaterMaterial } from './water-material.ts';
import type { Duck } from './simulation.ts';

type Reach = { start: number; end: number; route: Route };
type WaterSample = { s: number; x: number; y: number; z: number; tx: number; tz: number; nx: number; nz: number; min: number; max: number; slope: number; speed: number };
type FlowCache = Reach & { samples: WaterSample[] };
type WakePoint = { s: number; lateral: number; born: number; cache: FlowCache };

/** River surfaces and water effects share the exact open channels used by the simulation. */
export function createRiverWater(scene: THREE.Scene, initialTime = 0, environment?: THREE.Texture) {
  if (!Number.isFinite(initialTime) || initialTime < 0) throw new RangeError('Water clock must be a finite, non-negative number.');
  const group = new THREE.Group();
  group.name = 'river-water';
  scene.add(group);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const clock = { value: initialTime };
  // Static channel geometry is sampled once. Refresh a small slice of current speeds
  // per frame; hundreds of foam flecks must not re-run the physics field every render.
  const caches: FlowCache[] = RIVER_REACHES.map(reach => {
    const count = Math.ceil((reach.end - reach.start) / .35);
    const samples = Array.from({ length: count + 1 }, (_, i) => {
      const s = reach.start + (reach.end - reach.start) * i / count, f = sampleCourse(s), span = sampleChannel(s, reach.route);
      return { s, x: f.x, y: span.y, z: f.z, tx: f.tx, tz: f.tz, nx: f.nx, nz: f.nz,
        min: span.min, max: span.max, slope: span.slope, speed: flowAt(s, (span.min + span.max) / 2, 0).forward };
    });
    return { ...reach, samples };
  });
  const currentSamples = caches.flatMap(cache => cache.samples);
  let refreshIndex = 0;
  const sampled: WaterSample = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, nx: 0, nz: 0, min: 0, max: 0, slope: 0, speed: 0 };
  const sampleKeys = Object.keys(sampled) as (keyof WaterSample)[];
  const sampleCached = (cache: FlowCache, s: number) => {
    const position = THREE.MathUtils.clamp((s - cache.start) / (cache.end - cache.start) * (cache.samples.length - 1), 0, cache.samples.length - 1);
    const index = Math.min(Math.floor(position), cache.samples.length - 2), fraction = position - index;
    const a = cache.samples[index], b = cache.samples[index + 1];
    for (const key of sampleKeys) sampled[key] = a[key] + (b[key] - a[key]) * fraction;
    return sampled;
  };
  const cacheAt = (s: number, route: Route) => caches.find(cache => s >= cache.start && s <= cache.end && (cache.route === route || cache.route === 'main')) ?? caches[0];
  const waterMaterial = createWaterMaterial(clock, environment);
  const surface = waterMaterial.material;
  for (const reach of RIVER_REACHES) {
    const columns=reach.route==='main'?18:9,rowS=riverStations(reach.start,reach.end),rows=rowS.length-1;
    const normals: number[] = [], banks: number[] = [];
    const positions: number[] = [], uv: number[] = [], data: number[] = [], shores: number[] = [], axes: number[] = [], impacts: number[] = [], indices: number[] = [];
    for (let row = 0; row <= rows; row++) {
      const s = rowS[row], f = sampleCourse(s), span = sampleChannel(s, reach.route);
      
      const spans = channelSpans(s), gap = spans.length === 2 ? spans[1].min - spans[0].max : 0;
      const innerBank = THREE.MathUtils.smoothstep(gap, 0, 1.4);
      const leftBank = reach.route === 'right' ? innerBank : 1, rightBank = reach.route === 'left' ? innerBank : 1;
      for (let column = 0; column <= columns; column++) {
        const lane = column / columns, lateral = span.min + (span.max - span.min) * lane;
        positions.push(f.x + f.nx * lateral, span.y + .035, f.z + f.nz * lateral);
        uv.push(lane, s);
        banks.push(bankDistanceAt(s, lateral, reach.route));
        const normal = new THREE.Vector3(f.tx * span.slope, 1, f.tz * span.slope).normalize();
        normals.push(normal.x, normal.y, normal.z);
        data.push(flowAt(s, lateral, 0).forward, span.depth, span.slope, span.max - span.min);
        shores.push(leftBank, rightBank, lateral);
        axes.push(f.tx, f.tz, f.nx, f.nz);
        impacts.push(Math.max(...CASCADES.map(fall => Math.exp(-(((s - fall.end - 1.6) / 3.3) ** 2)))));
      }
      if (row < rows && !(inWaterfallGap((s + rowS[row+1]) * .5) && (s + rowS[row+1]) * .5 < HEADWATER.lip + 1.1)) for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('riverData', new THREE.Float32BufferAttribute(data, 4));
    geometry.setAttribute('riverShore', new THREE.Float32BufferAttribute(shores, 3));
    geometry.setAttribute('riverAxis', new THREE.Float32BufferAttribute(axes, 4));
    geometry.setAttribute('riverImpact', new THREE.Float32BufferAttribute(impacts, 1));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('riverBankDistance', new THREE.Float32BufferAttribute(banks, 1));
    geometry.setIndex(indices); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, surface); mesh.name = `water-${reach.route}-${reach.start}`; mesh.receiveShadow = true; group.add(mesh);
  }

  const foamPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = Math.hypot((x + .5) / 32 - 1, (y + .5) / 32 - 1), offset = (y * 64 + x) * 4;
    const grain = .7 + .3 * Math.sin(x * 1.7 + Math.sin(y * 2.3));
    foamPixels[offset] = foamPixels[offset + 1] = foamPixels[offset + 2] = 255;
    foamPixels[offset + 3] = Math.round(255 * (1 - THREE.MathUtils.smoothstep(radius, .25, 1)) * grain);
  }
  const foamTexture = new THREE.DataTexture(foamPixels, 64, 64, THREE.RGBAFormat);
  foamTexture.magFilter = THREE.LinearFilter; foamTexture.needsUpdate = true;
  const foam = new THREE.MeshBasicMaterial({ map: foamTexture, color: 0xd8ece5, transparent: true, opacity: .43, depthWrite: false, side: THREE.DoubleSide });
  const wakeMaterial = new THREE.MeshBasicMaterial({ map: foamTexture, color: 0xe5f0dd, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide });
  const sprayMaterial = new THREE.MeshBasicMaterial({ color: 0xe5f5e5, transparent: true, opacity: .58, depthWrite: false });
  materials.push(foam, wakeMaterial, sprayMaterial);
  let randomState = 3757;
  const random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
  const streakGeometry = new THREE.PlaneGeometry(1, 1); geometries.push(streakGeometry);
  const particles = caches.flatMap(cache => Array.from({ length: Math.max(20, Math.round((cache.end - cache.start) * .95)) }, () =>
    ({ cache, s: cache.start + random() * (cache.end - cache.start), lane: .04 + random() * .92, size: .45 + random() * .8 })));
  const streaks = new THREE.InstancedMesh(streakGeometry, foam, particles.length); streaks.frustumCulled = false; group.add(streaks);
  const splashGeometry = new THREE.IcosahedronGeometry(1, 0); geometries.push(splashGeometry);
  const poolGeometry = new THREE.CircleGeometry(1, 7); geometries.push(poolGeometry);
  const legacyCascades=CASCADES.slice(1); // The first fall owns quarks spray and pool foam.
  const splashCount = legacyCascades.length * 64;
  const poolFoam = new THREE.InstancedMesh(poolGeometry, foam, splashCount); poolFoam.frustumCulled = false; group.add(poolFoam);
  const splashes = new THREE.InstancedMesh(splashGeometry, sprayMaterial, splashCount); splashes.frustumCulled = false; group.add(splashes);
  const spraySeeds = Array.from({ length: splashCount }, (_, index) => ({ cascade: legacyCascades[Math.floor(index / 64)], phase: random(), lane: random(), side: random() > .5 ? 1 : 0, strength: .6 + random() * .5 }));
  const wakeLimit = 24;
  const wakes: WakePoint[][] = Array.from({ length: 5 }, () => []);
  const wakeMesh = new THREE.InstancedMesh(streakGeometry, wakeMaterial, 5 * wakeLimit * 2); wakeMesh.frustumCulled = false; group.add(wakeMesh);
  const transform = new THREE.Object3D(), tangent = new THREE.Vector3(), normal = new THREE.Vector3(), side = new THREE.Vector3(), basis = new THREE.Matrix4();
  const color = new THREE.Color(), fadedWake = new THREE.Color(0x498f80);
  let lastRaceTime = -1, lastWakeSample = -1;
  function orient(f: WaterSample, lateral: number, width: number, length: number, lift = .06) {
    transform.position.set(f.x + f.nx * lateral, f.y + lift, f.z + f.nz * lateral);
    tangent.set(f.tx, -f.slope, f.tz).normalize(); side.set(f.nx, 0, f.nz).normalize(); normal.crossVectors(side, tangent).normalize();
    basis.makeBasis(side, tangent, normal); transform.quaternion.setFromRotationMatrix(basis);
    transform.scale.set(width, length, 1); transform.updateMatrix();
  }
  function update(ducks: Duck[], raceTime: number, delta: number, paused: boolean, running: boolean) {
    if (!paused) {
      clock.value += Math.min(delta, .1);
      for (let i = 0; i < 32; i++) {
        const f = currentSamples[refreshIndex++ % currentSamples.length];
        f.speed = flowAt(f.s, (f.min + f.max) / 2, raceTime).forward;
      }
    }
    particles.forEach((particle, index) => {
      const f0 = sampleCached(particle.cache, particle.s), speed = f0.speed * (1 - .16 * (particle.lane * 2 - 1) ** 2);
      if (!paused) particle.s = particle.cache.start + (particle.s - particle.cache.start + speed * delta) % (particle.cache.end - particle.cache.start);
      const f = sampleCached(particle.cache, particle.s), lateral = f.min + (f.max - f.min) * particle.lane;
      const rapid = THREE.MathUtils.smoothstep(f.slope, .22, .85);
      const displaySpeed = f.speed * (1 - .16 * (particle.lane * 2 - 1) ** 2);
      orient(f, lateral, (.022 + rapid * .045) * particle.size, (.18 + Math.min(displaySpeed, 8) * .055) * particle.size);
      if (inWaterfallGap(particle.s)) { transform.scale.setScalar(0); transform.updateMatrix(); }
      streaks.setMatrixAt(index, transform.matrix);
      color.setHex(rapid > .4 ? 0xd5e6d7 : 0xa5cfc1); streaks.setColorAt(index, color);
    });
    streaks.instanceMatrix.needsUpdate = true; if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;
    spraySeeds.forEach((seed, index) => {
      const age = (clock.value * .72 + seed.phase) % 1, s = seed.cascade.end - 1.6 + age * 3;
      const spans = channelSpans(s), span = spans[seed.side % spans.length];
      const lateral = span.min + (span.max - span.min) * (.1 + seed.lane * .8), f = sampleSurface(s, lateral);
      transform.position.set(f.x + f.nx * lateral, f.y + .08 + Math.sin(age * Math.PI) * seed.strength * 1.35, f.z + f.nz * lateral);
      transform.rotation.set(age * 3, seed.phase, age * 2);
      const scale = (.035 + seed.strength * .075) * Math.sin(age * Math.PI);
      transform.scale.set(scale, scale * 1.8, scale); transform.updateMatrix(); splashes.setMatrixAt(index, transform.matrix);
      const poolS = seed.cascade.end + age * 7, poolSpan = channelAt(poolS, lateral), cache = cacheAt(poolS, poolSpan.route);
      const poolFrame = sampleCached(cache, poolS), poolLateral = THREE.MathUtils.clamp(lateral, poolFrame.min + .15, poolFrame.max - .15);
      const patch = (.20 + seed.strength * .2) * Math.sin(age * Math.PI);
      orient(poolFrame, poolLateral, patch * 1.3, patch * 2.2, .065); poolFoam.setMatrixAt(index, transform.matrix);
    });
    splashes.instanceMatrix.needsUpdate = true; poolFoam.instanceMatrix.needsUpdate = true;
    if (raceTime < lastRaceTime) { wakes.forEach(wake => wake.splice(0)); lastWakeSample = -1; }
    if (running && raceTime - lastWakeSample > .10) {
      for (const duck of ducks) if (duck.vs > .2 && !duck.airborne) {
        const trail = wakes[duck.id], cache = cacheAt(duck.s, channelAt(duck.s, duck.lateral).route); trail.unshift({ s: duck.s, lateral: duck.lateral, born: raceTime, cache }); if (trail.length > wakeLimit) trail.pop();
      }
      lastWakeSample = raceTime;
    }
    lastRaceTime = raceTime;
    let instance = 0;
    for (let duckId = 0; duckId < 5; duckId++) for (let i = 0; i < wakeLimit; i++) {
      const wake = wakes[duckId][i], age = wake ? raceTime - wake.born : 10;
      for (const direction of [-1, 1]) {
        if (!wake || age > 1.9 || !running && !paused) {
          transform.scale.setScalar(0); transform.updateMatrix(); wakeMesh.setMatrixAt(instance++, transform.matrix); continue;
        }
        // Foam is carried by the same current. Leaving it at historical duck
        // positions made rigid parallel rails anchored to the riverbed.
        const origin = sampleCached(wake.cache, wake.s);
        const driftS = Math.min(wake.cache.end, wake.s + origin.speed * age * .65);
        const f = sampleCached(wake.cache, driftS);
        const spread = .38 + age * .38, wobble = Math.sin(age * 7 + wake.born * 3) * .035;
        const lateral = THREE.MathUtils.clamp(wake.lateral + direction * spread + wobble, f.min + .06, f.max - .06);
        orient(f, lateral, .14 * (1 - age / 1.9) ** .7, .28 + age * .12, .075);
        wakeMesh.setMatrixAt(instance, transform.matrix);
        color.setHex(0xe1edda).lerp(fadedWake, age / 1.9); wakeMesh.setColorAt(instance++, color);
      }
    }
    wakeMesh.instanceMatrix.needsUpdate = true; if (wakeMesh.instanceColor) wakeMesh.instanceColor.needsUpdate = true;
  }
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group); waterMaterial.dispose(); foamTexture.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    streaks.dispose(); splashes.dispose(); poolFoam.dispose(); wakeMesh.dispose();
  }
  return { update, dispose, get time() { return clock.value; } };
}
