import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { assetMaterialsWithFill } from "@/lib/assetLighting";
import { APPLE_TREE_FRUIT_COUNT, TreeType } from "@/lib/survival/world";

type TreeInstance = { x: number; y: number; z: number; scale: number; treeType: TreeType; applesPicked?: number };
type TreePart = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] };

const TREE_MODEL_URL = new URL("./models/forest_trees.glb", import.meta.url).href;
const APPLE_MODEL_URL = new URL("./models/apple.glb", import.meta.url).href;
const APPLE_POSITIONS: Array<[number, number, number]> = [
  [-1.15, 5.15, 0.6],
  [1.3, 5.45, 0.1],
  [-0.45, 6.25, -0.9],
  [0.75, 6.1, 0.95],
  [-0.8, 5.75, 1.1],
];
const TREE_SOURCES = [
  { type: "birch", trunk: "BirchTrunk", canopy: "BirchCanopy" },
  { type: "oak", trunk: "OakTrunk", canopy: "OakCanopy" },
  { type: "oakWide", trunk: "OakTrunk", canopy: "OakCanopy" },
  { type: "appleOak", trunk: "OakTrunk", canopy: "OakCanopy" },
  { type: "oakSpreading", trunk: "Oak_Spreading_Trunk", canopy: "Oak_Spreading_Canopy" },
  { type: "birchForked", trunk: "Birch_Forked_Trunk", canopy: "Birch_Forked_Canopy" },
  { type: "rowanFan", trunk: "Rowan_Fan_Trunk", canopy: "Rowan_Fan_Canopy" },
  { type: "oakWindswept", trunk: "Oak_Windswept_Trunk", canopy: "Oak_Windswept_Canopy" },
] as const satisfies Array<{ type: TreeType; trunk: string; canopy: string }>;

function getMeshPart(nodes: Record<string, THREE.Object3D>, name: string): TreePart {
  const object = nodes[name];
  if (!(object instanceof THREE.Mesh)) throw new Error(`Tree model is missing mesh '${name}'`);
  return { geometry: object.geometry, material: assetMaterialsWithFill(object.material) };
}

function getRootedMeshPart(nodes: Record<string, THREE.Object3D>, name: string): TreePart {
  const object = nodes[name];
  if (!(object instanceof THREE.Mesh)) throw new Error(`Apple model is missing mesh '${name}'`);
  const geometry = object.geometry.clone();
  geometry.applyMatrix4(object.matrixWorld);
  return { geometry, material: assetMaterialsWithFill(object.material) };
}

