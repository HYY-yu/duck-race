import { WATER_WAVE_GLSL } from './water-wave.ts';
import * as THREE from 'three';

/** Original tileable normal fields. No remote texture request or third-party image licence. */
export function createWaterNormalTexture(seed: number, size = 256): THREE.DataTexture {
  if (!Number.isInteger(size) || size < 32 || size > 1024 || (size & (size - 1)) !== 0) throw new RangeError('Water normal size must be a power of two from 32 to 1024.');
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const height = new Float32Array(size * size);
  [8, 16, 32, 64].forEach((period, octave) => {
    const grid = Float32Array.from({ length: period * period }, random);
    const amplitude = [.56, .25, .13, .06][octave];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x / size * period, py = y / size * period, ix = Math.floor(px), iy = Math.floor(py);
      let fx = px - ix, fy = py - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = grid[iy * period + ix], b = grid[iy * period + (ix + 1) % period];
      const c = grid[((iy + 1) % period) * period + ix], d = grid[((iy + 1) % period) * period + (ix + 1) % period];
      height[y * size + x] += amplitude * ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy);
    }
  });
  const pixels = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x - 1, y) - h(x + 1, y)) * size * .032;
    const dy = (h(x, y - 1) - h(x, y + 1)) * size * .032;
    const length = Math.hypot(dx, dy, 1), offset = (y * size + x) * 4;
    pixels[offset] = Math.round((dx / length * .5 + .5) * 255);
    pixels[offset + 1] = Math.round((dy / length * .5 + .5) * 255);
    pixels[offset + 2] = Math.round((1 / length * .5 + .5) * 255); pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = `river-normal-${seed}`; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return texture;
}

/**
 * Flow-normal blending adapts Three.js r180 Water2 (MIT, three.js authors).
 * See public/licenses/three-water-MIT.txt and docs/WATER-PHYSICS.md.
 * Water2's planar Reflector/Refractor are deliberately not used on descending river meshes.
 */
