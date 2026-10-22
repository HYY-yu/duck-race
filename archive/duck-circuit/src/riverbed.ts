import * as THREE from 'three';
import { riverStations, HEADWATER, RIVER_REACHES, sampleChannel, sampleCourse } from './course.ts';

/** Submerged detail only: these stones decorate the bed and do not add obstacles.
 * Separate ribbons follow each real branch's floor, leaving the islands solid.
 */
export function createRiverbedDetails(scene: THREE.Scene): { update(time: number): void; dispose(): void } {
  const group = new THREE.Group(); group.name = 'riverbed-details'; scene.add(group);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const clock = { value: 0 };
  const sand = new THREE.MeshStandardMaterial({ color: 0xb9af95, roughness: .96, metalness: 0 });
  materials.add(sand);
  sand.onBeforeCompile = shader => {
    shader.uniforms.uBedTime = clock;
    shader.vertexShader = 'attribute float bedDepth; varying vec2 vBedUv; varying float vBedDepth;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvBedUv = uv; vBedDepth = bedDepth;');
    shader.fragmentShader = `uniform float uBedTime; varying vec2 vBedUv; varying float vBedDepth;
      float bedHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float bedNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(bedHash(i), bedHash(i + vec2(1.0,0.0)), f.x),
          mix(bedHash(i + vec2(0.0,1.0)), bedHash(i + vec2(1.0,1.0)), f.x), f.y);
      }
      float bedCaustic(vec2 uv) {
        // Broad, broken pools of focused light, rather than a repeated wire lattice.
        vec2 p = uv * vec2(.88,.58) - vec2(.035,.22) * uBedTime;
        vec2 warp = vec2(bedNoise(p * .72 + vec2(4.1,0.0)), bedNoise(p * .69 + vec2(0.0,8.3)));
        p += (warp - .5) * 1.45;
        float lens = .5 + .25 * sin(p.x * 3.1 + p.y * .9)
          + .25 * sin(p.y * 3.7 - p.x * 1.3 + sin(p.x * 1.8) * .5);
        float patches = smoothstep(.78,.97,lens) * smoothstep(.22,.68,bedNoise(p * .7));
        float footprint = max(length(dFdx(p)),length(dFdy(p)));
        return patches * (1.0 - smoothstep(.65,1.6,footprint));
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float gravelPatches = bedNoise(vBedUv * vec2(.34,.25));
      vec2 grainUv = vBedUv * 21.0;
      float grainFootprint = max(length(dFdx(grainUv)),length(dFdy(grainUv)));
      float grain = mix(.5,bedNoise(grainUv),1.0 - smoothstep(.35,1.2,grainFootprint));
      diffuseColor.rgb *= .90 + gravelPatches * .13 + (grain - .5) * .10;
      float caustic = bedCaustic(vBedUv) * exp(-vBedDepth * .36);
      diffuseColor.rgb += caustic * vec3(.16,.17,.12);
    `);
  };
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa18d, roughness: .91, metalness: 0 });
  materials.add(stoneMaterial);
  const stoneGeometry = new THREE.IcosahedronGeometry(1, 1); geometries.add(stoneGeometry);
  const stoneColors = [0xc2bba6, 0xaaa28d, 0x9a998c, 0xb0a28b, 0x8e9186].map(color => new THREE.Color(color));
  let randomState = 304721;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), basis = new THREE.Matrix4();
  const orientation = new THREE.Quaternion(), spin = new THREE.Quaternion(), matrix = new THREE.Matrix4(), yAxis = new THREE.Vector3(0, 1, 0);
  const stones: THREE.InstancedMesh[] = [];
  for (const reach of RIVER_REACHES) {
    const stations=riverStations(reach.start,reach.end),rows=stations.length-1,columns=reach.route==='main'?10:5;
    const normals:number[]=[];
    const positions: number[] = [], uv: number[] = [], depths: number[] = [], indices: number[] = [];
    let area = 0;
    for (let row = 0; row <= rows; row++) {
      const s = stations[row], frame = sampleCourse(s), span = sampleChannel(s, reach.route);
      if (row < rows) area += (span.max - span.min) * (reach.end - reach.start) / rows;
      for (let column = 0; column <= columns; column++) {
        const lateral = THREE.MathUtils.lerp(span.min, span.max, column / columns);
        positions.push(frame.x + frame.nx * lateral, span.y - span.depth + .018, frame.z + frame.nz * lateral);
        const before=sampleChannel(s-.01,reach.route),after=sampleChannel(s+.01,reach.route);
        const slope=((before.y-before.depth)-(after.y-after.depth))/.02;
        const n=new THREE.Vector3(frame.tx*slope,1,frame.tz*slope).normalize();normals.push(n.x,n.y,n.z);
        // Physical lateral meters stay continuous through splits and merges.
        uv.push(lateral, s); depths.push(span.depth);
      }
      if (row < rows) for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('bedDepth', new THREE.Float32BufferAttribute(depths, 1));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setIndex(indices); geometries.add(geometry);
    const bed = new THREE.Mesh(geometry, sand); bed.name = `riverbed-sand-${reach.route}-${reach.start}`;
    bed.receiveShadow = true; group.add(bed);

    // Small pockets leave most of the sandy bottom empty, including the racing line.
    const count = Math.max(8, Math.round(area * .12));
    const pebbles = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, count);
    pebbles.name = `riverbed-pebbles-${reach.route}-${reach.start}`;
    let clusterS = 0, clusterLane = .5;
    for (let i = 0; i < count; i++) {
      if (i % 5 === 0) {
        clusterS = reach.start + .8 + random() * (reach.end - reach.start - 1.6);
        const bank = random(); clusterLane = bank < .36 ? .12 : bank > .64 ? .88 : .25 + random() * .5;
      }
      let s = THREE.MathUtils.clamp(clusterS + (random() - .5) * 2.2, reach.start + .6, reach.end - .6);
      // No gravel is scattered on the near-vertical cliff behind the free sheet.
      if(s>HEADWATER.lip-.7&&s<HEADWATER.impact+1)s=HEADWATER.impact+1+random()*3;
      const frame = sampleCourse(s), span = sampleChannel(s, reach.route);
      const lateral = THREE.MathUtils.clamp(THREE.MathUtils.lerp(span.min, span.max, clusterLane) + (random() - .5) * .8, span.min + .5, span.max - .5);
      const width = .07 + random() * .16, length = .10 + random() * .20, height = .026 + random() * .038;
      tangent.set(frame.tx, -span.slope, frame.tz).normalize(); side.set(frame.nx, 0, frame.nz); up.crossVectors(tangent, side).normalize();
      basis.makeBasis(side, up, tangent); orientation.setFromRotationMatrix(basis);
      spin.setFromAxisAngle(yAxis, random() * Math.PI * 2); orientation.multiply(spin);
      const position = new THREE.Vector3(frame.x + frame.nx * lateral, span.y - span.depth + .028, frame.z + frame.nz * lateral);
      matrix.compose(position, orientation, new THREE.Vector3(width, height, length));
      pebbles.setMatrixAt(i, matrix);
      // Instance colors are multiplicative, so use a white material base for the palette below.
      pebbles.setColorAt(i, stoneColors[Math.floor(random() * stoneColors.length)]);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    pebbles.receiveShadow = true; group.add(pebbles); stones.push(pebbles);
  }
  stoneMaterial.color.setHex(0xffffff);
  let disposed = false;
  return {
    update(time: number) {
      if (!Number.isFinite(time) || time < 0) throw new RangeError('Riverbed clock must be a finite, non-negative number.');
      if (!disposed) clock.value = time;
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      stones.forEach(mesh => mesh.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    },
  };
}
