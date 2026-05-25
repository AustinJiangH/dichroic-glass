import * as THREE from 'three';
import { shadowTintVertexShader, shadowTintFragmentShader } from './shaders.js';
import {
  createCookieScene,
  createCookieTargets,
  DEFAULT_SHADOW_SATURATION
} from './spotlightCookie.js';

export const DEFAULT_AMBIENT_INTENSITY = 0.2;

// Each light's color must have all three channels non-zero, otherwise the
// per-panel transmission multiply can only attenuate one channel (no hue
// shift). Saturated-but-not-pure tints give each light room to be filtered
// into a different hue by every panel.
const DEFAULT_COLORED_LIGHTS = [
  { position: [  3.8, 5.4,   5.9 ], color: 0xffbfbf, intensity: 1.5, penumbra: 8.5, bias: -0.0001, normalBias: 0.02 },
  { position: [ -6.5, 7.4,  11.26], color: 0xbfffbf, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
  { position: [ -6.5, 8.8, -11.7 ], color: 0xbfbfff, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 }
];

const GEOMETRY_THICKNESS = 0.06;

export const DEFAULT_GLASS = {
  transmission: 1.0,
  thickness: 0.08,
  ior: 1.39,
  dispersion: 1.17,
  iridescence: 0.4,
  iridescenceIOR: 1.49,
  attenuationDistance: 3.0,
  clearcoat: 0.5,
  roughness: 0.2
};

export function createGlassMaterial(panel) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(panel.colors.reflection),
    metalness: 0.0,
    roughness: DEFAULT_GLASS.roughness,
    transmission: DEFAULT_GLASS.transmission,
    thickness: DEFAULT_GLASS.thickness,
    ior: DEFAULT_GLASS.ior,
    dispersion: DEFAULT_GLASS.dispersion,
    iridescence: DEFAULT_GLASS.iridescence,
    iridescenceIOR: DEFAULT_GLASS.iridescenceIOR,
    iridescenceThicknessRange: [200, 900],
    attenuationColor: new THREE.Color(panel.colors.transmission),
    attenuationDistance: DEFAULT_GLASS.attenuationDistance,
    clearcoat: DEFAULT_GLASS.clearcoat,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide
  });
}

