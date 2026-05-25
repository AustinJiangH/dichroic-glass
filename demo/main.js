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
import { installationData, installationLights, activeLayout } from './data.js';

// Top-level demo config — tweak here to change behavior.
const config = {
  ambientIntensity: 0.12,
  shadowSaturation: 2.5,
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
    panelDepth: config.panelDepth,
    coloredLights: installationLights
  });
shadowTints.forEach((m) => { m.userData.baseIntensity = config.shadowTintIntensity; });

// Pre-render the cookie textures once so they're populated, then force the
// renderer to compile all shaders with the full scene state (spotlights +
// their .map properties + floor receiving them). Without this, Vite's
// production bundle has a timing where the floor shader can compile before
// the renderer registers the spotlight maps, dropping the cookie sampling
// code entirely and leaving the floor unfiltered.
if (cookieScenes && cookieTargets) {
  updateSpotlightCookies(renderer, lights.directional, cookieScenes, cookieTargets);
}
renderer.compile(scene, camera);

// DEBUG: flat string logs so they're visible without expanding
lights.directional.forEach((l, i) => {
  console.log(`[dichroic-debug] light ${i}: isSpotLight=${l.isSpotLight} hasMap=${!!l.map} mapColorSpace="${l.map && l.map.colorSpace}" inScene=${!!l.parent} intensity=${l.intensity} angle=${l.angle.toFixed(3)}`);
});
console.log(`[dichroic-debug] floor isMeshStandardMaterial=${floor && floor.material && floor.material.isMeshStandardMaterial} receiveShadow=${floor && floor.receiveShadow}`);
console.log(`[dichroic-debug] floor envMapIntensity=${floor && floor.material && floor.material.envMapIntensity}`);
console.log(`[dichroic-debug] scene.environmentIntensity=${scene.environmentIntensity}`);

// After first render, inspect ALL programs to find the floor's
setTimeout(() => {
  const programs = renderer.info.programs || [];
  console.log(`[dichroic-debug] total programs:`, programs.length);
  programs.forEach((p, i) => {
    const k = p.cacheKey || '';
    console.log(`[dichroic-debug] program ${i} cacheKey head:`, k.slice(0, 60));
  });
  // The floor MeshStandardMaterial — search by program list including spotLightMap counts
  const floorProg = programs.find(p => p.cacheKey && p.cacheKey.startsWith('standard,'));
  if (floorProg) {
    console.log(`[dichroic-debug] FLOOR program cacheKey:`, floorProg.cacheKey);
  } else {
    console.log(`[dichroic-debug] No "standard," program found`);
  }
  // Cookie pixel sample
  cookieTargets.forEach((tgt, i) => {
    const buf = new Uint8Array(4);
    try {
      renderer.readRenderTargetPixels(tgt, 1024, 1024, 1, 1, buf);
      console.log(`[dichroic-debug] cookie ${i} center pixel: r=${buf[0]} g=${buf[1]} b=${buf[2]} a=${buf[3]}`);
    } catch (e) {
      console.log(`[dichroic-debug] cookie ${i} read failed:`, e.message);
    }
  });
}, 1500);

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
glassFolder.add(glassParams, 'opacity', 0, 1, 0.01).onChange((v) => applyToAll('opacity', v));

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

// ---------- Floating bottom-left controls (layout + play) ----------
const floatStyle = document.createElement('style');
floatStyle.textContent = `
  .dichroic-floating {
    position: fixed; bottom: 20px; left: 20px;
    display: flex; gap: 10px; align-items: center;
    z-index: 1000;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .dichroic-floating select, .dichroic-floating button {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 13px;
    cursor: pointer;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    color: #222;
  }
  .dichroic-floating select { font-weight: 500; }
  .dichroic-floating button.playing {
    background: rgba(40, 120, 220, 0.9);
    color: white;
    border-color: rgba(40, 120, 220, 1);
  }
`;
document.head.appendChild(floatStyle);

const floatContainer = document.createElement('div');
floatContainer.className = 'dichroic-floating';

const layoutSelect = document.createElement('select');
[
  ['stonehenge', 'Stone Henge'],
  ['interweave', 'InterWeave'],
  ['turbo',      'Turbo']
].forEach(([value, label]) => {
  const opt = document.createElement('option');
  opt.value = value; opt.textContent = label;
  if (value === activeLayout) opt.selected = true;
  layoutSelect.appendChild(opt);
});
layoutSelect.addEventListener('change', () => {
  localStorage.setItem('dichroic.layout', layoutSelect.value);
  location.reload();
});

const playBtn = document.createElement('button');
playBtn.textContent = '▶ Play';
const playState = { playing: false };
playBtn.addEventListener('click', () => {
  playState.playing = !playState.playing;
  playBtn.textContent = playState.playing ? '⏸ Pause' : '▶ Play';
  playBtn.classList.toggle('playing', playState.playing);
  controls.enabled = !playState.playing;
  if (playState.playing) {
    playState.startTime = clock.getElapsedTime();
    playState.startAzimuth = Math.atan2(camera.position.z, camera.position.x);
    playState.startRadius = Math.hypot(camera.position.x, camera.position.z, camera.position.y);
  }
});

floatContainer.appendChild(layoutSelect);
floatContainer.appendChild(playBtn);
document.body.appendChild(floatContainer);

// ---------- Animation state ----------
const clock = new THREE.Clock();
const lightBaselines = lights.directional.map((l) => ({
  pos: l.position.clone(),
  intensity: l.intensity,
  phase: Math.random() * Math.PI * 2
}));
const cameraRadius = camera.position.length();

function animate() {
  requestAnimationFrame(animate);

  if (playState.playing) {
    const t = clock.getElapsedTime() - playState.startTime;

    // Camera: rotate azimuth + smoothly climb elevation 30° → 90°.
    // Smoothstep over 25s, then hold at the top.
    const azimuth = playState.startAzimuth + t * 0.25;
    const rampT = Math.min(1, t / 25);
    const elevNorm = rampT * rampT * (3 - 2 * rampT);   // smoothstep
    const elev = THREE.MathUtils.lerp(
      Math.PI / 6,   // 30° above horizon — low side angle
      Math.PI / 2,   // 90° — straight overhead, top-down
      elevNorm
    );
    const r = playState.startRadius;
    camera.position.set(
      r * Math.cos(elev) * Math.cos(azimuth),
      r * Math.sin(elev),
      r * Math.cos(elev) * Math.sin(azimuth)
    );
    camera.lookAt(controls.target);

    // Lights: wobble position + intensity within range
    lights.directional.forEach((light, i) => {
      const base = lightBaselines[i];
      const wob1 = Math.sin(t * 0.35 + base.phase) * 1.5;
      const wob2 = Math.cos(t * 0.52 + base.phase * 1.3) * 1.5;
      const wob3 = Math.sin(t * 0.41 + base.phase * 0.7) * 0.6;
      light.position.set(
        base.pos.x + wob1,
        Math.max(0.5, base.pos.y + wob3),
        base.pos.z + wob2
      );
      light.intensity = base.intensity * (0.65 + 0.4 * Math.sin(t * 0.6 + base.phase));
    });
  } else {
    controls.update();
  }

  if (cookieScenes && cookieTargets) {
    updateSpotlightCookies(renderer, lights.directional, cookieScenes, cookieTargets);
  }
  if (shadowTints.length) {
    updateShadowTints(shadowTints);
  }

  renderer.render(scene, camera);
}

animate();
