# Utility Context

- **Current primitive survival rules** (`src/lib/survival/world.ts`, `src/lib/survival/rules.ts`): Infinite random-seed world with continuous terrain height, smoothly weighted desert/forest/snow surface maps, forest soil blending, and physical two-hand progression. Chunk streaming supports near/medium/far render presets with medium as the default and a bounded 81-chunk cache. Eight deterministic tree types include the four new Blender variants; spawn weights are inverse square of modeled size, and shared trunk radii drive collision. Wildlife changes persist heading derived from each move. Only apple oak bears fruit. Current design is in `docs/agents/context/survival.md`.
- **GLB outdoor fill** (`src/lib/assetLighting.ts`): Caches cloned standard materials for deer, trees, apples and rocks, adding a texture-tinted emissive fill to compensate for stronger Blender studio lighting without changing shared GLB data.

- **Sandbox smooth terrain and materials** (`src/pages/Sandbox/lib/terrain.ts`, `src/pages/Sandbox/lib/materials.ts`, `src/pages/Sandbox/lib/art/textures/surfaces/`): Builds smooth-shaded 1m triangle grids without vertical block faces, samples exact rendered height for player and prop placement, and uses one lit shader material to blend bright grass/earth, sand and snow maps. `propMaterialTexture()` supplies the separate stone, wood and skin textures for held and worn items in `src/pages/Sandbox/lib/art/textures/`.
- **Blender asset refresh** (`scripts/art/build_stylized_assets.py`, `scripts/art/build_deer.py`, `src/pages/Sandbox/lib/art/models/portfolio_forest_source.blend`, `src/pages/Sandbox/lib/art/models/`): Starts from `Portfolio-models-before-stylized.blend`, validates and preserves its original birch/oak meshes, removes the spruce, replaces only the oak foliage image, and assigns four ground maps to preview planes. Uses the adult deer builder for future asset refreshes, exports GLBs and saves a reviewable Blender source via `--save-as`.
- **Deer refresh** (`scripts/art/build_deer.py`, `src/pages/Sandbox/lib/art/models/deer.glb`, `src/pages/Sandbox/lib/art/models/portfolio_models_deer.blend`, `src/pages/Sandbox/lib/art/textures/deer_coat.png`): Replaces only deer objects in `Portfolio-models.blend`, builds an adult deer with four named leg pivots and head pivot, exports a textured GLB and saves a Blender copy plus optional isolated preview.

- **Survival shared rules and rooms** (`src/lib/survival/rules.ts`, `configs/coopServer.ts`, `configs/vite.config.ts`): Validated individual actions with shared-world changes and same-origin SSE rooms for up to four people. See `docs/agents/context/survival.md`. Vite development and preview mount the room API; static deployments remain solo-capable.

- **Dawn end-to-end test** (`tests/e2e/dawn-beacon.e2e.ts`, `configs/playwright.config.ts`): System Chrome drives the built game through three Dawn crystal pickups using the test-only autoloop API, activates the beacon and asserts the persistent drive reward in the HUD. Run with `npm run test:e2e`; Playwright builds and serves the production bundle on port 4173. `src/pages/Portfolio/lib/AutoloopBridge.tsx` increments the teleport revision so scripted moves reset vehicle physics exactly.
- **Vitest isolation** (`vitest.config.ts`): Browser journeys under `tests/e2e` are excluded from the Node unit suite.

- **Beacon reward progression** (`src/lib/expedition.ts`): All beacons consume three crystal energy; Dawn grants the `dawn-drive` upgrade on restoration. Defensive parsing converts a legacy gate-restored Dawn into equivalent crystal energy so the completed beacon and reward survive migration.
- **Expedition persistence v3** (`src/stores/expedition/expedition.ts`): Saves crystal, beacon and upgrade state per terrain seed, with fallback migration from v2 and v1 saves.
- **Car tuning and handbrake** (`src/pages/Portfolio/lib/carPhysics.ts`, `src/pages/Portfolio/lib/controls.ts`): Optional tuning multipliers preserve stock defaults while upgrades alter engine, maximum speed and grip. Space applies braking with reduced lateral grip and yaw-driven slip for controlled drifts.
- **Car physics reward tests** (`src/pages/Portfolio/lib/carPhysics.test.ts`): Confirms stock limits remain unchanged, tuned drive achieves its higher speed ceiling, and handbrake trades speed/grip for measurable slip. Expedition tests cover energy gating, reward grant, persistence and legacy migration. World tests keep landmark and pickup areas clear across seeds.


- **Settings input isolation** (`src/pages/Portfolio/lib/controls.ts`): Editable elements and range inputs retain their keyboard controls instead of steering the car.