export function createPanelShadowTint(panel, lightPos, options = {}) {
  const { intensity = 0.55, softness = 0.45, falloff = 2.0 } = options;

  const panelBase = new THREE.Vector3(panel.position.x, 0, panel.position.z);
  const panelCenter = new THREE.Vector3(panel.position.x, panel.position.y, panel.position.z);

  const dir = new THREE.Vector3().subVectors(panelCenter, lightPos);
  if (Math.abs(dir.y) < 1e-4) return null;
  const t = -lightPos.y / dir.y;
  if (t <= 0) return null;
  const shadowTip = new THREE.Vector3(
    lightPos.x + dir.x * t,
    0,
    lightPos.z + dir.z * t
  );

  const lengthVec = new THREE.Vector3().subVectors(shadowTip, panelBase);
  lengthVec.y = 0;
  const shadowLength = Math.max(lengthVec.length(), 0.001);
  const angle = Math.atan2(lengthVec.z, lengthVec.x);

  const midpoint = new THREE.Vector3().lerpVectors(panelBase, shadowTip, 0.5);
  midpoint.y = 0.005;

  const widthSpread = panel.width * (1 + shadowLength / panelCenter.distanceTo(lightPos) * 0.5);

  const geo = new THREE.PlaneGeometry(shadowLength, widthSpread);
  const uniforms = {
    uTransmissionColor: { value: new THREE.Color(panel.colors.transmission) },
    uEdgeShiftColor:    { value: new THREE.Color(panel.colors.edgeShift) },
    uIntensity:         { value: intensity },
    uSoftness:          { value: softness },
    uFalloff:           { value: falloff }
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: shadowTintVertexShader,
    fragmentShader: shadowTintFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(midpoint);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = angle;
  mesh.renderOrder = 1;
  return mesh;
}

export function buildPanel(panel) {
  const group = new THREE.Group();
  group.name = panel.id;

  const thickness = panel.thickness ?? GEOMETRY_THICKNESS;
  const glassGeo = new THREE.BoxGeometry(panel.width, panel.height, thickness);
  const glassMat = createGlassMaterial(panel);
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(panel.position.x, panel.position.y, panel.position.z);

  if (panel.lookAtCenter) {
    glassMesh.lookAt(0, panel.position.y, 0);
  } else if (panel.rotation) {
    glassMesh.rotation.set(panel.rotation.x, panel.rotation.y, panel.rotation.z);
  }
  glassMesh.name = `${panel.id}_glass`;
  // SpotLight cookies handle the floor's colored shadow projection.
  // Real shadow casting would zero out the light wherever a panel sits, masking
  // the cookie's per-panel transmission tint — so we disable it here.
  glassMesh.castShadow = false;
  glassMesh.receiveShadow = false;

  group.add(glassMesh);
  return { group, glassMesh };
}

function addColoredLight(parent, cfg /* shadowExtent unused for SpotLight */) {
  const light = new THREE.SpotLight(
    cfg.color,
    cfg.intensity,
    0,
    cfg.angle ?? Math.PI / 3.2,
    cfg.coneSoftness ?? 0.4,
    0
  );
  light.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
  light.target.position.set(0, 0, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 40;
  light.shadow.focus = 1;
  light.shadow.radius = cfg.penumbra ?? 8;
  light.shadow.bias = cfg.bias ?? -0.0005;
  light.shadow.normalBias = cfg.normalBias ?? 0.04;
  parent.add(light);
  parent.add(light.target);
  return light;
}

export function buildInstallation(scene, panels, options = {}) {
  const {
    addLights = true,
    addFloor = true,
    floorSize = 30,
    floorColor = 0xffffff,
    coloredLights = DEFAULT_COLORED_LIGHTS,
    ambientIntensity = DEFAULT_AMBIENT_INTENSITY,
    shadowSaturation = DEFAULT_SHADOW_SATURATION,
    shadowExtent = 14
  } = options;

  const installation = new THREE.Group();
  installation.name = 'dichroicInstallation';

  const directionalLights = [];
  let ambientLight = null;
  if (addLights) {
    coloredLights.forEach((cfg) => {
      directionalLights.push(addColoredLight(installation, cfg, shadowExtent));
    });
    ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    installation.add(ambientLight);
  }

  let floorMesh = null;
  if (addFloor) {
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0
    });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    floorMesh.name = 'galleryFloor';
    installation.add(floorMesh);
  }

  const shadowTints = [];
  const built = panels.map((panel) => {
    const result = buildPanel(panel);
    installation.add(result.group);

    result.tints = [];
    coloredLights.forEach((cfg) => {
      const lightPos = new THREE.Vector3(cfg.position[0], cfg.position[1], cfg.position[2]);
      const tint = createPanelShadowTint(panel, lightPos);
      if (tint) {
        installation.add(tint);
        result.tints.push(tint);
        shadowTints.push(tint);
      }
    });

    return result;
  });

  const cookieTargets = createCookieTargets(directionalLights.length);
  // One cookie scene shared by all lights — Three.js multiplies the sampled
  // map RGB into directLight.color itself, so we don't premultiply by lightColor.
  const sharedCookie = createCookieScene(panels, shadowSaturation);
  const cookieScenes = directionalLights.map(() => sharedCookie.scene);
  const cookieMaterials = sharedCookie.materials;
  directionalLights.forEach((light, i) => {
    light.map = cookieTargets[i].texture;
  });

  scene.add(installation);
  return {
    installation,
    panels: built,
    lights: { directional: directionalLights, ambient: ambientLight },
    floor: floorMesh,
    shadowTints,
    cookieScenes,
    cookieTargets,
    cookieMaterials
  };
}
