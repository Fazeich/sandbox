import { PLAYER_SPAWN } from "./constants";


export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  keyHint: string;
  target: string;
}

export interface TownState {
  paused: boolean;
  teleportRevision: number;
  cameraFacing: number;
  player: {
    y: number;
    x: number;
    z: number;
    facing: number;
    speed: number;
  };
  interacting: boolean;
  interactionTimer: number;
  interactionTarget: string;
  hoveredPedestalId: string | null;
  tooltip: TooltipState;
}

export const NO_TOOLTIP: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  label: "",
  keyHint: "E",
  target: "",
};

export const createTownState = (): TownState => ({
  paused: false,
  teleportRevision: 0,
  cameraFacing: Math.PI,
  player: {
    y: 0,
    x: PLAYER_SPAWN.x,
    z: PLAYER_SPAWN.z,
    facing: Math.PI,
    speed: 0,
  },
  interacting: false,
  interactionTimer: 0,
  interactionTarget: "",
  hoveredPedestalId: null,
  tooltip: { ...NO_TOOLTIP },
});
