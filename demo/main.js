import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import {
  buildInstallation,
  DEFAULT_GLASS,
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_SHADOW_SATURATION,
  DEFAULT_PANEL_DEPTH,
  updateSpotlightCookies,
  updateCookieSaturation,
  updateShadowTints
} from '../src/index.js';
import { installationData } from './data.js';

// Top-level demo config — tweak here to change behavior.
const config = {
  ambientIntensity: 0.12,
  shadowSaturation: 3.5,
  shadowTintIntensity: 0.17,
  panelDepth: DEFAULT_PANEL_DEPTH
};

const container = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xe8e6df);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.63;

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(7, 4, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.4, 0);

const { lights, floor, panels, shadowTints, cookieScenes, cookieTargets, cookieMaterials, cookieMeshes } =
  buildInstallation(scene, installationData, {
    ambientIntensity: config.ambientIntensity,
    shadowSaturation: config.shadowSaturation,
    panelDepth: config.panelDepth
  });
shadowTints.forEach((m) => { m.userData.baseIntensity = config.shadowTintIntensity; });

const gui = new GUI({ title: 'Dichroic Controls' });

const sceneFolder = gui.addFolder('Scene');
sceneFolder.add(renderer, 'toneMappingExposure', 0, 2, 0.01).name('exposure');
sceneFolder.add(scene, 'environmentIntensity', 0, 2, 0.01).name('env IBL');
if (lights.ambient) {
  sceneFolder.add(lights.ambient, 'intensity', 0, 2, 0.01).name('ambient');
}
sceneFolder.add(config, 'shadowSaturation', 0, 5, 0.05)
  .name('shadow saturation')
  .onChange((v) => updateCookieSaturation(cookieMaterials, v));
if (floor) {
  sceneFolder.add(floor.material, 'envMapIntensity', 0, 2, 0.01).name('floor IBL');
  sceneFolder.addColor({ color: floor.material.color.getHex() }, 'color')
    .name('floor color')
    .onChange((v) => floor.material.color.setHex(v));
}

const lightFolder = gui.addFolder('Colored Lights');
lights.directional.forEach((light, i) => {
  const f = lightFolder.addFolder(`Light ${i + 1}`);
  f.addColor({ color: light.color.getHex() }, 'color')
    .name('color')
    .onChange((v) => light.color.setHex(v));
  f.add(light, 'intensity', 0, 8, 0.05).name('intensity');
  f.add(light.position, 'x', -20, 20, 0.1).name('x');
  f.add(light.position, 'y', 0.2, 12, 0.1).name('y (height)');
  f.add(light.position, 'z', -20, 20, 0.1).name('z');
  f.add(light.shadow, 'radius', 0, 30, 0.5).name('penumbra');
});

const glassFolder = gui.addFolder('Glass Panels');
const glassParams = { ...DEFAULT_GLASS };
const applyToAll = (key, value) => {
  panels.forEach(({ glassMesh }) => {
    glassMesh.material[key] = value;
  });
};
glassFolder.add(glassParams, 'transmission', 0, 1, 0.01).onChange((v) => applyToAll('transmission', v));
glassFolder.add(glassParams, 'thickness', 0, 1, 0.01).onChange((v) => applyToAll('thickness', v));
glassFolder.add(glassParams, 'ior', 1, 2.5, 0.01).onChange((v) => applyToAll('ior', v));
glassFolder.add(glassParams, 'dispersion', 0, 3, 0.01).onChange((v) => applyToAll('dispersion', v));
glassFolder.add(glassParams, 'iridescence', 0, 1, 0.01).onChange((v) => applyToAll('iridescence', v));
glassFolder.add(glassParams, 'iridescenceIOR', 1, 2.5, 0.01).onChange((v) => applyToAll('iridescenceIOR', v));
glassFolder.add(glassParams, 'attenuationDistance', 0.05, 5, 0.05).onChange((v) => applyToAll('attenuationDistance', v));
glassFolder.add(glassParams, 'clearcoat', 0, 1, 0.01).onChange((v) => applyToAll('clearcoat', v));
glassFolder.add(glassParams, 'roughness', 0, 1, 0.01).onChange((v) => applyToAll('roughness', v));