- **Mission access regression** (`src/pages/Portfolio/lib/world/world.test.ts`): Validates solid-prop/crate clearance around all mission pickups across five seeds and neighboring chunks. `src/pages/Portfolio/lib/world/ramps.ts` excludes ramps near beacon areas; `src/pages/Portfolio/lib/world/pedestals.ts` excludes wild portals inside mission clearings.

- **Shared camp and input reset** (`src/lib/expedition.ts`, `src/pages/Portfolio/lib/controls.ts`): CAMP coordinates keep the mini-map, world and completion proximity aligned; exported resetControls prevents held keys leaking through the Escape pause.
- **Camera heading bridge** (`src/pages/Portfolio/lib/CameraRig.tsx`, `src/pages/Portfolio/lib/state.ts`): The camera rig publishes its smoothed horizontal facing angle into mutable town state so the DOM mini-map can rotate in sync without React frame updates.

- **Expedition regression tests** (`src/lib/expedition.test.ts`): Full campaign in reverse order, resource sufficiency, duplicate prevention, completion gating and corrupted-save recovery.

- **Town controls lifecycle** (`src/pages/Portfolio/lib/controls.ts`): Clears held keys on blur/bind/unmount, prevents arrow scrolling, and suppresses repeated portal keypresses.

- **Expedition placement clearances** (`src/pages/Portfolio/lib/world/generate.ts`): Vegetation and supply piles reserve access around shared expedition landmarks and crystals.

- **Expedition rules** (`src/lib/expedition.ts`): Five named beacons, twenty unique crystals, generation clearings, energy economy, pure progression reducer and defensive save parsing. Completion requires all beacons and returning to camp.
- **Expedition store** (`src/stores/expedition/expedition.ts`): Effector discoveries, collection, restoration, completion and notices. Versioned per-seed localStorage persistence; isolated autoloop sessions and storage failure status.

## Core Utilities and Libs (`src/lib`)

- **constants.ts** (`src/lib/constants.ts`): All gameplay tuning — arena size, snake speed/boost (max/drain/regen, `BOOST_MIN` start threshold, `BOOST_COOLDOWN`), turn rate, segment spacing, shell break threshold, shard physics params, HP, food spawn rules.
- **types.ts** (`src/lib/types.ts`): Shared TypeScript types — `GamePhase`, `Vec3`, `InputState`, `FoodEntity`, `Shard`, `BreakInfo`, `BreakTracker`, `SnakeState` (incl. `boostCooldown`), `WorldState`.
- **utils.ts** (`src/lib/utils.ts`): Vector/angle helpers — `clamp`, `distance3`, `shortestAngle`.
- **world.ts** (`src/lib/world.ts`): Mutable game world — `createWorld()`, `resetWorld()`, `createInput()`, `spawnFood()`. The snake spawns at the arena center with `START_SEGMENTS` segments.
- **physics.ts** (`src/lib/physics.ts`): Hand-rolled physics — `stepWorld()` (movement, steering with `MAX_TURN_RATE`, wall reflection + HP damage, ram detection, shard integration/pickup, food spawning), `isGameOver()`, `segmentRadius()`. Returns a `StepResult` (score gained / damage taken). Allocation-free hot paths (module-scoped scratch objects, in-place mutation); shared `reflectAxis` helper for wall/floor reflections; shards are tagged with a `breakId` and break bonuses are tracked per-break via `BreakTracker` (handles overlapping breaks). Boost runs on a cooldown: it drains fully to 0 while active, ends when the meter hits 0 (no stutter), starts a `BOOST_COOLDOWN` on end, and regenerates only after the cooldown expires. `BOOST_MIN` only gates starting a *new* boost — an active boost drains all the way down.
- **hooks.ts** (`src/lib/hooks.ts`): React hooks — `useInputRef()` (shared mutable input), `useKeyboardInput()` (WASD/arrows + Space boost).
- **styles.ts** (`src/lib/styles.ts`): `GlobalStyle` and `PageWrapper` (full-screen layout, dark background).
- **index.css** (`src/index.css`): Global reset + `Exo 2` font import, imported in `src/main.tsx`. Also defines `.autoloop-hide-hud [data-hud] { display: none }` used by the autoloop harness.
- **autoloop.ts** (`src/lib/autoloop.ts`): Test-mode runtime for the autoloop harness — `autoloopRuntime` (enabled/frozen/hudHidden/seed), `isAutoloopEnabled()` (`?autoloop=1`), `isAutoloopFrozen()`, `readAutoloopSeed()`, and the global `window.__autoloop` `AutoloopApi` type.
- **random.ts** (`src/lib/random.ts`): Deterministic helpers for procedural generation — `seeded(index, seed)`, `hash2(x, y, seed)` (value-noise lattice hash), `createRng(seed)` (mulberry32) and `chance(rng, probability)`. Seeded by `?seed=` so autoloop screenshots are reproducible.
- **voxel.ts** (`src/lib/voxel.ts`): Voxel geometry helpers — `VoxelPart`, `mergeVoxelParts(parts)` (bakes per-part colors into one vertex-colored `BufferGeometry`), `box(w,h,d)`, and `voxelMaterial()` (shared `vertexColors` + `flatShading` material). Used by the Portfolio `Props` and `Pedestals` components.
- **theme.ts** (`src/lib/theme.ts`): Mock theme object `GAME_THEME` (arena/snake/food/ui tokens). To be refined later.
- **assets/fonts** (`src/lib/assets/fonts/`): Shared `helvetiker_bold.typeface.json` (drei `Text3D` billboard text on pedestals; `FontLoader`/`TextGeometry` glyph cache for Letter Rain).

