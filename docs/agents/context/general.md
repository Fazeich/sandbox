# General Context

## Project: Sandbox (Исток)

`src/pages/Sandbox/` is the default `/` route: **Исток**, a first-person primitive survival sandbox with unbounded random terrain, individual physiology and physical inventories, solo or in four-person shared rooms. `src/lib/survival/` holds generation and authority rules; `src/stores/sandbox/sandbox.ts` manages discrete events; `configs/coopServer.ts` hosts same-origin SSE rooms in development and preview. `npm run coop` exposes the dev server on LAN. Static GitHub Pages supports saved solo play but has no room server. Detailed context: `docs/agents/context/survival.md` and `docs/agents/context/sandbox-art.md`.

`src/main.tsx` has an explicit loading screen and a lazy Sandbox route; every path renders the sandbox. `index.html` identifies Исток and provides description/theme metadata.

Sandbox 1.1.0 was split out of the `portfolio` project. The previous car expedition now lives in the separate **Valley Riding** project (https://github.com/Fazeich/valley-riding); Snake 3D and Letter Rain stay in `portfolio`.

## Design concept

Current default route `src/main.tsx` -> `src/pages/Sandbox/` has no goals, hints, starter kit or camp. New lives randomize seed; saves retain it. Individual physical inventories start with two hand slots, expand to nine with a bag and add a separate 21-slot backpack. Slow long-term organism stamina only recovers through food/sleep. See `docs/agents/context/survival.md` for authoritative current design and paths.

## Core Technologies
- **Framework**: React 18
- **Build Tool**: Vite
- **State Management**: Effector (discrete game events only)
- **3D Rendering**: `three` + `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- **Styling**: `styled-components` global styles + a mock theme system; sandbox HUD uses `src/pages/Sandbox/lib/styles.css`
- **Routing**: `react-router-dom` (BrowserRouter, basename `/sandbox`)
- **Deploy**: GitHub Pages at https://fazeich.github.io/sandbox/ (`.github/workflows/deploy.yml` builds `master` into `gh-pages`; SPA fallback via `dist/404.html` copy of `index.html`)

## Architecture
The project follows a modular structure based on Feature-Sliced Design (FSD) principles. **Strict adherence to the current folder structure and hierarchy is mandatory.**

- `src/pages/Sandbox`: the game page (scene, first-person controller, terrain, art, HUD).
- `src/stores`: Effector stores (`sandbox`).
- `src/lib`: shared code — survival rules/world (`survival/`), `random.ts`, `assetLighting.ts`, theme, global styles.
- `src/declarations`: TypeScript type declarations.
- `configs/coopServer.ts`: same-origin room server plugin for dev/preview.
- `src/main.tsx`: Entry point — `ThemeProvider(GAME_THEME)` → router → `<SandboxPage />`.

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
- **Build splitting** keeps Three.js, Fiber, Drei, and postprocessing in separate vendor chunks via `configs/vite.config.ts`, avoiding one oversized application chunk.
- See `docs/agents/context/survival.md` for authoritative gameplay rules and paths.
