# Theme Context

- **Исток** (`src/pages/Sandbox/lib/styles.css`, `src/pages/Sandbox/lib/materials.ts`, `src/pages/Sandbox/lib/SkyAtmosphere.tsx`, `src/pages/Sandbox/lib/art/textures/`): Forest/cream menus, Georgia display type and Exo body, minimal HUD with physiology dial and a three-choice render-distance control. Main world art uses smooth terrain with four blended ground maps for desert/forest/snow, the original birch and oak silhouettes, a softly faceted green oak canopy map, a rare apple-bearing oak, an adult unspotted red deer and a softly tinted boulder. Blue-green horizon haze, a warm sun and shaded volumetric clouds sit above the layered ground mist. See `docs/agents/context/survival.md` and `docs/agents/context/sandbox-art.md`.

- **Beacon landmark palette** (`src/pages/Portfolio/lib/BeaconLandmarks.tsx`, `src/pages/Portfolio/lib/CarModel.tsx`): Stone, timber and restrained beacon-color accents distinguish five exploration sites; the restored Dawn drive adds warm gold trim to the car.

## Theme Implementation

The theme is currently a **mock** and will be refined later. It is provided via `styled-components` `ThemeProvider` and typed through the `DefaultTheme` module augmentation.

- **theme.ts** (`src/lib/theme.ts`): Main theme definition — the exported `GAME_THEME` object with sections:
  - `arena`: background color, wall color/opacity, grid colors.
  - `snake`: head/body/tail gradient colors + glow color.
  - `food`: shell, core, shard colors.
  - `ui`: text, muted text, accent, danger, boost, panel/panel-border, overlay colors (used by HUD and Screens).
  - `town`: bright-hub DOM tokens — title/hint text colors, key-cap colors, white fade color (used by `HubHud` and the activation fade overlay).
- **theme.d.ts** (`src/declarations/theme.d.ts`): TypeScript declaration extending `styled-components` `DefaultTheme` with the `ITheme` interface so `useTheme()` is typed.

## Styling Approach

- `styled-components` is used for DOM overlays (HUD, screens, global styles). Three.js materials read theme tokens via `useTheme()`.
- Global styles live in `src/lib/styles.ts` (`GlobalStyle`, `PageWrapper`) and `src/index.css` (font import `Exo 2`, base reset, imported in `src/main.tsx`).

- **Expedition overlay styling** (`src/pages/Portfolio/ui/HubHud.tsx`): Local styled-components use deep teal panels, warm ivory type, amber actions and mint progress; the responsive mini-map uses a circular clipped frame, centered white player dot and amber forward marker.

- **Configurable HUD transparency** (`src/pages/Portfolio/ui/HubHud.tsx`): Global --hud-opacity CSS variable controls journal, mini-map and pause backgrounds without dimming their contents. Defaults to 45% transparency, adjustable 0–85% and stored in localStorage.
## Current survival theme

`src/pages/Sandbox/lib/styles.css` now styles Исток: minimal empty-hand slots, no crosshair/text hints/objectives, and the user-specified physiology dial at lower right. Health is a filled red disk, satiety lower orange arc, hydration upper blue arc, stamina outer yellow ring. Optional minimap is off by default. Settings include persisted near/medium/far terrain range choices. Current components: `src/pages/Sandbox/ui/SandboxHud.tsx`.
