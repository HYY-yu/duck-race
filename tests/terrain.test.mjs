import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTerrain } from '../src/terrain.ts';
import { COURSE_LENGTH, FORKS, CASCADES, channelSpans, sampleCourse } from '../src/course.ts';

function fixture(t) {
  const scene = new THREE.Scene();
  const existingObject = new THREE.Object3D(); scene.add(existingObject);
  const terrain = createTerrain(scene);
  scene.updateMatrixWorld(true);
  const group = scene.getObjectByName('cascade-canyon-terrain');
  assert.ok(group, 'terrain is attached to the scene');
  const surfaces = [], instanced = [], geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (!object.isMesh) return;
    (object.isInstancedMesh ? instanced : surfaces).push(object);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  let disposed = false;
  const dispose = () => { if (!disposed) { terrain.dispose(); disposed = true; } };
  t.after(dispose);
  return { scene, existingObject, terrain, group, surfaces, instanced, geometries, materials, dispose };
}

function verticalHit(x, z, objects, top) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, top, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(objects, false)[0];
}

test('rendered terrain stays beneath the bed of every navigable channel, including both forks', t => {
  const { surfaces, terrain } = fixture(t);
  const checkpoints = new Set();
  for (let s = 1; s < COURSE_LENGTH; s += 3.1) checkpoints.add(s);
  for (const reach of [...FORKS, ...CASCADES]) {
    for (const offset of [.25, .5, .75]) checkpoints.add(reach.start + (reach.end - reach.start) * offset);
    checkpoints.add(reach.start + .1); checkpoints.add(reach.end - .1);
  }
  const branchSamples = { left: 0, right: 0 };
  for (const s of checkpoints) {
    const frame = sampleCourse(s);
    for (const span of channelSpans(s)) {
      if (span.route !== 'main') branchSamples[span.route]++;
      // Check three navigable lanes, not only the common course centerline that
      // lies inside solid islands during a fork.
      for (const fraction of [.18, .5, .82]) {
        const lateral = THREE.MathUtils.lerp(span.min, span.max, fraction);
        const x = frame.x + frame.nx * lateral, z = frame.z + frame.nz * lateral;
        const hit = verticalHit(x, z, surfaces, terrain.bounds.max.y + 20);
        assert.ok(hit, `solid support under ${span.route} at s=${s.toFixed(2)}`);
        assert.ok(hit.point.y <= span.y - span.depth + .02,
          `terrain cuts through ${span.route} bed at s=${s.toFixed(2)}: terrain=${hit.point.y}, bed=${span.y - span.depth}`);
      }
    }
  }
  assert.ok(branchSamples.left >= 20 && branchSamples.right >= 20, 'both branch elevations are covered');
});

test('the outer rock bevel joins the terrain continuously around its complete outline', t => {
  const { surfaces, terrain } = fixture(t);
  // Identify the largest continuous ground and the shallow perimeter mesh by
  // their rendered geometry, without importing construction helpers or formulas.
  const ground = [...surfaces].sort((a, b) => b.geometry.index.count - a.geometry.index.count)[0];
  const bevelCandidates = surfaces.filter(mesh => {
    if (mesh === ground) return false;
    mesh.geometry.computeBoundingBox();
    const extent = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    return extent.x > 100 && extent.z > 200 && extent.y < 3;
  });
  assert.equal(bevelCandidates.length, 1, 'one shallow rock bevel finishes the mountain mass');
  const bevel = bevelCandidates[0], positions = bevel.geometry.attributes.position;
  // A small inward probe avoids numerical edge ambiguity. Check the upper rim
  // at angular sectors all around the actual outline to catch local open seams.
  bevel.geometry.computeBoundingBox();
  const center = bevel.geometry.boundingBox.getCenter(new THREE.Vector3());
  const sectors = new Map();
  for (let i = 0; i < positions.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(bevel.matrixWorld);
    if (p.y < bevel.geometry.boundingBox.max.y - .004) continue;
    const angle = Math.atan2(p.z - center.z, p.x - center.x);
    const sector = Math.floor((angle + Math.PI) / (2 * Math.PI) * 180);
    const before = sectors.get(sector);
    if (!before || p.distanceToSquared(center) < before.distanceToSquared(center)) sectors.set(sector, p);
  }
  assert.ok(sectors.size >= 175, 'rim samples cover the full circumference');
  for (const [sector, p] of sectors) {
    const x = THREE.MathUtils.lerp(p.x, center.x, .001), z = THREE.MathUtils.lerp(p.z, center.z, .001);
    const hit = verticalHit(x, z, [ground], terrain.bounds.max.y + 20);
    assert.ok(hit, `ground is missing behind the bevel in sector ${sector}`);
    assert.ok(hit.point.y >= p.y - .025, `bevel floats above the ground in sector ${sector}`);
    assert.ok(hit.point.y - p.y < .5, `ground and bevel are disconnected in sector ${sector}`);
  }
});

test('terrain outputs finite vertices, valid bounds and finite instance transforms', t => {
  const { terrain, geometries, instanced } = fixture(t);
  assert.ok(!terrain.bounds.isEmpty());
  assert.ok([...terrain.bounds.min.toArray(), ...terrain.bounds.max.toArray()].every(Number.isFinite));
  for (const geometry of geometries) {
    assert.ok(geometry.attributes.position.count > 0);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok([...attribute.array].every(Number.isFinite), 'geometry attributes must not contain NaN or Infinity');
    }
    if (geometry.index) {
      for (const id of geometry.index.array) assert.ok(id >= 0 && id < geometry.attributes.position.count, 'triangle references an existing vertex');
    }
  }
  assert.ok(instanced.length > 0, 'vegetation shares instanced geometry');
  for (const mesh of instanced) assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
});

test('disposing terrain releases its resources and preserves unrelated scene objects', t => {
  const { scene, existingObject, group, geometries, materials, instanced, dispose } = fixture(t);
  const disposed = new Map();
  for (const resource of [...geometries, ...materials, ...instanced]) {
    disposed.set(resource, 0);
    resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  }
  dispose();
  assert.equal(group.parent, null);
  assert.deepEqual(scene.children, [existingObject]);
  for (const [resource, count] of disposed) assert.equal(count, 1, `${resource.type ?? resource.constructor.name} is released once`);
});

test('shore apron outer edges meet the rendered ground height and shading normal',t=>{
  const scene=new THREE.Scene(),terrain=createTerrain(scene);t.after(()=>terrain.dispose());
  const ground=scene.getObjectByName('valley-ground'),ray=new THREE.Raycaster();scene.updateMatrixWorld(true);
  for(const side of [-1,1]){
    const apron=scene.getObjectByName(`shore-apron-${side}`),p=apron.geometry.attributes.position,n=apron.geometry.attributes.normal;
    for(let i=4;i<p.count;i+=5*80){
      ray.set(new THREE.Vector3(p.getX(i),200,p.getZ(i)),new THREE.Vector3(0,-1,0));
      const [hit]=ray.intersectObject(ground);assert.ok(hit,'outer apron remains supported by the ground');
      assert.ok(Math.abs(p.getY(i)-hit.point.y-.002)<.00005,'no detached or sunken shoulder edge');
      if(hit.normal)assert.ok(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)).dot(hit.normal.clone().normalize())>.9999,'lighting remains smooth at the edge');
    }
  }
});
