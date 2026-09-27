import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useUnit } from "effector-react";
import { BEACONS, CRYSTALS, BEACON_COST, CAMP, DAWN_BEACON_ID, canRestoreBeacon, energyLeft } from "@/lib/expedition";
import { $expedition, expeditionAction, expeditionNotice } from "@/stores/expedition/expedition";
import { isAutoloopFrozen } from "@/lib/autoloop";
import { TownState } from "./state";
import { groundHeight } from "./world";

export const ExpeditionWorld = ({ state }: { state: TownState }) => {
  const save = useUnit($expedition);
  const action = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (state.paused) return;
      if (event.code === "KeyF" && !event.repeat) action.current = true;
      if (event.code === "KeyR" && !event.repeat && !state.interacting) {
        state.player.x = 0; state.player.z = 0; state.player.y = groundHeight(0, 0);
        state.teleportRevision += 1;
        expeditionNotice("Вы вернулись в лагерь. Собранная энергия сохранена.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  useFrame(() => {
    if (isAutoloopFrozen() || state.interacting || state.paused) { action.current = false; return; }
    const player = state.player;
    const near = (point: { x: number; z: number }, radius: number) => Math.hypot(player.x - point.x, player.z - point.z) < radius;
    const onGround = Math.abs(player.y - groundHeight(player.x, player.z)) < 2.5;
    for (const crystal of CRYSTALS) {
      if (onGround && near(crystal, 1.8) && !$expedition.getState().collected.includes(crystal.id)) {
        expeditionAction({ type: "collect", id: crystal.id });
        expeditionNotice("+1 осколок энергии. Для восстановления маяка нужно 3.");
      }
    }
    for (const beacon of BEACONS) {
      if (near(beacon, 16) && !$expedition.getState().discovered.includes(beacon.id)) {
        expeditionAction({ type: "discover", id: beacon.id });
        expeditionNotice(`Открыт маяк «${beacon.name}» — ${beacon.landmark}. Соберите осколки вокруг него.`);
      }
      if (action.current && onGround && near(beacon, 4)) {
        const progress = $expedition.getState();
        if (progress.restored.includes(beacon.id)) expeditionNotice("Этот маяк уже освещает долину.");
        else if (!canRestoreBeacon(progress, beacon.id)) expeditionNotice(`Нужно ещё ${Math.max(0, BEACON_COST - energyLeft(progress))} осколка. Ищите парящие кристаллы рядом.`);
        else {
          expeditionAction({ type: "restore", id: beacon.id });
          expeditionNotice($expedition.getState().restored.length === BEACONS.length
            ? "Все маяки зажжены! Вернитесь в лагерь и нажмите F у центрального огня."
            : beacon.id === DAWN_BEACON_ID
              ? "Рассвет восстановлен. Награда: форсированный привод — больше тяги и максимальной скорости."
              : `Маяк «${beacon.name}» восстановлен. Выберите следующую цель на карте.`);
        }
      }
    }
    if (action.current && onGround && near(CAMP, 4)) {
      expeditionAction({ type: "complete" });
      expeditionNotice($expedition.getState().completed ? "Долина снова сияет. Экспедиция завершена! Мир и аркадные порталы остаются открыты." : "Лагерь: восстановите пять маяков, затем вернитесь сюда.");
    }
    action.current = false;
  });
  return <group>
    <group position={[CAMP.x, groundHeight(CAMP.x, CAMP.z), CAMP.z]}>
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.65, 0.9, 0.7, 6]} /><meshStandardMaterial color="#555b70" /></mesh>
      <mesh position={[0, 1.25, 0]}><octahedronGeometry args={[0.6]} /><meshStandardMaterial color="#ffc76b" emissive="#ffc76b" emissiveIntensity={save.completed ? 3 : 0.5} /></mesh>
    </group>
    {BEACONS.map((beacon) => {
      const lit = save.restored.includes(beacon.id);
      return <group key={beacon.id} position={[beacon.x, groundHeight(beacon.x, beacon.z), beacon.z]}>
        <mesh position={[0, 0.25, 0]} receiveShadow><cylinderGeometry args={[1.8, 2.2, 0.5, 6]} /><meshStandardMaterial color="#66717a" /></mesh>
        <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[0.8, 2.5, 0.8]} /><meshStandardMaterial color="#ede3c9" /></mesh>
        <mesh position={[0, 3.4, 0]}><octahedronGeometry args={[0.85]} /><meshStandardMaterial color={lit ? beacon.color : "#697987"} emissive={beacon.color} emissiveIntensity={lit ? 2.5 : 0.15} /></mesh>
        {lit && <mesh position={[0, 14, 0]}><cylinderGeometry args={[0.12, 0.45, 22, 8]} /><meshBasicMaterial color={beacon.color} transparent opacity={0.28} depthWrite={false} /></mesh>}
      </group>;
    })}
    {CRYSTALS.filter((crystal) => !save.collected.includes(crystal.id)).map((crystal) => <mesh key={crystal.id} position={[crystal.x, groundHeight(crystal.x, crystal.z) + 1.1, crystal.z]} rotation={[0, Math.PI / 4, 0]}>
      <octahedronGeometry args={[0.48]} /><meshStandardMaterial color="#baffed" emissive="#58e6cb" emissiveIntensity={1.4} />
    </mesh>)}
  </group>;
};
