import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { assetMaterialsWithFill } from "@/lib/assetLighting";

const DEER_MODEL_URL = new URL("./models/deer.glb", import.meta.url).href;

type Motion = boolean | { current: boolean };
const movingNow = (motion: Motion) => typeof motion === "boolean" ? motion : motion.current;

/** Rigged deer from Portfolio-models.blend with its authored looping walk. */
export function DeerModel({ moving = false, dead = false }: { moving?: Motion; dead?: boolean }) {
  const { scene, animations } = useGLTF(DEER_MODEL_URL);
  const model = useMemo(() => {
    const instance = clone(scene);
    instance.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material = assetMaterialsWithFill(object.material);
    });
    return instance;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const walk = useMemo(() => {
    const clip = animations.find((animation) => animation.name === "Deer_Walk_Relaxed");
    if (!clip) throw new Error("Deer model is missing Deer_Walk_Relaxed");
    return mixer.clipAction(clip);
  }, [animations, mixer]);

  useEffect(() => {
    walk.reset().play();
    mixer.update(0);
    walk.paused = true;
    return () => { walk.stop(); };
  }, [mixer, walk]);
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  useFrame((_, delta) => {
    const walking = !dead && movingNow(moving);
    if (walking) {
      walk.paused = false;
      mixer.update(delta);
    } else if (!walk.paused) {
      walk.time = 0;
      mixer.update(0);
      walk.paused = true;
    }
  });

  return <group position={dead ? [0, 0.8, 0] : undefined} rotation={dead ? [0, 0, Math.PI / 2] : undefined}>
    <primitive object={model} dispose={null} />
  </group>;
}

useGLTF.preload(DEER_MODEL_URL);
