const palette = [
  { reflection: '#ff2a88', transmission: '#00d8c2', edgeShift: '#ffd24a' },
  { reflection: '#2a90ff', transmission: '#ff7a2a', edgeShift: '#4aff8c' },
  { reflection: '#b04aff', transmission: '#fff04a', edgeShift: '#4afff0' },
  { reflection: '#ff4a3a', transmission: '#3a78ff', edgeShift: '#fff04a' },
  { reflection: '#3ad8a8', transmission: '#ff3aa0', edgeShift: '#a83aff' },
  { reflection: '#ffc83a', transmission: '#3aaaff', edgeShift: '#ff78d8' }
];

const rings = [
  { radius: 1.6, count: 6,  size: 0.55 },
  { radius: 3.0, count: 12, size: 0.7  },
  { radius: 4.5, count: 18, size: 0.85 }
];

let id = 0;
export const installationData = rings.flatMap((ring, ringIdx) =>
  Array.from({ length: ring.count }, (_, i) => {
    const angle = (i / ring.count) * Math.PI * 2 + (ringIdx * Math.PI) / ring.count;
    const colors = palette[(id + ringIdx) % palette.length];
    const entry = {
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
    return entry;
  })
);
