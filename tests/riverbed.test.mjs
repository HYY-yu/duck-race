import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRiverbedDetails } from '../src/riverbed.ts';
import { COURSE_LENGTH, RIVER_REACHES, channelSpans, sampleCourse } from '../src/course.ts';

function fixture(t) {
  const scene = new THREE.Scene(), existing = new THREE.Object3D(); scene.add(existing);
  const bed = createRiverbedDetails(scene); scene.updateMatrixWorld(true);
  const group = scene.getObjectByName('riverbed-details');
  assert.ok(group);
  const surfaces = group.children.filter(object => object.isMesh && !object.isInstancedMesh);
  const pebbles = group.children.filter(object => object.isInstancedMesh);
  t.after(() => bed.dispose());
  return { scene, existing, bed, group, surfaces, pebbles };
}

test('sand surfaces stay on the bed of each real channel and never bridge an island', t => {
  const { surfaces } = fixture(t);
  assert.equal(surfaces.length, RIVER_REACHES.length);
  const branchSamples = { left: 0, right: 0 };
  for (const mesh of surfaces) {
    const positions = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const lateral = uv.getX(i), s = uv.getY(i), frame = sampleCourse(s);
      const span = channelSpans(s).find(candidate => lateral >= candidate.min - .001 && lateral <= candidate.max + .001);
      assert.ok(span, `sand lies inside navigable water at s=${s}, lateral=${lateral}`);
      if (span.route !== 'main') branchSamples[span.route]++;
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(Math.abs(point.x - frame.x - frame.nx * lateral) < .001);
      assert.ok(Math.abs(point.z - frame.z - frame.nz * lateral) < .001);
      assert.ok(point.y >= span.y - span.depth && point.y <= span.y - span.depth + .05,
        `sand is attached to the ${span.route} floor rather than floating at the surface`);
    }
  }
  assert.ok(branchSamples.left > 100 && branchSamples.right > 100);
});

const courseSamples = Array.from({ length: Math.ceil(COURSE_LENGTH) + 1 }, (_, i) => {
  const s = i / Math.ceil(COURSE_LENGTH) * COURSE_LENGTH;
  return { s, ...sampleCourse(s) };
});
function project(point, guess) {
  let s = guess;
  if (s === undefined) {
    let distance = Infinity;
    for (const sample of courseSamples) {
      const next = (point.x - sample.x) ** 2 + (point.z - sample.z) ** 2;
      if (next < distance) { distance = next; s = sample.s; }
    }
  }
  for (let iteration = 0; iteration < 6; iteration++) {
    const frame = sampleCourse(s);
    s = THREE.MathUtils.clamp(s + (point.x - frame.x) * frame.tx + (point.z - frame.z) * frame.tz, 0, COURSE_LENGTH);
  }
  const frame = sampleCourse(s);
  return { s, lateral: (point.x - frame.x) * frame.nx + (point.z - frame.z) * frame.nz };
}

test('every transformed pebble remains submerged inside its channel without covering an island', t => {
  const { pebbles } = fixture(t);
  assert.equal(pebbles.length, RIVER_REACHES.length);
  const matrix = new THREE.Matrix4();
  for (const mesh of pebbles) {
    assert.ok(mesh.count > 0);
    const positions = mesh.geometry.attributes.position, unique = new Map();
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i);
      unique.set(p.toArray().map(value => value.toFixed(6)).join(','), p);
    }
    for (let instance = 0; instance < mesh.count; instance++) {
      mesh.getMatrixAt(instance, matrix); matrix.premultiply(mesh.matrixWorld);
      assert.ok(matrix.elements.every(Number.isFinite));
      const center = new THREE.Vector3().setFromMatrixPosition(matrix), centerS = project(center).s;
      for (const vertex of unique.values()) {
        const p = vertex.clone().applyMatrix4(matrix), { s, lateral } = project(p, centerS);
        const span = channelSpans(s).find(candidate => lateral >= candidate.min && lateral <= candidate.max);
        assert.ok(span, `pebble leaves the water at s=${s.toFixed(3)}, lateral=${lateral.toFixed(3)}`);
        const floor = span.y - span.depth;
        assert.ok(p.y >= floor - .17 && p.y <= floor + .20, 'pebbles sit in the bed rather than becoming floating obstacles');
        assert.ok(p.y < span.y - .5, 'pebbles stay well beneath the racing surface');
      }
    }
  }
});

test('caustic updates accept finite time and reject invalid clocks visibly', t => {
  const { bed, pebbles } = fixture(t);
  const transforms = pebbles.map(mesh => Array.from(mesh.instanceMatrix.array));
  for (const time of [0, .5, 120, 0]) assert.doesNotThrow(() => bed.update(time));
  for (const time of [-1, NaN, Infinity, -Infinity]) assert.throws(() => bed.update(time), RangeError);
  assert.deepEqual(pebbles.map(mesh => Array.from(mesh.instanceMatrix.array)), transforms, 'light animation does not move the submerged rocks');
});

test('riverbed disposal releases shared resources once and leaves the rest of the scene intact', t => {
  const { bed, group, scene, existing, pebbles } = fixture(t);
  const resources = new Set(pebbles);
  group.traverse(object => {
    if (!object.isMesh) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
  });
  const counts = new Map();
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  bed.dispose(); bed.dispose();
  assert.equal(group.parent, null);
  assert.deepEqual(scene.children, [existing]);
  for (const count of counts.values()) assert.equal(count, 1);
});
