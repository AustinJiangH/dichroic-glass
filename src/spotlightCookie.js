import * as THREE from 'three';

const DEFAULT_PANEL_DEPTH = 0.06;

export const DEFAULT_SHADOW_SATURATION = 1.0;

function saturateFromWhite(color, saturation) {
  // Push each channel away from 1.0 (white) by `saturation` times.
  // saturation = 1 → original color; saturation > 1 → more saturated (clamped at 0).
  return {
    r: Math.max(0, Math.min(1, (color.r - 1) * saturation + 1)),
    g: Math.max(0, Math.min(1, (color.g - 1) * saturation + 1)),
    b: Math.max(0, Math.min(1, (color.b - 1) * saturation + 1))
  };
}

export function createCookieScene(panels, saturation = DEFAULT_SHADOW_SATURATION, defaultDepth = DEFAULT_PANEL_DEPTH) {
  // Three.js applies the cookie as: directLight.color *= spotColor.rgb (inside cone).
  // So the cookie holds panel transmission colors over a WHITE background:
  //   - panel pixel  → light.color *= panel.transmission   (filtered)
  //   - background   → light.color *= white                (unchanged)
  // shadowSaturation pulls panel colors further from white for stronger tints.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const materials = [];
  const meshes = [];
  panels.forEach((panel) => {
    const depth = panel.depth ?? defaultDepth;
    const geo = new THREE.BoxGeometry(panel.width, panel.height, depth);

    const baseTransmission = new THREE.Color(panel.colors.transmission);
    const sat = saturateFromWhite(baseTransmission, saturation);

    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(sat.r, sat.g, sat.b),
      side: THREE.DoubleSide,
      toneMapped: false
    });
    mat.userData = { baseTransmission };
    materials.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { panel };
    mesh.position.set(panel.position.x, panel.position.y, panel.position.z);
    if (panel.lookAtCenter) {
      mesh.lookAt(0, panel.position.y, 0);
    } else if (panel.rotation) {
      mesh.rotation.set(
        panel.rotation.x,
        panel.rotation.y,
        panel.rotation.z,
        panel.rotation.order || 'XYZ'
      );
    }
    scene.add(mesh);
    meshes.push(mesh);
  });

  scene.updateMatrixWorld(true);
  return { scene, materials, meshes };
}

export function updateCookieSaturation(materials, saturation) {
  materials.forEach((mat) => {
    const t = mat.userData.baseTransmission;
    const sat = saturateFromWhite(t, saturation);
    mat.color.setRGB(sat.r, sat.g, sat.b);
  });
}

export function createCookieTargets(count, resolution = 2048, samples = 4) {
  return Array.from({ length: count }, () => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      samples
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.anisotropy = 8;
    return target;
  });
}

const _prevClearColor = new THREE.Color();

export function updateSpotlightCookies(renderer, lights, cookieScenes, cookieTargets) {
  const prevRT = renderer.getRenderTarget();
  const prevToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;

  lights.forEach((light, i) => {
    light.updateMatrixWorld(true);
    light.target.updateMatrixWorld(true);
    light.shadow.updateMatrices(light);
    light.shadow.camera.updateMatrixWorld(true);

    renderer.setRenderTarget(cookieTargets[i]);
    renderer.render(cookieScenes[i], light.shadow.camera);
  });

  renderer.setRenderTarget(prevRT);
  renderer.toneMapping = prevToneMapping;
}
