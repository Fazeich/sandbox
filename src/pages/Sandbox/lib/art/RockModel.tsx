import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { assetMaterialsWithFill } from "@/lib/assetLighting";

const ROCK_MODEL_URL = new URL("./models/rock.glb", import.meta.url).href;

/** Textured low-poly boulder shared by world resources and the first-person item view. */
export function RockModel({ scale = 1, grounded = false }: { scale?: number; grounded?: boolean }) {
  const { scene } = useGLTF(ROCK_MODEL_URL);
  const source = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    const mesh = meshes[0];
    if (!mesh) return null;
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!;
    return {
      geometry: mesh.geometry,
      material: assetMaterialsWithFill(mesh.material),
      minY: bounds.min.y,
      height: bounds.max.y - bounds.min.y,
    };
  }, [scene]);
  if (!source) return null;

  const modelScale = scale * 0.28;
  const groundOffset = (-source.minY - (grounded ? source.height * 0.12 : 0)) * modelScale;
  return <mesh
    geometry={source.geometry}
    material={source.material}
    scale={modelScale}
    position={grounded ? [0, groundOffset, 0] : undefined}
    castShadow
    receiveShadow
    dispose={null}
  />;
}

useGLTF.preload(ROCK_MODEL_URL);