function syncInstances(mesh: THREE.InstancedMesh | null, trees: TreeInstance[], transform: THREE.Object3D) {
  if (!mesh) return;
  trees.forEach((tree, index) => {
    transform.position.set(tree.x, tree.y, tree.z);
    transform.rotation.set(0, Math.sin(tree.x * 12.9898 + tree.z * 78.233) * Math.PI, 0);
    if (tree.treeType === "oakWide") transform.scale.set(tree.scale * 1.2, tree.scale, tree.scale * 1.2);
    else transform.scale.setScalar(tree.scale * (tree.treeType === "appleOak" ? 1.15 : 1));
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.count = trees.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

const TreeSpeciesInstances = ({ trees, trunk, canopy }: { trees: TreeInstance[]; trunk: TreePart; canopy: TreePart }) => {
  const trunkMesh = useRef<THREE.InstancedMesh>(null);
  const canopyMesh = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const capacity = Math.max(1024, trees.length);

  useLayoutEffect(() => {
    syncInstances(trunkMesh.current, trees, transform);
    syncInstances(canopyMesh.current, trees, transform);
  }, [trees, transform, capacity]);

  return <>
    <instancedMesh ref={trunkMesh} args={[trunk.geometry, trunk.material, capacity]} castShadow receiveShadow dispose={null} />
    <instancedMesh ref={canopyMesh} args={[canopy.geometry, canopy.material, capacity]} castShadow receiveShadow dispose={null} />
  </>;
};

const AppleInstances = ({ trees, fruit, stem, leaf }: { trees: TreeInstance[]; fruit: TreePart; stem: TreePart; leaf: TreePart }) => {
  const fruitMesh = useRef<THREE.InstancedMesh>(null);
  const stemMesh = useRef<THREE.InstancedMesh>(null);
  const leafMesh = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const appleTrees = useMemo(() => trees.filter((tree) => tree.treeType === "appleOak"), [trees]);
  const remainingFruits = appleTrees.reduce((sum, tree) => sum + Math.max(0, APPLE_TREE_FRUIT_COUNT - (tree.applesPicked ?? 0)), 0);
  const capacity = Math.max(1, remainingFruits);

  useLayoutEffect(() => {
    let index = 0;
    appleTrees.forEach((tree) => {
      const rotation = Math.sin(tree.x * 12.9898 + tree.z * 78.233) * Math.PI;
      const start = Math.max(0, Math.min(APPLE_TREE_FRUIT_COUNT, tree.applesPicked ?? 0));
      for (const [localX, localY, localZ] of APPLE_POSITIONS.slice(start)) {
        const x = (localX * Math.cos(rotation) + localZ * Math.sin(rotation)) * tree.scale;
        const z = (-localX * Math.sin(rotation) + localZ * Math.cos(rotation)) * tree.scale;
        const appleOakScale = tree.scale * 1.15;
        transform.position.set(tree.x + x * 1.15, tree.y + localY * appleOakScale, tree.z + z * 1.15);
        transform.rotation.set(0, rotation + index * 2.4, 0);
        transform.scale.setScalar(appleOakScale * 1.12);
        transform.updateMatrix();
        fruitMesh.current?.setMatrixAt(index, transform.matrix);
        stemMesh.current?.setMatrixAt(index, transform.matrix);
        leafMesh.current?.setMatrixAt(index, transform.matrix);
        index += 1;
      }
    });
    for (const mesh of [fruitMesh.current, stemMesh.current, leafMesh.current]) {
      if (!mesh) continue;
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [appleTrees, transform, capacity]);

  return <>
    <instancedMesh ref={fruitMesh} args={[fruit.geometry, fruit.material, capacity]} castShadow receiveShadow dispose={null} />
    <instancedMesh ref={stemMesh} args={[stem.geometry, stem.material, capacity]} castShadow receiveShadow dispose={null} />
    <instancedMesh ref={leafMesh} args={[leaf.geometry, leaf.material, capacity]} castShadow receiveShadow dispose={null} />
  </>;
};

/** Draws all source tree meshes as GPU instances, including the four new variants. */
export function ForestInstances({ trees }: { trees: TreeInstance[] }) {
  const { nodes } = useGLTF(TREE_MODEL_URL);
  const { nodes: appleNodes, scene: appleScene } = useGLTF(APPLE_MODEL_URL);
  const treeMeshes = nodes as Record<string, THREE.Object3D>;
  const appleMeshes = appleNodes as Record<string, THREE.Object3D>;
  const bySpecies = useMemo(() => {
    const grouped = Object.fromEntries(TREE_SOURCES.map(({ type }) => [type, [] as TreeInstance[]])) as Record<TreeType, TreeInstance[]>;
    trees.forEach((tree) => grouped[tree.treeType].push(tree));
    return grouped;
  }, [trees]);
  const sources = useMemo(() => TREE_SOURCES.map((source) => ({
    type: source.type,
    trunk: getMeshPart(treeMeshes, source.trunk),
    canopy: getMeshPart(treeMeshes, source.canopy),
  })), [treeMeshes]);
  const fruitParts = useMemo(() => {
    appleScene.updateMatrixWorld(true);
    return {
      fruit: getRootedMeshPart(appleMeshes, "AppleFruit"),
      stem: getRootedMeshPart(appleMeshes, "AppleStem"),
      leaf: getRootedMeshPart(appleMeshes, "AppleLeaf"),
    };
  }, [appleMeshes, appleScene]);

  return <>
    {sources.map(({ type, trunk, canopy }) => <TreeSpeciesInstances key={type} trees={bySpecies[type]} trunk={trunk} canopy={canopy} />)}
    <AppleInstances trees={trees} {...fruitParts} />
  </>;
}

useGLTF.preload(TREE_MODEL_URL);
useGLTF.preload(APPLE_MODEL_URL);