## State Management (Stores) (`src/stores`)

- **snake3d** (`src/stores/snake3d`): Effector store for the game UI state.
  - `snake3d.ts`: `$snake3d` store — phase, gameId (increments on every `startGame`, used to trigger world reset), score, hp, best (persisted in localStorage).
  - `events.ts`: `startGame`, `gameOver`, `toMenu`, `pauseGame`, `resumeGame`, `addScore`, `damageSnake`.
  - `types.ts`: `ISnake3DStore` interface.
- **letters** (`src/stores/letters`): Effector events feeding the Letter Rain world (which lives in a page ref).
  - `events.ts`: `letterTyped(char)`, `clearLetters`.

## Page-Specific Libs

- **Portfolio world generation** (`src/pages/Portfolio/lib/world`): Deterministic procedural open world, seeded from `?seed=` or `TERRAIN_SEED`.
  - `noise.ts`: `valueNoise`, `fbm`, `smoothstep` — dependency-free height/biome noise.
  - `biomes.ts`: `BiomeId` + `BIOMES` (meadow / forest / rocky / mountain) with bright cartoon palettes and per-chunk spawn densities.
  - `terrain.ts`: `createTerrain(seed)` → `heightAt` (fbm hills + massif mountains, quantized to 0.25 for voxel steps, flat starting pad near spawn), `biomeAt`, `normalAt`.
  - `generate.ts` (`src/pages/Portfolio/lib/world/generate.ts`): Seeded biome-weighted vegetation with spacing between solid props, chunk-edge margins and spawn/pedestal clearings. A separate RNG generates 3–5-crate supply piles on reasonably flat areas in 48% of chunks, plus the nine-crate starting stack. Crates are dynamic and excluded from static colliders.
  - `pedestals.ts` (`src/pages/Portfolio/lib/world/pedestals.ts`): Portal focus height is 3.9 to match the redesigned plaque. `createStartPedestals()` guarantees Snake 3D and Letter Rain in the initial area; `createPedestalForChunk(seed, cx, cz)` applies `PEDESTAL_CHANCE` (1%) independently to every streamed chunk; `createPedestals(seed)` is the initial-window helper.
  - `index.ts`: Streaming world manager. Keeps a deterministic `chunkCache`, maintains an active 8×6 window around the player's current chunk, rebuilds active props/pedestals/colliders on window shifts, and exposes `updateWorldStreaming`, `subscribeWorld`, `getWorldRevision`, `world`, `terrain`, and `groundHeight`.
  - `types.ts` (`src/pages/Portfolio/lib/world/types.ts`): `Prop` (including dynamic crate spawn definitions), `Chunk`, `Collider`, `PedestalDef`, `World`.
  - `index.ts`: builds the singleton `world` (seed, terrain, chunks, props, pedestals, colliders) and exports `groundHeight(x, z)` and `terrain`.
