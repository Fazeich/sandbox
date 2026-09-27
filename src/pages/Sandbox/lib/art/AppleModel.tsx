import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { assetMaterialsWithFill } from "@/lib/assetLighting";

const APPLE_MODEL_URL = new URL("./models/apple.glb", import.meta.url).href;

/** Textured low-poly orchard apple used for picked fruit and the hand-held item. */
export function AppleModel({ scale = 1, grounded = false }: { scale?: number; grounded?: boolean }) {
  const { scene } = useGLTF(APPLE_MODEL_URL);
  const instance = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material = assetMaterialsWithFill(object.material);
    });
    return copy;
  }, [scene]);
  return <primitive
    object={instance}
    scale={scale * 1.3}
    position={grounded ? [0, 0.025 * scale, 0] : undefined}
    dispose={null}
  />;
}

useGLTF.preload(APPLE_MODEL_URL);
