import { SoftShadows } from "@react-three/drei";
import { TownState } from "./state";
import {
  FOG_FAR,
  FOG_NEAR,
  SKY_COLOR,
  SUN_POSITION,
} from "./constants";
import { CarModel } from "./CarModel";
import { CAR_RADIUS } from "./carPhysics";
import { Crates } from "./Crates";
import { CameraRig } from "./CameraRig";
import { Terrain } from "./Terrain";
import { Props } from "./Props";
import { Pedestals } from "./Pedestals";
import { Ramps } from "./Ramps";
import { WorldStreamer } from "./WorldStreamer";
import { ExpeditionWorld } from "./ExpeditionWorld";
import { BeaconLandmarks } from "./BeaconLandmarks";

export const TownScene = ({
  state,
  onNavigate,
}: {
  state: TownState;
  onNavigate: (path: string) => void;
}) => (
  <>
    <color attach="background" args={[SKY_COLOR]} />
    <fog attach="fog" args={[SKY_COLOR, FOG_NEAR, FOG_FAR]} />

    <hemisphereLight args={["#fff4e0", "#b8ad9a", 0.7]} />
    <directionalLight
      position={[SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]}
      intensity={1.6}
      color="#fff1dd"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-50}
      shadow-camera-right={50}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
      shadow-camera-near={1}
      shadow-camera-far={130}
      shadow-bias={-0.0004}
    />
    <directionalLight position={[-20, 22, -24]} intensity={0.35} color="#bfd9f2" />

    <SoftShadows size={16} samples={10} focus={0.8} />

    <WorldStreamer state={state} />
    <Terrain />
    <Props />
    <Ramps />
    <Pedestals state={state} />
    <BeaconLandmarks />
    <ExpeditionWorld state={state} />
    <Crates
      state={state}
      radius={CAR_RADIUS}
    />

    <CarModel state={state} onNavigate={onNavigate} />

    <CameraRig state={state} />
  </>
);