- **Car physics** (`src/pages/Portfolio/lib/carPhysics.ts`): Mutable heightfield simulation with bounded 120 Hz substeps, slope forces, quicker acceleration and steering with a gravity/load traction cap, speed-tapered target yaw with fast release/countersteering, and lighter damped chassis lean. Flight retains angular inertia. Unilateral spring-damper support uses terrain-relative vertical velocity, finite suspension travel and a damped bottom-stop rebound. Climbs build vertical momentum; crests release into ballistic flight without ground attraction. Isotropic air drag and airborne yaw preserve world-space horizontal direction and chassis angular inertia, with damped pitch/roll springs acting only under ground support. `CarBody.y` is the suspension equilibrium reference and may compress by `SUSPENSION_TRAVEL`.
- **Car physics tests** (`src/pages/Portfolio/lib/carPhysics.test.ts`): Driving, slopes, turning inertia, ramp takeoff and settling, ledge gravity, airborne controls/momentum, hard landing rebound and matching 30/60/120 fps trajectories.
- **Town shared physics/interaction** (`src/pages/Portfolio/lib`): Used by `CarModel` for driving and portal interaction.
  - `physics.ts`: `resolveObstacles(pos, radius)` (circle-vs-cylinder push-out over the currently active `world.colliders`, returns whether a hit occurred so the car can damp its speed). Player movement has no artificial world-boundary clamp; streaming moves the active window as the player travels.
  - `interaction.ts`: `tryStartInteraction(state)` (find nearest pedestal within `INTERACTION_RADIUS` and arm the activation) and `stepInteraction(state, dt, onNavigate)` (advance `interactionTimer`, navigate when it reaches `ANIMATION_DURATION`, return whether an interaction is in progress so movement is skipped).

- **Letter Rain world/lib** (`src/pages/Letters/lib`): Used only by the Letters page.
  - `constants.ts`: Layout/physics tuning — `MAX_LETTERS` (9), `MIN_LETTER_PX` (120 — minimum on-screen letter size in px), play-area bounds (`AREA_HALF_W`, `AREA_HEIGHT`; `AREA_HALF_D` = 0.9 ≈ 1.5 × letter depth — the field is one row deep), fast fall tuning (`GRAVITY` 90, `INITIAL_VY` -10, `MAX_FALL_SPEED` 60), free tilt dynamics (`MAX_TILT` 0.3 rad with limit bounce, `TILT_VELOCITY` 2, `TILT_AIR_DRAG`, `TILT_REST_DRAG`, `TILT_IMPACT_KICK`), camera FOV/margin, visual tokens (background/letter/floor/wall colors).
  - `types.ts`: `LetterEntity` (id, char, position/velocity vectors, tilt + tilt velocities, per-char base AABB half-extents, resting flag), `LettersWorld` (letters array, nextId, `pxPerWorld`, `letterScale`).
  - `geometry.ts`: Font + glyph geometry cache — parses the shared `helvetiker_bold.typeface.json` once (`FontLoader`), builds a centered `TextGeometry` per unique character (cached), and exposes each char's bounding box (clamped to a 0.05 min) for collision.
  - `world.ts`: `createLettersWorld()`, `spawnLetter(world, char)` (pushes ONE letter above the top boundary at z = 0, evicts the oldest past `MAX_LETTERS`), `clearWorldLetters(world)`, `getLetterScale(world, letter)` (uniform scale so both glyph dimensions reach `world.letterScale`, which the camera rig derives from `MIN_LETTER_PX`).
  - `physics.ts`: Hand-rolled AABB simulation — `stepLetters(world, dt)`: gravity + integration, side/bottom wall clamps (no top clamp), single-row depth (every letter is locked at z = 0 — no depth stacking), pairwise overlap resolution in X/Y only (vertical case zeroes both y-velocities so landing letters stop), a final clamp pass so no letter can ever end a frame below the floor, support detection + resting state, tilt damping on contact. **Tilt is free/dynamic**: integrated every frame via `stepTilt` (air drag while falling, gentler friction at rest), bounces off the ±`MAX_TILT` limits instead of being forced flat, and hard landings / pile impacts add random angular kicks (`TILT_IMPACT_KICK`) so letters keep their landed angle and rock on impact — ready for drag & drop later. Allocation-free hot path (mutates entities in place).
  - `physics.test.ts`: Vitest suite — gravity, floor settling, no top clamp, side clamps, single-row depth lock, letter-letter separation, spawn above top, cap eviction, no sinking below the floor while stacking, **landed tilt is preserved (not reset to flat)**, scale guarantees both dimensions ≥ `letterScale`.

## Entry Point

- **main.tsx** (`src/main.tsx`): Bootstraps the app — `ThemeProvider` with `GAME_THEME`, `GlobalStyle`, `BrowserRouter` (`basename="/portfolio"`) and route-level `React.lazy` code-split pages behind a `Suspense` boundary.

## Tests

- **Vitest** (`vitest.config.ts`): Unit tests for pure game logic under `src/**/*.test.ts` run with `npm test` (`vitest run`); browser E2E and tool dependency tests are excluded.
  - `src/lib/utils.test.ts` — vector/angle helpers.
  - `src/lib/physics.test.ts` — `stepWorld`, `segmentRadius`, `isGameOver`, wall damage, boost ram / shell break tracking, boost cooldown and 0% hard stop.
  - `src/stores/snake3d/snake3d.test.ts` — store reducers and best-score persistence (localStorage stub).

