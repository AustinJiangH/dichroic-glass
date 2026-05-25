// Layout config — change `mode` to switch installation styles.
const SQRT2_HALF = Math.SQRT2 / 2; // for 45° offsets

// Light, pastel palette — sky-blue / peach / cream tones. Saturated enough
// to keep per-panel hue legible after lightColor × transmission multiplication.
const palette = [
  { reflection: '#ffd6e8', transmission: '#d4f8ec', edgeShift: '#fff8d4' },
  { reflection: '#d0e0ff', transmission: '#ffe0c8', edgeShift: '#dcffdc' },
  { reflection: '#e4d0ff', transmission: '#fffad0', edgeShift: '#d4fff4' },
  { reflection: '#ffd6c8', transmission: '#c8dcff', edgeShift: '#fffad4' },
  { reflection: '#d0f0e0', transmission: '#ffd0e0', edgeShift: '#e0d0ff' },
  { reflection: '#ffe8c8', transmission: '#c8e4ff', edgeShift: '#ffd6e8' }
];

export const layoutConfig = {
  mode: 'stonehenge',         // 'stonehenge' | 'interweave' | 'turbo'

  stonehenge: {
    rings: [
      { radius: 1.6, count: 6,  size: 0.55 },
      { radius: 3.0, count: 12, size: 0.7  },
      { radius: 4.5, count: 18, size: 0.85 }
    ],
    lights: [
      { position: [  3.8, 5.4,   5.9 ], color: 0xffbfbf, intensity: 1.5, penumbra: 8.5, bias: -0.0001, normalBias: 0.02 },
      { position: [ -6.5, 7.4,  11.26], color: 0xbfffbf, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [ -6.5, 5.0, -11.7 ], color: 0xbfbfff, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 }
    ]
  },

  interweave: {
    rows: 15,
    cols: 15,
    spacing: 0.55,
    panelWidth: 0.4,
    panelHeight: 0.4,
    lights: [
      { position: [  10 * SQRT2_HALF, 5.5,  10 * SQRT2_HALF], color: 0xffbfbf, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [ -10 * SQRT2_HALF, 5.5,  10 * SQRT2_HALF], color: 0xbfffbf, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [ -10 * SQRT2_HALF, 5.5, -10 * SQRT2_HALF], color: 0xbfbfff, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [  10 * SQRT2_HALF, 5.5, -10 * SQRT2_HALF], color: 0xffd0ff, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 }
    ]
  },

  // Turbo — 5 concentric layers of vertical panels aligned with rays from
  // the center. Each layer has one color and an alternating ±tilt around
  // its own radial axis, like staged turbine blades.
  turbo: {
    layerCount: 5,
    baseRadius: 1.8,
    layerSpacing: 1.1,
    panelSpacing: 1.25,
    panelWidth: 0.32,
    panelHeight: 1.0,
    tiltDeg: 15,
    layerColors: [palette[0], palette[1], palette[2], palette[3], palette[4]],
    lights: [
      // Three lights, asymmetric placement so the tilted blades catch the
      // light unevenly and shadows aren't symmetric across the rings.
      { position: [  9.0, 6.0,   3.5 ], color: 0xffbfbf, intensity: 1.7, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [ -2.5, 4.5,  11.0 ], color: 0xbfffbf, intensity: 1.5, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 },
      { position: [ -8.5, 5.5,  -6.5 ], color: 0xbfbfff, intensity: 1.3, penumbra: 8.0, bias: -0.0001, normalBias: 0.02 }
    ]
  }
};

function buildStonehenge(cfg) {
  let id = 0;
  return cfg.rings.flatMap((ring, ringIdx) =>
    Array.from({ length: ring.count }, (_, i) => {
      const angle = (i / ring.count) * Math.PI * 2 + (ringIdx * Math.PI) / ring.count;
      const colors = palette[(id + ringIdx) % palette.length];
      return {
        id: `panel_${id++}`,
        width: ring.size,
        height: ring.size,
        position: {
          x: Math.cos(angle) * ring.radius,
          y: ring.size / 2,
          z: Math.sin(angle) * ring.radius
        },
        lookAtCenter: true,
        colors
      };
    })
  );
}

function buildInterweave(cfg) {
  const halfRows = (cfg.rows - 1) / 2;
  const halfCols = (cfg.cols - 1) / 2;
  let id = 0;
  const panels = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const isOdd = (r + c) % 2 === 1;
      const colors = palette[(r * 31 + c * 7) % palette.length];
      panels.push({
        id: `panel_${id++}`,
        width: cfg.panelWidth,
        height: cfg.panelHeight,
        position: {
          x: (c - halfCols) * cfg.spacing,
          y: cfg.panelHeight / 2,
          z: (r - halfRows) * cfg.spacing
        },
        rotation: { x: 0, y: isOdd ? Math.PI / 2 : 0, z: 0 },
        colors
      });
    }
  }
  return panels;
}

function buildTurbo(cfg) {
  const panels = [];
  let id = 0;
  const tiltRad = (cfg.tiltDeg * Math.PI) / 180;

  for (let layer = 0; layer < cfg.layerCount; layer++) {
    const radius = cfg.baseRadius + layer * cfg.layerSpacing;
    const circumference = 2 * Math.PI * radius;
    const count = Math.max(6, Math.floor(circumference / cfg.panelSpacing));
    const tilt = (layer % 2 === 0) ? +tiltRad : -tiltRad;
    const colors = cfg.layerColors[layer % cfg.layerColors.length];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      panels.push({
        id: `panel_${id++}`,
        width: cfg.panelWidth,
        height: cfg.panelHeight,
        position: {
          x: Math.cos(angle) * radius,
          y: cfg.panelHeight / 2,
          z: Math.sin(angle) * radius
        },
        // YXZ order: Y first aligns panel width along the radial direction,
        // then X tilts the now-radial axis ±15° like turbine-blade pitch.
        rotation: { x: tilt, y: -angle, z: 0, order: 'YXZ' },
        colors
      });
    }
  }
  return panels;
}

const layoutBuilders = {
  stonehenge: buildStonehenge,
  interweave: buildInterweave,
  turbo:      buildTurbo
};

const storedLayout = typeof localStorage !== 'undefined'
  ? localStorage.getItem('dichroic.layout')
  : null;
const activeMode = (storedLayout && layoutBuilders[storedLayout])
  ? storedLayout
  : layoutConfig.mode;

export const activeLayout = activeMode;
export const installationData = layoutBuilders[activeMode](layoutConfig[activeMode]);
export const installationLights = layoutConfig[activeMode].lights;
