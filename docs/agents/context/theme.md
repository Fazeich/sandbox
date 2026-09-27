# Theme Context

- **Исток** (`src/pages/Sandbox/lib/styles.css`, `src/pages/Sandbox/lib/materials.ts`, `src/pages/Sandbox/lib/SkyAtmosphere.tsx`, `src/pages/Sandbox/lib/art/textures/`): Forest/cream menus, Georgia display type and Exo body, minimal HUD with physiology dial and a three-choice render-distance control. Main world art uses smooth terrain with four blended ground maps for desert/forest/snow, the original birch and oak silhouettes, a softly faceted green oak canopy map, a rare apple-bearing oak, an adult unspotted red deer and a softly tinted boulder. Blue-green horizon haze, a warm sun and shaded volumetric clouds sit above the layered ground mist. See `docs/agents/context/survival.md` and `docs/agents/context/sandbox-art.md`.

## Theme Implementation

The theme is currently a **mock** and will be refined later. It is provided via `styled-components` `ThemeProvider` and typed through the `DefaultTheme` module augmentation.

- **theme.ts** (`src/lib/theme.ts`): Main theme definition — the exported `GAME_THEME` object with sections:
  - `arena`: background color, wall color/opacity, grid colors.
  - `ui`: text, muted text, accent, danger, boost, panel/panel-border, overlay colors.
- **theme.d.ts** (`src/declarations/theme.d.ts`): TypeScript declaration extending `styled-components` `DefaultTheme` with the `ITheme` interface so `useTheme()` is typed.

## Styling Approach

- `styled-components` is used for global styles. Three.js materials read theme tokens via `useTheme()`.
- Global styles live in `src/lib/styles.ts` (`GlobalStyle`, `PageWrapper`) and `src/index.css` (font import `Exo 2`, base reset, imported in `src/main.tsx`).


## Current survival theme

`src/pages/Sandbox/lib/styles.css` now styles Исток: minimal empty-hand slots, no crosshair/text hints/objectives, and the user-specified physiology dial at lower right. Health is a filled red disk, satiety lower orange arc, hydration upper blue arc, stamina outer yellow ring. Optional minimap is off by default. Settings include persisted near/medium/far terrain range choices. Current components: `src/pages/Sandbox/ui/SandboxHud.tsx`.
