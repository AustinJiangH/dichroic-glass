# Dichroic Glass

Real-time dichroic glass installation simulator inspired by [Chris Wood's wall pieces](https://www.thisiscolossal.com/2014/09/geometric-dichroic-glass-installations-by-chris-wood/) — vanilla Three.js, no React.

**[Live demo →](https://austinjianggh.github.io/dichroic-glass/)**

Each panel is rendered as physical glass (`MeshPhysicalMaterial` with transmission, dispersion, iridescence). The colored shadows on the floor come from per-light projective cookie textures — every frame, each spotlight renders the panels' transmission colors from its own POV into a render target, and Three.js multiplies the light's contribution by that cookie:

```
floor_pixel_light_contribution = lightColor × panelTransmissionColor
```

That's a physical filter — cyan glass under red light yields a black contribution, green and blue still pass — so shadows naturally take the panel's hue.

## Layouts

Switch via the bottom-left dropdown:

- **Stone Henge** — 3 concentric rings of upright panels facing center; 3 mixed-tint overhead lights.
- **InterWeave** — 15×15 grid with alternating 90° panel rotation (basket weave); 4 lights at 45°-crossed positions.
- **Turbo** — 5 concentric radial-blade layers with alternating ±15° tilt around the radial axis; 3 asymmetric lights.

Hit **Play** to auto-orbit the camera (azimuth rotation + smooth 30°→90° elevation climb) with light positions/intensities wobbling within range.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173/.

## Architecture

- `src/buildInstallation.js` — scene construction (lights, panels, floor, shadow tints).
- `src/spotlightCookie.js` — per-light cookie texture pipeline. Each frame renders the panels colored by their transmission color from the light's POV.
- `src/shaders.js` — dichroic glass and shadow-tint custom shaders.
- `demo/data.js` — layout definitions (stonehenge / interweave / turbo) with palette and light positions.
- `demo/main.js` — renderer setup, GUI bindings, animation loop.

The cookie approach trades render-target memory (3× 2048² MSAA textures per frame) for physical correctness — each light is filtered independently by whatever panels sit in its path, so a panel that absorbs red from one light doesn't also absorb red from another light it doesn't block.

## Knobs worth playing with

In the GUI's Scene folder:
- `shadow saturation` — pulls cookie colors away from white (stronger shadow hue).
- `ambient` — global fill light.
- `exposure` — tone mapping.

In Glass Panels:
- `transmission` — see-through factor.
- `opacity` — alpha-blend for layered panels through each other.
- `dispersion`, `iridescence`, `ior` — PBR optical properties.
- `panel depth (geometry)` — live geometric thickness.

## License

MIT — see [LICENSE](LICENSE).
