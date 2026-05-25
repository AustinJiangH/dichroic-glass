import * as THREE from 'three';

const DEFAULT_COLORED_LIGHTS = [
  { position: [  3.8, 5.4,   5.9 ], color: 0xff0000, intensity: 4.95, penumbra: 8.5, bias: -0.0017, normalBias: 0.04 },
  { position: [ -6.5, 7.4,  11.26], color: 0x00ff00, intensity: 5.5,  penumbra: 8.0, bias: -0.0052, normalBias: 0.20 },
  { position: [ -6.5, 8.8, -11.7 ], color: 0x0000ff, intensity: 4.95, penumbra: 8.0, bias: -0.0005, normalBias: 0.04 }
];

const GEOMETRY_THICKNESS = 0.06;

export const DEFAULT_GLASS = {
  transmission: 0.43,
  thickness: 0.33,
  ior: 2.18,
  dispersion: 1.78,
  iridescence: 0.61,
  iridescenceIOR: 1.62,
  attenuationDistance: 0.4,
  clearcoat: 0.08,
  roughness: 0.43
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

export function buildPanel(panel) {
  const group = new THREE.Group();
  group.name = panel.id;

  const thickness = panel.thickness ?? DEFAULT_THICKNESS;
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
  glassMesh.castShadow = true;
  glassMesh.receiveShadow = true;
  glassMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide
  });

  group.add(glassMesh);
  return { group, glassMesh };
}

function addColoredLight(parent, cfg, shadowExtent) {
  const light = new THREE.DirectionalLight(cfg.color, cfg.intensity);
  light.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
  light.target.position.set(0, 0, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = -shadowExtent;
  light.shadow.camera.right = shadowExtent;
  light.shadow.camera.top = shadowExtent;
  light.shadow.camera.bottom = -shadowExtent;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 40;
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
    ambientIntensity = 0.48,
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

  const built = panels.map((panel) => {
    const result = buildPanel(panel);
    installation.add(result.group);
    return result;
  });

  scene.add(installation);
  return {
    installation,
    panels: built,
    lights: { directional: directionalLights, ambient: ambientLight },
    floor: floorMesh
  };
}
