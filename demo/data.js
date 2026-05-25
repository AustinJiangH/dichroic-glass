// Layout config — tweak here to change geometry and panel count.
export const layoutConfig = {
  mode: 'rings',         // 'grid' | 'rings'

  // Grid mode
  rows: 20,
  cols: 20,
  spacing: 0.55,
  panelWidth: 0.4,
  panelHeight: 0.4,

  // Rings mode (original Stonehenge-style)
  rings: [
    { radius: 1.6, count: 6,  size: 0.55 },
    { radius: 3.0, count: 12, size: 0.7  },
    { radius: 4.5, count: 18, size: 0.85 }
  ]
};

// Light, pastel palette — sky-blue / peach / cream tones. Saturated enough
// to keep per-panel hue legible after lightColor × transmission multiplication
// but airy and gallery-friendly rather than dark and heavy.
const palette = [
  { reflection: '#ffd6e8', transmission: '#d4f8ec', edgeShift: '#fff8d4' },
  { reflection: '#d0e0ff', transmission: '#ffe0c8', edgeShift: '#dcffdc' },
  { reflection: '#e4d0ff', transmission: '#fffad0', edgeShift: '#d4fff4' },
  { reflection: '#ffd6c8', transmission: '#c8dcff', edgeShift: '#fffad4' },
  { reflection: '#d0f0e0', transmission: '#ffd0e0', edgeShift: '#e0d0ff' },
  { reflection: '#ffe8c8', transmission: '#c8e4ff', edgeShift: '#ffd6e8' }
];

function buildGrid(cfg) {
  const halfRows = (cfg.rows - 1) / 2;
  const halfCols = (cfg.cols - 1) / 2;
  let id = 0;
  const panels = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
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
        rotation: { x: 0, y: 0, z: 0 },
        colors
      });
    }
  }
  return panels;
}

function buildRings(cfg) {
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

export const installationData =
  layoutConfig.mode === 'grid' ? buildGrid(layoutConfig) : buildRings(layoutConfig);
