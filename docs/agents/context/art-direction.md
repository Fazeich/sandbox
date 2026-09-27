# Art Direction — Bright Smooth Survival World

Target for the map loop: **every map element scores >= 8/10** on the rubric below,
verified by a vision-model judge on fixed-seed screenshots.

## Style

- Bright, saturated cartoon art with rounded low-poly props and smooth continuous
  terrain. Use the light palette established by `src/pages/Sandbox/lib/art/textures/`
  and `src/pages/Sandbox/lib/art/models/` consistently across the survival world.

## First-person Sandbox style

- `src/pages/Sandbox/` uses smooth-shaded continuous terrain in three biomes:
  desert, forest and snow. Its four repeatable ground maps are earth, snow, sand
  and grass in `src/pages/Sandbox/lib/art/textures/surfaces/`.
- `src/pages/Sandbox/lib/art/textures/trees/` contains bright tileable bark and
  foliage maps. `src/pages/Sandbox/lib/art/models/forest_trees.glb` contains a
  birch and three increasingly broad/tall oak silhouettes; the apple oak is rare.
- `src/pages/Sandbox/lib/art/models/apple.glb` and
  `src/pages/Sandbox/lib/art/textures/apple_skin.png` provide the low-poly fruit
  attached to the largest oak and carried after harvest. `deer.glb` uses the
  matching spotted coat from `src/pages/Sandbox/lib/art/textures/deer_coat.png`.
- `src/pages/Sandbox/lib/art/models/rock.glb` and
  `src/pages/Sandbox/lib/art/textures/rock_surface.png` define the matching
  low-poly boulder. Biome material weights blend across boundaries in
  `src/pages/Sandbox/lib/terrain.ts` and `src/lib/survival/world.ts`.

## Allowed concept changes (Phase 1)

- Infinite procedural smooth terrain with chunk streaming and desert/forest/snow biomes.
- Removal of the perimeter fence (`lib/Walls.tsx`) in favor of an open world.
- Random pedestals (existing mini-games `Snake 3D`, `Letter Rain`) placed by a
  seeded RNG.

## Element inventory

`terrain-surface`, `terrain-detail`, `rocks-cliffs`, `trees-vegetation`,
`biome-transitions`, `distant-horizon`, `pedestals`, `props`.

## Rubric (0-10 each, threshold 8)

- `silhouette` — form readability and contrast against the background.
- `material` — variety and plausibility of materials; no plastic look.
- `texture-detail` — surface detail; no large flat untextured faces.
- `lighting-response` — how the element reacts to light and shadow.
- `biome-consistency` — coherence with the biome and neighboring elements.
- `performance` — element does not break the draw-call / triangle budget.

## Performance budget

60 FPS target / 45 FPS minimum, <= 300 draw calls, <= 150k triangles,
<= 40 active chunks, <= 200 physics bodies.

## Deferred (on-demand phase)

Water and atmosphere are **not** part of Phase 1. They become a separate phase
invoked only after the final Phase-1 result is reviewed.
