import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import * as THREE from 'three';
import { FORKS, RIVER_REACHES, channelSpans, sampleCourse } from '../src/course.ts';
import { createDucks } from '../src/simulation.ts';
import { createRiverWater } from '../src/water.ts';
import { createWaterNormalTexture } from '../src/water-material.ts';

function waterFixture(t, initialTime = 0, environment) {
  const scene = new THREE.Scene();
  const sentinel = new THREE.Object3D();
  scene.add(sentinel);
  const water = createRiverWater(scene, initialTime, environment);
  t.after(() => water.dispose());
  const group = scene.getObjectByName('river-water');
  assert.ok(group, 'water attaches its own scene group');
  const surfaces = [];
  group.traverse(object => {
    if (object.isMesh && !object.isInstancedMesh && object.material.isMeshPhysicalMaterial) surfaces.push(object);
  });
  assert.equal(surfaces.length, RIVER_REACHES.length, 'every connected river reach has a water surface');
  scene.updateMatrixWorld(true);
  return { scene, sentinel, water, group, surfaces };
}

function compileBindings(material) {
  // Exercise the public Three.js compilation hook using the real physical shader.
  // Assertions inspect bound values and resources, never the shader source text.
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader);
  return shader.uniforms;
}

function instanceSnapshot(group) {
  const result = [];
  group.traverse(object => {
    if (object.isInstancedMesh) {
      result.push(Array.from(object.instanceMatrix.array));
      if (object.instanceColor) result.push(Array.from(object.instanceColor.array));
    }
  });
  return result;
}

function watchDisposals(resources) {
  const counts = new Map();
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  return counts;
}

test('water normal texture rejects invalid dimensions and supports both size boundaries', () => {
  for (const size of [-32, 0, 1, 16, 31, 33, 48, 255, 257, 1000, 1025, 2048, 32.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => createWaterNormalTexture(42, size), RangeError, `invalid size ${size}`);
  }
  for (const size of [32, 1024]) {
    const texture = createWaterNormalTexture(42, size);
    assert.equal(texture.image.width, size);
    assert.equal(texture.image.height, size);
    assert.equal(texture.image.data.length, size * size * 4);
    texture.dispose();
  }
});

test('water normals are deterministic per seed and different seeds produce different relief', t => {
  const a = createWaterNormalTexture(7201);
  const repeat = createWaterNormalTexture(7201);
  const b = createWaterNormalTexture(1949);
  t.after(() => [a, repeat, b].forEach(texture => texture.dispose()));
  assert.deepEqual(a.image.data, repeat.image.data);
  let difference = 0;
  for (let pixel = 0; pixel < a.image.data.length; pixel += 4) {
    difference += Math.abs(a.image.data[pixel] - b.image.data[pixel]);
    difference += Math.abs(a.image.data[pixel + 1] - b.image.data[pixel + 1]);
  }
  const averageChannelDifference = difference / (a.image.width * a.image.height * 2 * 255);
  assert.ok(averageChannelDifference > .02, 'seeds change visible normal relief, not just metadata');
});

test('water normals decode to varied unit vectors and repeat without a sharp tile seam', t => {
  for (const seed of [7201, 1949]) {
    const texture = createWaterNormalTexture(seed);
    t.after(() => texture.dispose());
    assert.equal(texture.colorSpace, THREE.NoColorSpace, 'normal data must not receive sRGB conversion');
    assert.equal(texture.wrapS, THREE.RepeatWrapping);
    assert.equal(texture.wrapT, THREE.RepeatWrapping);
    const { width: size, data } = texture.image;
    const component = (x, y, channel) => data[(y * size + x) * 4 + channel] / 255 * 2 - 1;
    const squaredDifference = (x, y, xx, yy) => {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += (component(x, y, k) - component(xx, yy, k)) ** 2;
      return sum;
    };
    let slopeEnergy = 0, interiorDifference = 0, interiorPairs = 0, seamDifference = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = component(x, y, 0), ny = component(x, y, 1), nz = component(x, y, 2);
      assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < .012, 'RGB quantization preserves a unit normal');
      assert.ok(nz > 0, 'normal remains in the outward hemisphere');
      assert.equal(data[(y * size + x) * 4 + 3], 255);
      slopeEnergy += nx * nx + ny * ny;
      if (x + 1 < size) { interiorDifference += squaredDifference(x, y, x + 1, y); interiorPairs++; }
      if (y + 1 < size) { interiorDifference += squaredDifference(x, y, x, y + 1); interiorPairs++; }
    }
    assert.ok(slopeEnergy / (size * size) > .01, 'the water has measurable surface relief');
    for (let i = 0; i < size; i++) {
      seamDifference += squaredDifference(0, i, size - 1, i) + squaredDifference(i, 0, i, size - 1);
    }
    const interiorRms = Math.sqrt(interiorDifference / interiorPairs);
    const seamRms = Math.sqrt(seamDifference / (size * 2));
    // Adjacent texels across a periodic edge need not be identical, but their
    // change should be comparable to adjacent texels inside the same texture.
    assert.ok(seamRms <= interiorRms * 1.6 + .015, `seed ${seed}: tile seam must remain smooth`);
  }
});