const geoParams = { panelDepth: config.panelDepth };
function rebuildGeometry(mesh, newDepth) {
  const { width, height } = mesh.geometry.parameters;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(width, height, newDepth);
}
glassFolder.add(geoParams, 'panelDepth', 0.01, 0.5, 0.01)
  .name('panel depth (geometry)')
  .onChange((v) => {
    panels.forEach(({ glassMesh }) => rebuildGeometry(glassMesh, v));
    cookieMeshes.forEach((m) => rebuildGeometry(m, v));
  });

const tintFolder = gui.addFolder('Shadow Tints (per-panel color)');
const tintParams = {
  intensity: config.shadowTintIntensity,
  softness: 0.45,
  falloff: 2.0
};
const setTintUniform = (name, value) => {
  shadowTints.forEach((m) => { m.material.uniforms[name].value = value; });
};
tintFolder.add(tintParams, 'intensity', 0, 2, 0.01)
  .name('intensity (× light)')
  .onChange((v) => { shadowTints.forEach((m) => { m.userData.baseIntensity = v; }); });
tintFolder.add(tintParams, 'softness', 0, 1, 0.01)
  .onChange((v) => setTintUniform('uSoftness', v));
tintFolder.add(tintParams, 'falloff', 0.2, 4, 0.05)
  .onChange((v) => setTintUniform('uFalloff', v));

const shadowFolder = gui.addFolder('Shadows');
const shadowParams = {
  enabled: renderer.shadowMap.enabled,
  type: renderer.shadowMap.type
};
const invalidateShadowMaps = () => {
  lights.directional.forEach((l) => {
    if (l.shadow.map) {
      l.shadow.map.dispose();
      l.shadow.map = null;
    }
  });
  renderer.shadowMap.needsUpdate = true;
};
shadowFolder.add(shadowParams, 'enabled')
  .name('enabled')
  .onChange((v) => {
    renderer.shadowMap.enabled = v;
    invalidateShadowMaps();
  });
shadowFolder.add(shadowParams, 'type', {
  'PCF Soft':  THREE.PCFSoftShadowMap,
  'PCF':       THREE.PCFShadowMap,
  'Basic':     THREE.BasicShadowMap,
  'VSM':       THREE.VSMShadowMap
})
  .name('type')
  .onChange((v) => {
    renderer.shadowMap.type = +v;
    invalidateShadowMaps();
  });
lights.directional.forEach((light, i) => {
  const f = shadowFolder.addFolder(`Light ${i + 1} bias`);
  f.add(light.shadow, 'bias', -0.01, 0.01, 0.0001).name('bias');
  f.add(light.shadow, 'normalBias', -0.2, 0.2, 0.001).name('normalBias');
  f.close();
});

const settingsFolder = gui.addFolder('Settings (Export / Import)');
const settingsActions = {
  copy: () => {
    const json = JSON.stringify(gui.save(), null, 2);
    navigator.clipboard.writeText(json).then(
      () => console.log('[dichroic] settings copied to clipboard:\n' + json),
      () => console.log('[dichroic] copy failed; here is the JSON:\n' + json)
    );
  },
  download: () => {
    const json = JSON.stringify(gui.save(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dichroic-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  },
  load: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          gui.load(JSON.parse(reader.result));
        } catch (err) {
          console.error('[dichroic] failed to load settings:', err);
          alert('Invalid settings file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
  logToConsole: () => {
    console.log('[dichroic] current settings:', gui.save());
  }
};
settingsFolder.add(settingsActions, 'copy').name('Copy JSON to clipboard');
settingsFolder.add(settingsActions, 'download').name('Download JSON file');
settingsFolder.add(settingsActions, 'load').name('Load JSON file…');
settingsFolder.add(settingsActions, 'logToConsole').name('Log to console');

glassFolder.close();
shadowFolder.close();
lightFolder.open();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (cookieScenes && cookieTargets) {
    updateSpotlightCookies(renderer, lights.directional, cookieScenes, cookieTargets);
  }
  if (shadowTints.length) {
    updateShadowTints(shadowTints);
  }

  renderer.render(scene, camera);
}

animate();
