# General Context

## Current primary experience: Исток

`src/pages/Sandbox/` is the default `/` route: **Исток**, a first-person primitive survival sandbox with unbounded random terrain, individual physiology and physical inventories, solo or in four-person shared rooms. `src/lib/survival/` holds generation and authority rules; `src/stores/sandbox/sandbox.ts` manages discrete events; `configs/coopServer.ts` hosts same-origin SSE rooms in development and preview. `npm run coop` exposes the dev server on LAN. Static GitHub Pages supports saved solo play but has no room server. Detailed context: `docs/agents/context/survival.md` and `docs/agents/context/sandbox-art.md`.

The previous driving expedition stays at `/expedition`; `/snake` and `/letters` remain. `?autoloop=1` on `/` preserves the existing driving visual/E2E harness. `src/main.tsx` has an explicit loading screen and lazy Sandbox route, with unknown paths returning to the sandbox. `index.html` identifies Исток and provides description/theme metadata.

## Playable expedition

The hub now hosts **Хранители маяков**, a short non-linear open-world restoration campaign: explore, collect energy, restore five beacons in any order and return to camp. Uses shared rules in `src/lib/expedition.ts`, Effector/localStorage in `src/stores/expedition/expedition.ts`, world interaction in `src/pages/Portfolio/lib/ExpeditionWorld.tsx` and mini-map/journal in `src/pages/Portfolio/ui/HubHud.tsx`. The world remains available after completion. Design and explicitly unimplemented roadmap: `docs/agents/context/game-design.md`.

Each beacon now occupies a distinct landmark site, with no prescribed road between camp and objectives. All five use the same three-crystal restoration economy; restoring Dawn permanently grants a tuned drive (+18% engine, +15% maximum speed, +8% grip).

## Project Overview
This project is a personal portfolio built as a set of **3D mini-games**. The games are the portfolio — they showcase skills through the quality of the gameplay and the codebase, without an explicit "skills" section. Built with React, Vite, Three.js (react-three-fiber), and Effector for state management.

## Core Technologies
- **Framework**: React 18
- **Build Tool**: Vite
- **State Management**: Effector (discrete game events only)
- **3D Rendering**: `three` + `@react-three/fiber` (Canvas, useFrame), `@react-three/drei` (Grid, Edges, Text3D, Billboard, SoftShadows), `@react-three/postprocessing` (Bloom, Vignette). All pages (town, snake, letters) are 3D.
- **Styling**: `styled-components` for HUD/DOM overlays + a mock theme system (to be refined later)
- **Routing**: `react-router-dom` (BrowserRouter, basename `/portfolio`)
- **Icons**: `react-social-icons` (menu links, decorative icons)

## Routes
- `/` — 3D top-down "bright diorama" town. Drive the voxel car to a 3D billboard sign (highlighted on approach), press E to enter a project. The altar system is data-driven via `ALTARS` in `src/pages/Portfolio/lib/constants.ts` (currently "Snake 3D" → `/snake` and "Letter Rain" → `/letters`). Atmosphere: sky + fog, soft shadows, Bloom/Vignette postprocessing.
- `/snake` — 3D Snake game.
- `/letters` — Letter Rain: typed characters fall as 3D letters with simple physics.
- GitHub Pages SPA fallback via `dist/404.html` copy of `index.html`
- **Other**: `gh-pages` (deploy)

## Architecture
The project follows a modular structure based on Feature-Sliced Design (FSD) principles. **Strict adherence to the current folder structure and hierarchy is mandatory.**

- `src/components`: Game components (Arena, Snake, Food, Shards, CameraRig, Effects, Hud, Screens).
- `src/pages`: Page-level components that compose components (Portfolio/town, Snake, Letters).
- `src/stores`: Effector stores for application state management.
- `src/lib`: Core utilities, constants, physics, world state, hooks, theme, global styles, types, shared assets (fonts).
- `src/declarations`: TypeScript type declarations.
- `src/main.tsx`: Entry point — `ThemeProvider(GAME_THEME)` → router with `<PortfolioPage />`, `<SnakePage />`, `<LettersPage />`.

## Component Pattern
To maintain consistency, every component follows this structure:
- `[component_name]/`
    - `index.ts`: Re-exports the component from the `ui` directory.
    - `ui/`: Contains the main component markup and logic.
    - `lib/`: Contains component-specific files (e.g., `[component_name].styles.ts`, `constants.ts`, `utils.ts`).

**Rules for `lib/` directory:**
- Files are placed in the component's `lib` folder ONLY if they are used exclusively by that component.
- If a file in `lib` is imported by other components, it must be moved to a `lib` folder at the highest common level shared by those components (usually `src/lib`).

## Game Architecture (key decisions)
- **Mutable world state** (`src/lib/world.ts` for snake; `src/pages/Letters/lib/world.ts` for letters) is the single source of truth for gameplay and lives in refs — no React re-renders per frame.
- **Physics** is hand-rolled (no physics engine): follow-the-leader chain, plane reflections, ram detection, shard physics; letters use AABB gravity/stacking physics.
- **Effector** handles only discrete UI events: phase, score, HP, best score (localStorage); `letterTyped`/`clearLetters` feed the letters world.
- **Game loop** runs inside the Canvas via `useFrame` (`src/pages/Snake/ui/GameLoop.tsx`; letters loop in `LettersScene`); input raycast for mouse lives in `PointerTracker.tsx`.
- **Routing** uses `React.lazy` and a shared `Suspense` boundary in `src/main.tsx`, so each Three.js page is loaded only when its route is opened.
- **Build splitting** keeps Three.js, Fiber, Drei, and postprocessing in separate vendor chunks via `configs/vite.config.ts`, avoiding one oversized application chunk.
- **Portfolio open world** (`src/pages/Portfolio/lib/world`): the previous fenced room was replaced by a seeded chunk-streamed heightfield world. The active render/collision window stays 8×6 chunks (128×96 units), shifts when the player crosses a chunk boundary, and prefetches neighboring chunks one per frame. A bounded 144-chunk cache reuses terrain geometry; evicted regions regenerate deterministically. Terrain height and biomes come from dependency-free fbm noise; hills and mountains have spawn chances, props (trees, rocks, grass, flowers) spawn per biome, two mini-game pedestals are guaranteed in the start area and further pedestals use a 1% per-chunk roll. Movement follows the sampled terrain height and the car can roll over on steep slopes.

## Autoloop (self-improvement loop)
The project is improved by an autonomous loop under `scripts/autoloop/` (see `utilities.md`). It uses the opencode CLI as the generator, runs `lint/typecheck/test/build` as hard gates, and judges visual progress with a vision model on fixed-seed screenshots captured by Playwright (system Chrome). The map art target for Phase 1 is defined in `docs/agents/context/art-direction.md`: a **smooth open world** (continuous procedural terrain, explicit biomes, fence removed, random pedestals with the existing mini-games) where every map element scores **>= 8/10** on the rubric. The first foundation pass is implemented; remaining detail tasks are queued in `.autoloop/tasks.md`. Town physics stays hand-rolled (terrain height sampling + slope-aligned car with rollover) — Rapier is not used; the snake/letters hand-rolled physics stays as is.

## Superseding user concept — Исток

Current default route `src/main.tsx` -> `src/pages/Sandbox/` has no goals, hints, starter kit or camp. New lives randomize seed; saves retain it. Individual physical inventories start with two hand slots, expand to nine with a bag and add a separate 21-slot backpack. Slow long-term organism stamina only recovers through food/sleep. See `docs/agents/context/survival.md` for authoritative current design and paths.