test('real water geometry is finite, faces upward, and stays inside navigable river spans', t => {
  const { group, surfaces, water } = waterFixture(t);
  water.update(createDucks(42), 0, 1 / 60, false, false);
  group.traverse(object => {
    if (object.geometry) for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `finite ${name} attribute`);
    }
    if (object.isInstancedMesh) {
      assert.ok(object.instanceMatrix.array.every(Number.isFinite));
      if (object.instanceColor) assert.ok(object.instanceColor.array.every(Number.isFinite));
    }
  });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const mesh of surfaces) {
    const { position, normal, uv } = mesh.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      assert.ok(normal.getY(i) > 0, 'water vertex normal points upward');
      assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-5);
      const s = uv.getY(i), frame = sampleCourse(s);
      const lateral = (position.getX(i) - frame.x) * frame.nx + (position.getZ(i) - frame.z) * frame.nz;
      const span = channelSpans(s).find(channel => lateral >= channel.min - .002 && lateral <= channel.max + .002);
      assert.ok(span, `water vertex must be over a real channel at s=${s}`);
      assert.ok(Math.abs(position.getY(i) - span.y) < .1, 'each branch follows its own water elevation');
    }
    const index = mesh.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
      a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
      const centerX = (a.x + b.x + c.x) / 3, centerZ = (a.z + b.z + c.z) / 3;
      assert.ok(b.sub(a).cross(c.sub(a)).y > 0, 'front-facing triangles remain visible from above');
      const s = (uv.getY(ia) + uv.getY(ib) + uv.getY(ic)) / 3, frame = sampleCourse(s);
      const lateral = (centerX - frame.x) * frame.nx + (centerZ - frame.z) * frame.nz;
      assert.ok(channelSpans(s).some(channel => lateral >= channel.min - .015 && lateral <= channel.max + .015),
        `water triangle must not bridge land at s=${s}`);
    }
  }
});

test('raycasts reach both branch surfaces while the solid island gap stays uncovered', t => {
  const { surfaces } = waterFixture(t);
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  for (const fork of FORKS) for (const fraction of [.2, .35, .5, .65, .8]) {
    const s = fork.start + (fork.end - fork.start) * fraction;
    const frame = sampleCourse(s), spans = channelSpans(s);
    assert.equal(spans.length, 2);
    const castAt = lateral => {
      raycaster.set(new THREE.Vector3(frame.x + frame.nx * lateral, frame.y + 50, frame.z + frame.nz * lateral), down);
      return raycaster.intersectObjects(surfaces, false);
    };
    assert.equal(castAt((spans[0].max + spans[1].min) / 2).length, 0, `island ${fork.id} remains dry at ${fraction}`);
    for (const span of spans) {
      const hits = castAt((span.min + span.max) / 2);
      assert.ok(hits.length > 0, `water covers the ${span.route} branch`);
      assert.ok(Math.abs(hits[0].point.y - span.y) < .15, 'ray reaches the correct branch elevation');
    }
  }
});

test('water clock starts at the supplied time and pause freezes flow, foam and normals', t => {
  const { water, group, surfaces } = waterFixture(t, 12.5);
  const uniforms = compileBindings(surfaces[0].material);
  assert.equal(uniforms.uRiverTime.value, 12.5);
  const ducks = createDucks(42);
  ducks.forEach(duck => { duck.vs = 1; });
  water.update(ducks, 1, .05, false, true);
  assert.ok(Math.abs(uniforms.uRiverTime.value - 12.55) < 1e-9);
  const frozen = instanceSnapshot(group);
  for (let i = 0; i < 4; i++) water.update(ducks, 1, .1, true, false);
  assert.ok(Math.abs(uniforms.uRiverTime.value - 12.55) < 1e-9);
  assert.ok(isDeepStrictEqual(instanceSnapshot(group), frozen), 'pause freezes every foam, spray and wake instance');
  water.update(ducks, 1.05, .05, false, true);
  assert.ok(Math.abs(uniforms.uRiverTime.value - 12.6) < 1e-9);
  assert.ok(!isDeepStrictEqual(instanceSnapshot(group), frozen), 'unpausing resumes the visible flow');
});

test('invalid initial water clocks fail without adding scene objects', () => {
  const scene = new THREE.Scene(), sentinel = new THREE.Object3D();
  scene.add(sentinel);
  for (const time of [-.01, NaN, Infinity, -Infinity]) {
    assert.throws(() => createRiverWater(scene, time), RangeError);
    assert.deepEqual(scene.children, [sentinel]);
  }
});

test('water disposal removes its group and releases owned materials, textures and geometry once', t => {
  const environment = new THREE.Texture();
  t.after(() => environment.dispose());
  const { scene, sentinel, water, group, surfaces } = waterFixture(t, 0, environment);
  const resources = new Set();
  group.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture && value !== environment) resources.add(value);
      }
    }
    if (object.isInstancedMesh) resources.add(object);
  });
  const material = surfaces[0].material;
  assert.equal(material.envMap, environment, 'caller-supplied lighting reaches the physical water material');
  assert.ok(material.transmission > 0 && material.transmission <= 1);
  assert.ok(material.roughness >= 0 && material.roughness <= 1);
  assert.ok(material.ior > 1 && material.ior <= 2);
  assert.ok(Number.isFinite(material.attenuationDistance) && material.attenuationDistance > 0);
  const uniforms = compileBindings(material);
  const normals = [uniforms.uWaterNormal0.value, uniforms.uWaterNormal1.value];
  assert.notEqual(normals[0], normals[1]);
  assert.ok(normals.every(texture => texture.isDataTexture));
  normals.forEach(texture => resources.add(texture));
  const counts = watchDisposals(resources), externalCount = watchDisposals([environment]);
  water.dispose();
  water.dispose();
  assert.deepEqual(scene.children, [sentinel], 'water cleanup preserves unrelated scene objects');
  for (const [resource, count] of counts) assert.equal(count, 1, `${resource.type ?? resource.name} disposed exactly once`);
  assert.equal(externalCount.get(environment), 0, 'shared environment remains owned by its caller');
});
