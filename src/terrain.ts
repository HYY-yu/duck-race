import * as THREE from 'three';
import { bankShoulder, riverStations, COURSE_LENGTH, FORKS, channelSpans, sampleCourse, type ChannelSpan, type CourseFrame } from './course.ts';

type WaterSample = { s: number; frame: CourseFrame; span: ChannelSpan };
type GroundSample = { height: number; distance: number; waterY: number; s: number; ridge: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const noise = (x: number, z: number) => Math.sin(x * .071 + z * .027) * .55 + Math.sin(z * .123 - x * .043) * .28 + Math.sin(x * .31 + z * .17) * .17;

/** Continuous valley ground, exposed limestone and sparse planted groves.
 * Navigable water is carved out using the actual branch spans, including their
 * different surface elevations. Decoration never acts as a simulation collider.
 */
export function createTerrain(scene: THREE.Scene): { bounds: THREE.Box3; dispose(): void } {
  const group = new THREE.Group();
  group.name = 'cascade-canyon-terrain';
  scene.add(group);
  const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
  const material = (color: number, vertexColors = false) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 1, vertexColors });
    materials.add(result); return result;
  };
  const strataMaterial = material(0xffffff, true);
  const groundColors = {
    moss: new THREE.Color(0x53765b), grass: new THREE.Color(0x8d9b6d),
    rock: new THREE.Color(0xaaa699), limestone: new THREE.Color(0xc9beaa), shadow: new THREE.Color(0x778779),
  };
  const addMesh = (geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat); mesh.receiveShadow = true; mesh.castShadow = true;
    group.add(mesh); return mesh;
  };
  const riverSamples: WaterSample[] = [];
  const courseFrames: CourseFrame[] = [];
  for (let i = 0, count = Math.ceil(COURSE_LENGTH / 1.1); i <= count; i++) {
    const s = i / count * COURSE_LENGTH, frame = sampleCourse(s); courseFrames.push(frame);
    for (const span of channelSpans(s)) riverSamples.push({ s, frame, span });
  }
  const riverBounds = new THREE.Box3().setFromPoints(courseFrames.map(f => new THREE.Vector3(f.x, f.y, f.z)));
  const center = riverBounds.getCenter(new THREE.Vector3()), size = riverBounds.getSize(new THREE.Vector3());
  const radiusX = size.x / 2 + 49, radiusZ = size.z / 2 + 43;
  const baseY = riverBounds.min.y - 8;
  // Three long, broken spines form the landscape's silhouette. They are part of
  // the ground surface, not a scatter of cone-shaped mountains around the river.
  const ridges = [
    { x: -30, z: -54, angle: -.19, length: 43, width: 15, height: 26, phase: .7 },
    { x: 11, z: 53, angle: -.55, length: 40, width: 18, height: 27, phase: 2.4 },
    { x: -13, z: 115, angle: .32, length: 30, width: 14, height: 20, phase: 4.3 },
  ];
  function ridgeAt(x: number, z: number): number {
    let height = 0;
    for (const ridge of ridges) {
      const dx = x - ridge.x, dz = z - ridge.z, c = Math.cos(ridge.angle), s = Math.sin(ridge.angle);
      const along = dx * s + dz * c;
      const cross = dx * c - dz * s - Math.sin(along * .075 + ridge.phase) * 3.5;
      const taper = smooth(1 - Math.abs(along) / ridge.length);
      const crest = .76 + .15 * Math.sin(along * .24 + ridge.phase) + .09 * Math.sin(along * .53 - ridge.phase);
      const spine = Math.max(0, 1 - Math.abs(cross) / ridge.width) ** 1.35;
      // An angled shoulder breaks the symmetrical triangle and forms scree gullies.
      const shoulder = Math.max(0, 1 - Math.abs(cross + along * .31 - 5) / (ridge.width * .94)) ** 1.6;
      height = Math.max(height, ridge.height * taper * crest * Math.max(spine, shoulder * .57));
    }
    return height;
  }
  function boundaryValue(x: number, z: number): number {
    const nx = (x - center.x) / radiusX, nz = (z - center.z) / radiusZ;
    const angle = Math.atan2(nz, nx);
    const contour = 1 + .025 * Math.sin(angle * 5 + .3) + .015 * Math.cos(angle * 9);
    return Math.sqrt(nx * nx + nz * nz) / contour;
  }

  function groundAt(x: number, z: number): GroundSample {
    let closest = riverSamples[0], distanceSq = Infinity, weightedY = 0, weights = 0, protectedBed = Infinity;
    for (const sample of riverSamples) {
      const f = sample.frame, dx = x - f.x, dz = z - f.z;
      const lateral = clamp(dx * f.nx + dz * f.nz, sample.span.min, sample.span.max);
      const ex = dx - f.nx * lateral, ez = dz - f.nz * lateral;
      const d2 = ex * ex + ez * ez;
      if (d2 < distanceSq) { distanceSq = d2; closest = sample; }
      // Smooth across the space between reaches instead of a nearest-point Voronoi seam.
      if (d2 < 2500) {
        const weight = 1 / ((d2 + 70) * Math.sqrt(d2 + 70));
        weightedY += sample.span.y * weight; weights += weight;
      }
      // The clearance exceeds a grid-cell diagonal, so triangles cannot bridge a narrow waterway.
      if (d2 < 5.8) protectedBed = Math.min(protectedBed, sample.span.y - sample.span.depth - .35);
    }
    const distance = Math.sqrt(distanceSq), waterY = closest.span.y;
    const blendedY = weights ? weightedY / weights : waterY;
    const valleyY = THREE.MathUtils.lerp(waterY, blendedY, smooth(distance / 15));
    const terrace = smooth((distance - 2.4) / 6.5);
    const clearance = smooth((distance - 9) / 14);
    const ridge = ridgeAt(x, z) * clearance;
    const foothills = smooth((distance - 6) / 18) * (3.2 + 2.3 * noise(x * .65, z * .65));
    const scree = clearance * ridge / 18 * (.5 * Math.sin(x * .71 + z * .34) + .24 * Math.sin(z * 1.1 - x * .21));
    let height = valleyY - closest.span.depth - .5 + terrace * (closest.span.depth + 1.4 + noise(x, z) * .9) + foothills + ridge + scree;
    const boundary = boundaryValue(x, z);
    // A broad bevel slopes into the base; the outside edge is no longer a sheared cliff.
    height = THREE.MathUtils.lerp(height, baseY + .85, smooth((boundary - .76) / .24));
    height = Math.min(height, protectedBed);
    return { height, distance, waterY, s: closest.s, ridge };
  }
  const colorFor = (x: number, y: number, z: number, normalY: number, sample: GroundSample) => {
    const shade = noise(x, z);
    const rock = groundColors.rock.clone().lerp(groundColors.shadow, .1 + shade * .09);
    // Thin horizontal mineral bands remain coherent across cliff faces.
    const stratum = Math.pow(Math.max(0, Math.sin(y * .89 + Math.sin(z * .022) * .7)), 5);
    rock.lerp(groundColors.limestone, .12 + stratum * .48);
    const dryness = clamp(.17 + smooth(sample.distance / 27) * .65 + shade * .27);
    const green = groundColors.moss.clone().lerp(groundColors.grass, dryness);
    // High crests and steep faces expose warm grey stone; damp valley shoulders stay green.
    const bareRock = Math.max(smooth((.88 - normalY) / .5), smooth((sample.ridge - 6) / 10) * .95);
    const soilCover = smooth((sample.distance - 1.3) / 3.5) * (1 - bareRock);
    return rock.lerp(green, soilCover);
  };

  // A single irregular mountain mass supports every reach; the banks are not floating troughs.
  // The undulating outline extends beyond its nominal ellipse. Cover that full
  // envelope before clipping, otherwise the skirt can separate at the grid edge.
  const spacing = 1.65, extentX = radiusX * 1.05, extentZ = radiusZ * 1.05;
  const cols = Math.ceil(extentX * 2 / spacing), rows = Math.ceil(extentZ * 2 / spacing);
  const positions: number[] = [], indices: number[] = [], terrainSamples: GroundSample[] = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const x = center.x - extentX + col / cols * extentX * 2, z = center.z - extentZ + row / rows * extentZ * 2;
    const ground = groundAt(x, z); terrainSamples.push(ground); positions.push(x, ground.height, z);
  }
  const edgeVertices = new Map<string, number>();
  const outside = Array.from({ length: positions.length / 3 }, (_, i) => boundaryValue(positions[i * 3], positions[i * 3 + 2]) > 1);
  function clipEdge(a: number, b: number): number {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`, cached = edgeVertices.get(key);
    if (cached !== undefined) return cached;
    const insideId = outside[a] ? b : a, outsideId = outside[a] ? a : b;
    let low = 0, high = 1;
    const ax = positions[insideId * 3], az = positions[insideId * 3 + 2];
    const bx = positions[outsideId * 3], bz = positions[outsideId * 3 + 2];
    for (let iteration = 0; iteration < 15; iteration++) {
      const t = (low + high) / 2, x = THREE.MathUtils.lerp(ax, bx, t), z = THREE.MathUtils.lerp(az, bz, t);
      if (boundaryValue(x, z) <= 1) low = t; else high = t;
    }
    const x = THREE.MathUtils.lerp(ax, bx, low), z = THREE.MathUtils.lerp(az, bz, low), ground = groundAt(x, z);
    const id = positions.length / 3; positions.push(x, ground.height, z); terrainSamples.push(ground); edgeVertices.set(key, id); return id;
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = row * (cols + 1) + col, b = a + 1, c = a + cols + 1, d = c + 1;
    for (const triangle of [[a, c, b], [b, c, d]]) {
      const clipped: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        if (!outside[a]) clipped.push(a);
        if (outside[a] !== outside[b]) clipped.push(clipEdge(a, b));
      }
      for (let i = 1; i < clipped.length - 1; i++) indices.push(clipped[0], clipped[i], clipped[i + 1]);
    }
  }
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  terrainGeometry.setIndex(indices); terrainGeometry.computeVertexNormals();
  const normals = terrainGeometry.getAttribute('normal'), colors: number[] = [];
  terrainSamples.forEach((sample, i) => {
    const color = colorFor(positions[i * 3], sample.height, positions[i * 3 + 2], normals.getY(i), sample);
    colors.push(color.r, color.g, color.b);
  });
  terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addMesh(terrainGeometry, strataMaterial).name='valley-ground';

  function coloredGeometry(points: number[], triangles: number[], vertexColors: number[]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    geometry.setIndex(triangles); geometry.computeVertexNormals();
    return addMesh(geometry, strataMaterial);
  }

  // A restrained rock bevel finishes the smooth silhouette instead of exposing
  // the square grid's triangle teeth around the miniature's outside boundary.
  {
    const points: number[] = [], triangles: number[] = [], vertexColors: number[] = [];
    const rings = [ { radius: .992, y: baseY + .84 }, { radius: 1, y: baseY + .85 }, { radius: 1.004, y: baseY + .12 }, { radius: 1.001, y: baseY - .45 } ];
    const count = 320;
    for (let i = 0; i <= count; i++) {
      const angle = i / count * Math.PI * 2;
      const contour = 1 + .025 * Math.sin(angle * 5 + .3) + .015 * Math.cos(angle * 9);
      rings.forEach((ring, j) => {
        const x = center.x + Math.cos(angle) * radiusX * contour * ring.radius;
        const z = center.z + Math.sin(angle) * radiusZ * contour * ring.radius;
        points.push(x, ring.y, z);
        const color = groundColors.rock.clone().lerp(groundColors.shadow, .16 + j * .15);
        vertexColors.push(color.r, color.g, color.b);
        if (i < count && j < rings.length - 1) {
          const k = i * rings.length + j;
          triangles.push(k, k + rings.length, k + 1, k + 1, k + rings.length, k + rings.length + 1);
        }
      });
    }
    coloredGeometry(points, triangles, vertexColors);
  }

  // Sample the rendered grid triangle, not the analytic height alone. The apron
  // must meet the actual terrain in height, vertex colour and shading normal.
  const gridSample=(x:number,z:number)=>{
    const gx=(x-(center.x-extentX))/(extentX*2)*cols,gz=(z-(center.z-extentZ))/(extentZ*2)*rows;
    const col=Math.max(0,Math.min(cols-1,Math.floor(gx))),row=Math.max(0,Math.min(rows-1,Math.floor(gz)));
    const fx=clamp(gx-col),fz=clamp(gz-row),a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
    const ids=fx+fz<=1?[a,b,c]:[b,c,d],weights=fx+fz<=1?[1-fx-fz,fx,fz]:[1-fz,1-fx,fx+fz-1];
    let height=0;const color=new THREE.Color(0,0,0),normal=new THREE.Vector3();
    for(let i=0;i<3;i++){const id=ids[i],w=weights[i];height+=positions[id*3+1]*w;
      color.r+=colors[id*3]*w;color.g+=colors[id*3+1]*w;color.b+=colors[id*3+2]*w;
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals,id),w);}
    return {height,color,normal:normal.normalize()};
  };
  // Exact shore aprons bridge the conservative grid carving to each outside bank.
  // Only the outer envelope is used here: the gap between branch spans is built as an island below.
  for (const side of [-1, 1]) {
    const points: number[] = [], triangles: number[] = [], vertexColors: number[] = [];
    const apronNormals=new Map<number,THREE.Vector3>();
    const offsets = [0, 1.1, 2.3, 3.9, 6.4],stations=riverStations(0,COURSE_LENGTH),count=stations.length-1;
    for (let i = 0; i <= count; i++) {
      const s = stations[i], f = sampleCourse(s), spans = channelSpans(s);
      const span = spans[side < 0 ? 0 : spans.length - 1], bank = side < 0 ? span.min : span.max;
      offsets.forEach((offset, j) => {
        const lateral = bank + side * (j===0?bankShoulder(s).offset:offset), x = f.x + f.nx * lateral, z = f.z + f.nz * lateral;
        const ground = groundAt(x, z),grid=gridSample(x,z);
        const shore = span.y + .1 + Math.sin(s * .31 + side) * .12;
        const y = j === 0 ? span.y+bankShoulder(s).height : j === 1 ? shore + .16 : j === 2 ? shore + .36 : j === 3 ? THREE.MathUtils.lerp(shore + .35, grid.height, .55) : grid.height+.002;
        points.push(x, y, z);
        const color = j < 2 ? groundColors.limestone.clone().lerp(groundColors.rock, j * .28) : groundColors.grass.clone().lerp(groundColors.moss, .35 + noise(x, z) * .2);
        if(j>=3)color.lerp(grid.color,j===4?1:.65);
        if(j===4)apronNormals.set(points.length/3-1,grid.normal);
        vertexColors.push(color.r, color.g, color.b);
        if (i < count && j < offsets.length - 1) {
          const k = i * offsets.length + j;
          if (side > 0) triangles.push(k, k + offsets.length, k + 1, k + 1, k + offsets.length, k + offsets.length + 1);
          else triangles.push(k, k + 1, k + offsets.length, k + 1, k + offsets.length + 1, k + offsets.length);
        }
      });
    }
    const apron=coloredGeometry(points, triangles, vertexColors);apron.name=`shore-apron-${side}`;
    const apronNormal=apron.geometry.getAttribute('normal');
    for(const [i,n] of apronNormals)apronNormal.setXYZ(i,n.x,n.y,n.z);
  }

  const islandPlants: Array<{ x: number; y: number; z: number; scale: number }> = [];
  for (const fork of FORKS) {
    const points: number[] = [], triangles: number[] = [], vertexColors: number[] = [];
    const cross = [0, 0, .12, .34, .5, .66, .88, 1, 1], count = Math.ceil((fork.end - fork.start) / .8);
    for (let i = 0; i <= count; i++) {
      const s = fork.start + (fork.end - fork.start) * i / count;
      // At the exact merge channelSpans has returned to one reach; sample an infinitesimal step upstream.
      const spans = channelSpans(Math.min(s, fork.end - 1e-5)), f = sampleCourse(s);
      const left = spans[0], right = spans[1];
      if (!right) continue;
      const width = Math.max(0, right.min - left.max), fullness = smooth(width / 3.5);
      const top = Math.max(left.y, right.y) + .12 + fullness * (1.65 + Math.sin(s * .12) * .35);
      cross.forEach((t, j) => {
        const lateral = THREE.MathUtils.lerp(left.max, right.min, t);
        const x = f.x + f.nx * lateral, z = f.z + f.nz * lateral;
        let y = THREE.MathUtils.lerp(left.y, right.y, t) + .08;
        if (j === 0) y = left.y - left.depth - .4;
        else if (j === cross.length - 1) y = right.y - right.depth - .4;
        else y = THREE.MathUtils.lerp(y, top, Math.sin(t * Math.PI) ** .75);
        points.push(x, y, z);
        const c = j <= 1 || j >= cross.length - 2 ? groundColors.rock.clone().lerp(groundColors.limestone, .24 + .15 * Math.sin(y * 1.5)) : groundColors.moss.clone().lerp(groundColors.grass, .35 + .2 * Math.sin(s * .22));
        vertexColors.push(c.r, c.g, c.b);
        if (i < count && j < cross.length - 1) {
          const k = i * cross.length + j;
          triangles.push(k, k + cross.length, k + 1, k + 1, k + cross.length, k + cross.length + 1);
        }
      });
      if (i % 19 === 10 && width > 4.8) islandPlants.push({ x: f.x + f.nx * (left.max + right.min) / 2, y: top, z: f.z + f.nz * (left.max + right.min) / 2, scale: .58 });
    }
    coloredGeometry(points, triangles, vertexColors);
  }

  let randomState = 195762;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function instances(geometry: THREE.BufferGeometry, mat: THREE.Material, transforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotation?: number; tint?: THREE.Color }>) {
    if (!transforms.length) { geometry.dispose(); return; }
    geometries.add(geometry);
    const object = new THREE.InstancedMesh(geometry, mat, transforms.length);
    transforms.forEach((t, i) => {
      quaternion.setFromAxisAngle(up, t.rotation ?? 0);
      matrix.compose(new THREE.Vector3(t.x, t.y, t.z), quaternion, new THREE.Vector3(t.sx, t.sy, t.sz));
      object.setMatrixAt(i, matrix); if (t.tint) object.setColorAt(i, t.tint);
    });
    object.castShadow = true; object.receiveShadow = true; object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    group.add(object);
  }
  type Transform = { x: number; y: number; z: number; sx: number; sy: number; sz: number; rotation?: number; tint?: THREE.Color };
  const trunks: Transform[] = [], broadleaf: Transform[] = [], pines: Transform[] = [], shrubs: Transform[] = [], stones: Transform[] = [];
  const bark = material(0x79735e), leaves = material(0x5e805b), pineLeaves = material(0x355e49), stoneMaterial = material(0xaaa89b);
  function tree(x: number, y: number, z: number, scale: number, conifer: boolean) {
    const height = (conifer ? 4.5 : 3.3) * scale;
    trunks.push({ x, y: y + height * .35, z, sx: .11 * scale, sy: height * .7, sz: .11 * scale });
    if (conifer) {
      for (let tier = 0; tier < 3; tier++) {
        const width = (1.14 - tier * .24) * scale;
        pines.push({ x, y: y + height * .35 + tier * height * .18, z, sx: width, sy: height * .49, sz: width * .91, rotation: random() * Math.PI });
      }
    } else {
      for (let crown = 0; crown < 4; crown++) {
        const angle = crown * Math.PI * .5 + random() * .3, radius = crown === 3 ? .15 : .52;
        broadleaf.push({ x: x + Math.cos(angle) * radius * scale, y: y + height * (.64 + (crown === 3 ? .2 : random() * .08)), z: z + Math.sin(angle) * radius * scale, sx: 1.15 * scale, sy: .97 * scale, sz: .94 * scale, rotation: random() * Math.PI, tint: new THREE.Color().setScalar(.9 + random() * .2) });
      }
    }
  }
  // Groves have deliberately separated clearings; the close camera never looks through a tree wall.
  const groves = [{ s: 16, side: -1 }, { s: 74, side: 1 }, { s: 130, side: -1 }, { s: 213, side: -1 }, { s: 280, side: 1 }, { s: 330, side: -1 }];
  for (const grove of groves) for (let n = 0; n < 8; n++) {
    const s = clamp(grove.s + (random() - .5) * 24, 2, COURSE_LENGTH - 2), f = sampleCourse(s), spans = channelSpans(s);
    const outer = grove.side < 0 ? spans[0].min : spans[spans.length - 1].max;
    const lateral = outer + grove.side * (7.5 + random() * 12);
    const x = f.x + f.nx * lateral, z = f.z + f.nz * lateral, ground = groundAt(x, z);
    if (ground.distance < 6.5 || ground.height < ground.waterY - 1) continue;
    tree(x, ground.height, z, .7 + random() * .35, n % 3 === 0);
  }
  // The forest follows two foothill contours, leaving rocky crests and river bends open.
  for (const [ridgeIndex, side] of [[0, 1], [1, -1], [2, -1]]) {
    const ridge = ridges[ridgeIndex];
    const c = Math.cos(ridge.angle), s = Math.sin(ridge.angle);
    for (let i = 0; i < 17; i++) {
      const along = (i / 16 - .5) * ridge.length * 1.4 + (random() - .5) * 4;
      const cross = side * (ridge.width * .72 + random() * 3.6);
      const x = ridge.x + cross * c + along * s, z = ridge.z - cross * s + along * c;
      const ground = groundAt(x, z);
      if (ground.distance < 14 || ground.ridge > 13 || boundaryValue(x, z) > .83) continue;
      tree(x, ground.height, z, 1.0 + random() * .48, true);
    }
    // Angular scree sits at the bare foot of the opposite face, in compact patches.
    for (let i = 0; i < 24; i++) {
      const along = (random() - .5) * ridge.length * 1.2, cross = -side * (ridge.width * (.55 + random() * .55));
      const x = ridge.x + cross * c + along * s, z = ridge.z - cross * s + along * c, ground = groundAt(x, z);
      if (ground.distance < 13 || boundaryValue(x, z) > .84) continue;
      const scale = .55 + random() * 1.5;
      stones.push({ x, y: ground.height + scale * .2, z, sx: scale * 1.6, sy: scale * .65, sz: scale, rotation: random() * Math.PI, tint: new THREE.Color().setScalar(.84 + random() * .2) });
    }
  }
  islandPlants.forEach(p => tree(p.x, p.y, p.z, p.scale, false));
  for (let i = 0; i < 125; i++) {
    const s = 5 + random() * (COURSE_LENGTH - 10), f = sampleCourse(s), spans = channelSpans(s), side = random() < .5 ? -1 : 1;
    const outer = side < 0 ? spans[0].min : spans[spans.length - 1].max;
    const lateral = outer + side * (3.8 + random() * 13), x = f.x + f.nx * lateral, z = f.z + f.nz * lateral, ground = groundAt(x, z);
    if (ground.distance < 3.3) continue;
    const scale = .4 + random() * .85;
    if (i % 3 === 0) shrubs.push({ x, y: ground.height + .25, z, sx: scale, sy: scale * .65, sz: scale * .85, rotation: random() * Math.PI });
    else stones.push({ x, y: ground.height + scale * .25, z, sx: scale * 1.6, sy: scale * .75, sz: scale, rotation: random() * Math.PI, tint: new THREE.Color().setScalar(.88 + random() * .2) });
  }
  instances(new THREE.CylinderGeometry(1, 1.25, 1, 5), bark, trunks);
  instances(new THREE.IcosahedronGeometry(1, 1), leaves, broadleaf);
  instances(new THREE.ConeGeometry(1, 1, 7), pineLeaves, pines);
  instances(new THREE.IcosahedronGeometry(1, 0), leaves, shrubs);
  instances(new THREE.DodecahedronGeometry(1, 0), stoneMaterial, stones);

  const bounds = new THREE.Box3().setFromObject(group);
  return {
    bounds,
    dispose() {
      group.removeFromParent();
      group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(mat => mat.dispose());
    },
  };
}
