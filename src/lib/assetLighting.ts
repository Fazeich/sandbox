import * as THREE from "three";

const litMaterials = new WeakMap<THREE.Material, THREE.Material>();

/** Add a texture-colored fill to studio-lit GLB assets in the outdoor scene. */
export function assetMaterialWithFill(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  const cached = litMaterials.get(material);
  if (cached) return cached;

  const filled = material.clone();
  filled.emissive.copy(filled.color);
  filled.emissiveMap = filled.map;
  filled.emissiveIntensity = 0.5;
  litMaterials.set(material, filled);
  return filled;
}

export function assetMaterialsWithFill(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  return Array.isArray(material) ? material.map(assetMaterialWithFill) : assetMaterialWithFill(material);
}
