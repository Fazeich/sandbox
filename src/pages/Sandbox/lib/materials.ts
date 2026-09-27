import * as THREE from "three";

const loadMaterialTexture = (url: string) => {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const terrainSurfaceTextures = {
  grass: loadMaterialTexture(new URL("./art/textures/surfaces/grass.png", import.meta.url).href),
  earth: loadMaterialTexture(new URL("./art/textures/surfaces/earth.png", import.meta.url).href),
  sand: loadMaterialTexture(new URL("./art/textures/surfaces/sand.png", import.meta.url).href),
  snow: loadMaterialTexture(new URL("./art/textures/surfaces/snow.png", import.meta.url).href),
};

const materialTextures = {
  stone: loadMaterialTexture(new URL("./art/textures/stone.png", import.meta.url).href),
  wood: loadMaterialTexture(new URL("./art/textures/wood.png", import.meta.url).href),
  skin: loadMaterialTexture(new URL("./art/textures/skin.png", import.meta.url).href),
};

/** Shared seamless maps for hand-held, worn and loose survival items. */
export const propMaterialTexture = (material: keyof typeof materialTextures): THREE.Texture => materialTextures[material];

export const terrainMaterial = new THREE.MeshStandardMaterial({
  map: terrainSurfaceTextures.grass,
  vertexColors: true,
  roughness: 0.96,
  flatShading: false,
});

terrainMaterial.name = "Terrain_BrightCartoon_FourSurfaces";
terrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTerrainGrass = { value: terrainSurfaceTextures.grass };
  shader.uniforms.uTerrainEarth = { value: terrainSurfaceTextures.earth };
  shader.uniforms.uTerrainSand = { value: terrainSurfaceTextures.sand };
  shader.uniforms.uTerrainSnow = { value: terrainSurfaceTextures.snow };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec4 aBiomeWeights;\nvarying vec4 vBiomeWeights;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBiomeWeights = aBiomeWeights;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform sampler2D uTerrainGrass;\nuniform sampler2D uTerrainEarth;\nuniform sampler2D uTerrainSand;\nuniform sampler2D uTerrainSnow;\nvarying vec4 vBiomeWeights;")
    .replace("#include <map_fragment>", `
      vec4 terrainSurfaceColor = texture2D(uTerrainGrass, vMapUv) * vBiomeWeights.x
        + texture2D(uTerrainEarth, vMapUv) * vBiomeWeights.y
        + texture2D(uTerrainSand, vMapUv) * vBiomeWeights.z
        + texture2D(uTerrainSnow, vMapUv) * vBiomeWeights.w;
      diffuseColor *= terrainSurfaceColor;
    `);
};
terrainMaterial.customProgramCacheKey = () => "sandbox-four-surface-terrain-v2-smooth-biomes";
terrainMaterial.needsUpdate = true;
