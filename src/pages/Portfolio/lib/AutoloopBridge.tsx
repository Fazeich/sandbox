import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  AutoloopStats,
  autoloopRuntime,
  isAutoloopEnabled,
  readAutoloopSeed,
  setAutoloopSeed,
} from "@/lib/autoloop";
import { TownState } from "./state";

export const AutoloopBridge = ({ state }: { state: TownState }) => {
  const gl = useThree((three) => three.gl);
  const frameCount = useRef(0);
  const elapsed = useRef(0);
  const fps = useRef(0);
  const drawCalls = useRef(0);
  const triangles = useRef(0);

  useFrame((_, delta) => {
    const info = gl.info;

    drawCalls.current = info.render.calls;
    triangles.current = info.render.triangles;
    info.reset();

    frameCount.current += 1;
    elapsed.current += delta;

    if (elapsed.current >= 1) {
      fps.current = frameCount.current / elapsed.current;
      frameCount.current = 0;
      elapsed.current = 0;
    }
  });

  useEffect(() => {
    if (!isAutoloopEnabled()) {
      return;
    }

    autoloopRuntime.enabled = true;
    setAutoloopSeed(readAutoloopSeed());
    gl.info.autoReset = false;
    gl.info.reset();

    window.__autoloop = {
      freeze: (frozen) => {
        autoloopRuntime.frozen = frozen;
      },
      hideHud: (hidden) => {
        autoloopRuntime.hudHidden = hidden;
        document.documentElement.classList.toggle("autoloop-hide-hud", hidden);
      },
      setSeed: (seed) => {
        setAutoloopSeed(seed);
      },
      setPlayer: (player) => {
        if (
          !Number.isFinite(player.x) ||
          !Number.isFinite(player.z) ||
          (player.facing !== undefined && !Number.isFinite(player.facing))
        ) {
          return;
        }

        state.player.x = player.x;
        state.player.z = player.z;
        state.teleportRevision += 1;

        if (typeof player.facing === "number") {
          state.player.facing = player.facing;
        }
      },
      stats: (): AutoloopStats => ({
        fps: fps.current,
        drawCalls: drawCalls.current,
        triangles: triangles.current,
      }),
    };

    return () => {
      autoloopRuntime.enabled = false;
      autoloopRuntime.frozen = false;
      gl.info.autoReset = true;
      document.documentElement.classList.remove("autoloop-hide-hud");
      delete window.__autoloop;
    };
  }, [gl, state]);

  return null;
};