## Autoloop Tooling (`scripts/autoloop`)

Node ESM scripts that drive the self-improvement loop. Output lives in `.autoloop/` (gitignored). Not part of the app bundle.

- **config.mjs**: `ROOT`, paths (`.autoloop/*`), `model`, `agentName`, perf `budgets`, `scoreThreshold` (8), `elements`, `gates`, `preview`, capture specs.
- **ledger.mjs**: append/read `.autoloop/ledger.jsonl`; `lastScores(element)`.
- **verifier.mjs**: `runGates(cwd)` runs `npm run lint/typecheck/test/build`; `allPassed`, `formatResults`.
- **planner.mjs**: parses `.autoloop/tasks.md` checkboxes (`- [ ] ID [@element] :: text`) and filters tasks by element; `nextTask`, `markDone`, `addTasks`, `pendingCount`, `ensureTasks`.
- **generator.mjs**: `generate({dir, prompt})` shells out to the opencode CLI (`run --format json --agent autoloop --auto`); `resolveOpencodeBin`, `parseLastText`.
- **judge.mjs**: `judge({before, after, element, rubric})` sends both screenshots to the vision model and parses a JSON score.
- **visual.mjs**: `captureAll({dir, outDir, seed})` boots `vite preview` and captures fixed frames with system Chrome (Playwright `channel: "chrome"`, no bundled browser).
- **index.mjs**: orchestrator — worktree isolation (with a `node_modules` junction), iterate task -> generate -> gates -> capture -> judge -> commit/reset, stop when all `elements` reach `scoreThreshold`.
- **prompts.mjs**: task-implementation and planner prompt templates.

Related: `.opencode/agent/autoloop.md` (restricted implementer agent), `docs/agents/context/art-direction.md` (rubric + budget).

- **Terrain geometry cache** (`src/pages/Portfolio/lib/world/geometry.ts`): Builds one colored heightfield geometry per immutable chunk, reuses it across window shifts and explicitly disposes it on cache eviction.

- **Crate geometry** (`src/pages/Portfolio/lib/crateGeometry.ts`): Shared merged wooden crate with inset planks, frame, diagonal braces, grooves and iron nails; one material and one instanced draw for all streamed boxes.

- **World regression tests** (`src/pages/Portfolio/lib/world/world.test.ts`): Deterministic biomes and crate piles, solid-prop spacing, one-chunk-per-update budget, overlapping geometry identity and bounded cache over long travel.

- **Crate physics** (`src/pages/Portfolio/lib/cratePhysics.ts`): Pure 120 Hz bounded local box simulation. Swept player motion, height-aware approach-only impulses, equal-mass horizontal impact transfer, gravity, damped bounce/friction, three-axis tumble and face settling. Horizontal box contacts use fixed cube bounds; vertical contacts account for rotated cube extent to avoid sinking while tumbling.

- **Ramps** (`src/pages/Portfolio/lib/world/ramps.ts`): Seeded rare curved ramps on gentle terrain, three heights (0.8/1.6/2.4), cardinal headings, pedestal clearance and open approach/landing lanes. Analytic surface helpers and testable `createDrivingSurface` match the render profile. `world/index.ts` exposes active ramps and `drivingTerrain`; `world/types.ts` stores ramp definitions per chunk and world. `world/generate.ts` reserves lanes across adjacent chunks.

- **Handling/impact/ramp tests** (`src/pages/Portfolio/lib/carPhysics.test.ts`, `src/pages/Portfolio/lib/cratePhysics.test.ts`, `src/pages/Portfolio/lib/world/ramps.test.ts`): Countersteering/release response, approach-only crate impulse, airborne clearance, momentum transfer, support removal, settling, seeded ramp sizes and actual car takeoff/landing on all three profiles.

- **World constants** (`src/pages/Portfolio/lib/constants.ts`): Removed unused on-foot movement and animation tuning; car physics tuning remains in carPhysics.ts.

- **Blender source refinement** (`scripts/art/refine_portfolio_models.py`): Explicit MCP stages refine the existing deer, build a 20-bone rig and two looped walk actions, and derive four distinct branching tree variants using original polygon foliage/UVs. `validate_scene()` evaluates action continuity and hoof clearance at whole/half frames. Operates on the backed-up `Z:/programs/Blender/Models/Portfolio-models.blend`; runtime GLBs are not exported. Review renders and validation results are in `scripts/art/previews/`; asset details are in `docs/agents/context/sandbox-art.md`.