export function createWaterMaterial(clock: { value: number }, environment?: THREE.Texture) {
  const normals = [createWaterNormalTexture(7201), createWaterNormalTexture(1949)];
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .15,
    transmission: .52, thickness: 1, ior: 1.333, attenuationColor: 0x09868e, attenuationDistance: 1.5,
    specularIntensity: 1, envMap: environment ?? null, envMapIntensity: .45,
    side: THREE.FrontSide, transparent: false, depthWrite: true });
  material.name = 'flowing-river-volume';
  material.customProgramCacheKey = () => 'duck-rush-volume-v3';
  material.onBeforeCompile = shader => {
    shader.uniforms.uRiverTime = clock;
    shader.uniforms.uWaterNormal0 = { value: normals[0] };
    shader.uniforms.uWaterNormal1 = { value: normals[1] };
    shader.vertexShader = `uniform float uRiverTime; attribute vec4 riverData; attribute vec3 riverShore; attribute vec4 riverAxis; attribute float riverImpact; attribute float riverBankDistance;
      varying vec2 vRiverUv; varying vec4 vRiverData; varying vec3 vRiverShore; varying vec3 vWaterAcross; varying vec3 vWaterAlong; varying float vRiverImpact; varying float vRiverBankDistance;
    ` + WATER_WAVE_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      vRiverUv = uv; vRiverData = riverData; vRiverShore = riverShore; vRiverImpact = riverImpact; vRiverBankDistance = riverBankDistance;
      vWaterAcross = normalize(mat3(modelViewMatrix) * vec3(riverAxis.z, 0.0, riverAxis.w));
      vWaterAlong = normalize(mat3(modelViewMatrix) * vec3(riverAxis.x, -riverData.z, riverAxis.y));
    `).replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += riverSurfaceWave(uv.y, riverShore.z, riverBankDistance, uRiverTime);
    `);
    shader.fragmentShader = `uniform float uRiverTime; uniform sampler2D uWaterNormal0; uniform sampler2D uWaterNormal1;
      varying vec2 vRiverUv; varying vec4 vRiverData; varying vec3 vRiverShore; varying vec3 vWaterAcross; varying vec3 vWaterAlong; varying float vRiverImpact; varying float vRiverBankDistance;
      float riverHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float riverNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(riverHash(i), riverHash(i + vec2(1.0,0.0)), f.x),
          mix(riverHash(i + vec2(0.0,1.0)), riverHash(i + vec2(1.0,1.0)), f.x), f.y);
      }
      vec2 waterFoam(vec2 p) {
        float broad = riverNoise(p * vec2(.75, .27));
        vec2 detailUv = p * vec2(3.7, 2.1) + broad * 1.8;
        float footprint = max(length(dFdx(detailUv)), length(dFdy(detailUv)));
        float detail = mix(.5, riverNoise(detailUv), 1.0 - smoothstep(.4, 1.2, footprint));
        // Uneven aerated patches stretch downstream without forming regular stripes.
        float turbulence = riverNoise(p * vec2(1.9, .85) + broad * 2.3);
        float whitewater = smoothstep(.53, .77, turbulence * .76 + detail * .24);
        return vec2(detail, whitewater);
      }
      vec3 flowingNormal(vec2 p) {
        vec3 broad = texture2D(uWaterNormal0, p * vec2(.16, .11)).xyz * 2.0 - 1.0;
        vec3 small = texture2D(uWaterNormal1, p * vec2(.69, .48) + vec2(.31, .17)).xyz * 2.0 - 1.0;
        return normalize(vec3(broad.xy * .55 + small.xy * .10, 1.0));
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float riverRapid = smoothstep(.18, .78, vRiverData.z);
      float bankDistance = vRiverBankDistance;
      float shore = max((1.0 - smoothstep(.015, .36, vRiverUv.x * vRiverData.w)) * vRiverShore.x,
        (1.0 - smoothstep(.015, .36, (1.0 - vRiverUv.x) * vRiverData.w)) * vRiverShore.y);
      // Water2 dual-phase crossfade: reset a phase only at zero weight. A four-second
      // cycle bounds velocity-gradient UV shear even after hours of running.
      float phaseA = fract(uRiverTime * .25), phaseB = fract(phaseA + .5);
      float weightA = 1.0 - abs(phaseA * 2.0 - 1.0);
      vec2 riverUv = vec2(vRiverShore.z, vRiverUv.y);
      vec2 flowUvA = riverUv - vec2(0.0, phaseA * 4.0 * vRiverData.x);
      vec2 flowUvB = riverUv - vec2(0.0, phaseB * 4.0 * vRiverData.x);
      vec2 waterPattern = mix(waterFoam(flowUvB), waterFoam(flowUvA), weightA);
      float riverFoam = clamp(shore * smoothstep(.25, .72, waterPattern.x) * .68 + max(riverRapid, vRiverImpact) * waterPattern.y * .94, 0.0, .9);
      diffuseColor.rgb = mix(vec3(.035, .32, .29), vec3(.88, .96, .91), riverFoam);
    `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(.15 + riverRapid * .09, .62, riverFoam);
    `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 flowNormal = normalize(mix(flowingNormal(flowUvB), flowingNormal(flowUvA), weightA));
      // Build the perturbation in view space, following each curved, sloping branch.
      vec3 across = normalize(vWaterAcross - normal * dot(vWaterAcross, normal));
      vec3 along = normalize(vWaterAlong - normal * dot(vWaterAlong, normal));
      float normalStrength = (1.0 + riverRapid * .4) * (1.0 - riverFoam * .5);
      normal = normalize(normal * flowNormal.z + (across * flowNormal.x + along * flowNormal.y) * normalStrength);
    `).replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment
      .replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0 - riverFoam * .96);')
      .replace('material.thickness = thickness;', `material.thickness = vRiverData.y * mix(.32, 1.0, smoothstep(.0, min(2.8, vRiverData.w * .32), bankDistance));`));
  };
  return { material, dispose: () => { material.dispose(); normals.forEach(texture => texture.dispose()); } };
}
