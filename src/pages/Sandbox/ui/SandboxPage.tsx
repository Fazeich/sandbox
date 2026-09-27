import { Component, ErrorInfo, ReactNode, Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useUnit } from "effector-react";
import { RENDER_DISTANCE_OPTIONS } from "@/lib/survival/world";
import { $settings, $phase, phaseChanged, readyChanged, $session, $world, persistSolo } from "@/stores/sandbox/sandbox";
import { Island } from "../lib/Island";
import { FirstPerson } from "../lib/FirstPerson";
import { createRuntime } from "../lib/runtime";
import { disconnectRoom } from "../lib/session";
import { stopAudio } from "../lib/audio";
import { SandboxHud } from "./SandboxHud";
import "../lib/styles.css";

class WorldBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Origin render error", error, info.componentStack); }
  render() { return this.state.error ? <div className="shore-error-screen"><div><h1>Остров пока не загрузился</h1><p>Для этой игры нужен WebGL. Попробуйте включить аппаратное ускорение браузера или открыть страницу на другом устройстве.</p><button onClick={() => location.reload()}>Попробовать снова</button><a href="https://github.com/fazeich">Посмотреть другие проекты</a></div></div> : this.props.children; }
}
export const SandboxPage = () => {
  const runtime = useMemo(createRuntime, []);
  const settings = useUnit($settings);
  useEffect(() => {
    document.title = "Исток";
    phaseChanged("menu");
    const save = () => { if ($phase.getState() !== "menu" && $session.getState().mode === "solo" && $world.getState().people.local) persistSolo($world.getState()); };
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("pagehide", save); readyChanged(false); disconnectRoom(); stopAudio(); if (document.pointerLockElement) document.exitPointerLock(); };
  }, []);
  return <WorldBoundary><main className="shore">
    <Canvas shadows={settings.quality === "high"} dpr={settings.quality === "high" ? [1, 1.5] : 1} camera={{ fov: 68, near: 0.06, far: RENDER_DISTANCE_OPTIONS.far.fogFar + 80, position: [19, 8.2, 23] }} gl={{ antialias: true, powerPreference: "high-performance" }} fallback={<div className="shore-loading"><strong>Здесь нужен WebGL</strong><span>Откройте остров в браузере с поддержкой 3D.</span></div>}>
      <Suspense fallback={null}><Island runtime={runtime} /><FirstPerson runtime={runtime} />
        {settings.quality === "high" && <EffectComposer multisampling={0}><Bloom intensity={0.35} luminanceThreshold={1.1} mipmapBlur /></EffectComposer>}
      </Suspense>
    </Canvas>
    <SandboxHud runtime={runtime} />
  </main></WorldBoundary>;
};
