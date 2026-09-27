# Utility Context

- **Current primitive survival rules** (`src/lib/survival/world.ts`, `src/lib/survival/rules.ts`): Infinite random-seed world with continuous terrain height, smoothly weighted desert/forest/snow surface maps, forest soil blending, and physical two-hand progression. Chunk streaming supports near/medium/far render presets with medium as the default and a bounded 81-chunk cache. Eight deterministic tree types include the four new Blender variants; spawn weights are inverse square of modeled size, and shared trunk radii drive collision. Wildlife changes persist heading derived from each move. Only apple oak bears fruit. Current design is in `docs/agents/context/survival.md`.
- **GLB outdoor fill** (`src/lib/assetLighting.ts`): Caches cloned standard materials for deer, trees, apples and rocks, adding a texture-tinted emissive fill to compensate for stronger Blender studio lighting without changing shared GLB data.

- **Sandbox smooth terrain and materials** (`src/pages/Sandbox/lib/terrain.ts`, `src/pages/Sandbox/lib/materials.ts`, `src/pages/Sandbox/lib/art/textures/surfaces/`): Builds smooth-shaded 1m triangle grids without vertical block faces, samples exact rendered height for player and prop placement, and uses one lit shader material to blend bright grass/earth, sand and snow maps. `propMaterialTexture()` supplies the separate stone, wood and skin textures for held and worn items in `src/pages/Sandbox/lib/art/textures/`.
- **Blender asset refresh** (`scripts/art/build_stylized_assets.py`, `scripts/art/build_deer.py`, `src/pages/Sandbox/lib/art/models/portfolio_forest_source.blend`, `src/pages/Sandbox/lib/art/models/`): Starts from `Portfolio-models-before-stylized.blend`, validates and preserves its original birch/oak meshes, removes the spruce, replaces only the oak foliage image, and assigns four ground maps to preview planes. Uses the adult deer builder for future asset refreshes, exports GLBs and saves a reviewable Blender source via `--save-as`.
- **Deer refresh** (`scripts/art/build_deer.py`, `src/pages/Sandbox/lib/art/models/deer.glb`, `src/pages/Sandbox/lib/art/models/portfolio_models_deer.blend`, `src/pages/Sandbox/lib/art/textures/deer_coat.png`): Replaces only deer objects in `Portfolio-models.blend`, builds an adult deer with four named leg pivots and head pivot, exports a textured GLB and saves a Blender copy plus optional isolated preview.

- **Survival shared rules and rooms** (`src/lib/survival/rules.ts`, `configs/coopServer.ts`, `configs/vite.config.ts`): Validated individual actions with shared-world changes and same-origin SSE rooms for up to four people. See `docs/agents/context/survival.md`. Vite development and preview mount the room API; static deployments remain solo-capable.

- **Vitest isolation** (`vitest.config.ts`): Browser journeys under `tests/e2e` are excluded from the Node unit suite.
- **Survival E2E** (`tests/e2e/survival.e2e.ts`, `configs/playwright.config.ts`): System Chrome drives the built sandbox at `/sandbox/`, including a two-player room.

## Core Utilities and Libs (`src/lib`)

- **styles.ts** (`src/lib/styles.ts`): `GlobalStyle` and `PageWrapper` (full-screen layout, dark background).
- **index.css** (`src/index.css`): Global reset + `Exo 2` font import, imported in `src/main.tsx`.
- **random.ts** (`src/lib/random.ts`): Deterministic helpers for procedural generation — `seeded(index, seed)`, `hash2(x, y, seed)` (value-noise lattice hash), `createRng(seed)` (mulberry32) and `chance(rng, probability)`.
- **theme.ts** (`src/lib/theme.ts`): Mock theme object `GAME_THEME` (arena/ui tokens). To be refined later.

## State Management (Stores) (`src/stores`)

- **sandbox** (`src/stores/sandbox/sandbox.ts`): Effector events/store for discrete sandbox UI state.

## Entry Point

- **main.tsx** (`src/main.tsx`): Bootstraps the app — `ThemeProvider` with `GAME_THEME`, `GlobalStyle`, `BrowserRouter` (`basename="/sandbox"`), lazy `SandboxPage` behind a `Suspense` loading screen.

## Tests

- **Vitest** (`vitest.config.ts`): Unit tests under `src/**/*.test.ts` run with `npm test` (`vitest run`); browser E2E is excluded.
  - `src/lib/random.test.ts` — deterministic RNG helpers.
  - `src/lib/survival/survival.test.ts`, `src/lib/survival/crafting.test.ts` — survival rules and crafting.

- **Blender source refinement** (`scripts/art/refine_portfolio_models.py`): Explicit MCP stages refine the existing deer, build a 20-bone rig and two looped walk actions, and derive four distinct branching tree variants using original polygon foliage/UVs. `validate_scene()` evaluates action continuity and hoof clearance at whole/half frames. Operates on the backed-up `Z:/programs/Blender/Models/Portfolio-models.blend`; runtime GLBs are not exported. Review renders and validation results are in `scripts/art/previews/`; asset details are in `docs/agents/context/sandbox-art.md`.
