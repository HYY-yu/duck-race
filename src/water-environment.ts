import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { COURSE_LENGTH, sampleCourse } from './course';

/**
 * Capture the actual canyon and an analytic sky once, before the river is added.
 * This is a static radiance probe, not SSR: it supplies coherent mountain/sky
 * reflections without pretending a curved, descending river is one mirror plane.
 * The probe has no local parallax and deliberately excludes moving race objects.
 * Its texture belongs to this helper; water materials only borrow the reference.
 */
export function createWaterEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const started = performance.now();
  const frame = sampleCourse(COURSE_LENGTH * .5);
  const position = new THREE.Vector3(frame.x, frame.y + 4.5, frame.z);
  const sky = new Sky();
  sky.name = 'river-static-environment-sky';
  sky.position.copy(position);
  sky.scale.setScalar(1200);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 3.2;
  uniforms.rayleigh.value = 1.7;
  uniforms.mieCoefficient.value = .004;
  uniforms.mieDirectionalG.value = .78;
  const sun = scene.children.find(object => object instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
  const sunDirection = sun
    ? sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3())).normalize()
    : new THREE.Vector3(-55, 120, 65).normalize();
  uniforms.sunPosition.value.copy(sunDirection);

  // Calling before createRiverWater is the normal path. These exclusions also
  // prevent feedback/extra transmission targets if construction is reordered.
  const hidden: Array<{ object: THREE.Object3D; visible: boolean }> = [];
  scene.traverse(object => {
    if (object.name === 'river-water' || object instanceof THREE.Sprite || object.userData.duckId !== undefined) {
      hidden.push({ object, visible: object.visible });
      object.visible = false;
    }
  });
  const generator = new THREE.PMREMGenerator(renderer);
  const previous = {
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    shadowNeedsUpdate: renderer.shadowMap.needsUpdate,
    target: renderer.getRenderTarget(),
    cubeFace: renderer.getActiveCubeFace(),
    mipLevel: renderer.getActiveMipmapLevel(),
    autoClear: renderer.autoClear,
    toneMapping: renderer.toneMapping,
    xrEnabled: renderer.xr.enabled,
    background: scene.background,
  };
  let target: THREE.WebGLRenderTarget | undefined;
  try {
    scene.add(sky);
    // Six views share one shadow map. Restore normal updates before ducks appear.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    target = generator.fromScene(scene, 0, .1, 600, { size: 256, position });
    target.texture.name = 'river-canyon-sky-pmrem';
  } finally {
    scene.remove(sky);
    sky.geometry.dispose();
    sky.material.dispose();
    generator.dispose();
    hidden.forEach(({ object, visible }) => { object.visible = visible; });
    renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = previous.shadowNeedsUpdate;
    renderer.autoClear = previous.autoClear;
    renderer.toneMapping = previous.toneMapping;
    renderer.xr.enabled = previous.xrEnabled;
    scene.background = previous.background;
    renderer.setRenderTarget(previous.target, previous.cubeFace, previous.mipLevel);
  }
  // Failures propagate to scene initialization's visible error/reporting path.
  // TODO(observability): forward capture duration/resolution to the renderer span.
  console.info('[duck-circuit]', 'water_environment_ready', {
    method: 'static-pmrem', resolution: 256, capture_ms: Math.round(performance.now() - started),
  });
  const environment = target;
  let disposed = false;
  return {
    texture: environment.texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Retained PMREM output is separate from the generator's temporary targets.
      environment.dispose();
    },
  };
}
