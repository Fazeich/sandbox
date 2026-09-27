"""Restore the original forest trees and refresh survival-world assets.

Run with:
  blender Portfolio-models-before-stylized.blend --background --python scripts/art/build_stylized_assets.py -- --save-as reviewed.blend --render-preview preview.png
"""

from __future__ import annotations

import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ART_ROOT = PROJECT_ROOT / "src" / "pages" / "Sandbox" / "lib" / "art"
TEXTURES_ROOT = ART_ROOT / "textures"
TREE_TEXTURES = TEXTURES_ROOT / "trees"
SURFACE_TEXTURES = TEXTURES_ROOT / "surfaces"
MODEL_ROOT = ART_ROOT / "models"
create_deer = runpy.run_path(str(Path(__file__).with_name("build_deer.py")))["create_deer"]

OAK_LEAF_MAP = TREE_TEXTURES / "oak_leaves.png"
SURFACE_MAPS = {
    "Earth": SURFACE_TEXTURES / "earth.png",
    "Snow": SURFACE_TEXTURES / "snow.png",
    "Sand": SURFACE_TEXTURES / "sand.png",
    "Grass": SURFACE_TEXTURES / "grass.png",
}


def generated_objects_collection():
    collection = bpy.data.collections.get("Stylized Terrain Preview")
    if collection is None:
        collection = bpy.data.collections.new("Stylized Terrain Preview")
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def clear_generated_objects():
    prefixes = (
        "Preview_", "Rock_Stylized", "OakWide", "AppleOak",
        "AppleRoot", "AppleFruit", "AppleStem", "AppleLeaf", "DeerRoot", "DeerBody",
        "DeerCoat", "DeerCream", "DeerDark", "DeerAntlers", "DeerHead", "Leg_Front",
        "Leg_Back", "Preview_Surface_",
    )
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefixes) or obj.name.startswith("Spruce"):
            bpy.data.objects.remove(obj, do_unlink=True)


def clear_spruce_materials():
    for material in list(bpy.data.materials):
        if material.name.startswith("Tree_Spruce"):
            bpy.data.materials.remove(material, do_unlink=True)
    for image in list(bpy.data.images):
        if "spruce" in image.name.lower():
            bpy.data.images.remove(image, do_unlink=True)


def load_image(path: Path, name: str):
    if not path.exists():
        raise FileNotFoundError(f"Missing generated texture: {path}")
    # Force a fresh read so a changed source PNG cannot be shadowed by a packed image from the .blend.
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = "sRGB"
    return image


def set_image_material(material, image):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    output = next((node for node in nodes if node.type == "OUTPUT_MATERIAL"), None)
    shader = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    image_node = next((node for node in nodes if node.type == "TEX_IMAGE"), None)
    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")
    if shader is None:
        shader = nodes.new("ShaderNodeBsdfPrincipled")
    if image_node is None:
        image_node = nodes.new("ShaderNodeTexImage")
    for link in list(material.node_tree.links):
        if link.to_node == shader and link.to_socket == shader.inputs["Base Color"]:
            material.node_tree.links.remove(link)

    image_node.image = image
    image_node.extension = "REPEAT"
    image_node.interpolation = "Linear"
    image_node.location = (-420, 80)
    shader.location = (-120, 80)
    output.location = (180, 80)
    shader.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    shader.inputs["Roughness"].default_value = 0.86
    material.node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
    if not any(link.from_node == shader and link.to_node == output for link in material.node_tree.links):
        material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])


def image_material(name: str, path: Path):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (0.86, 0.86, 0.86, 1.0)
    set_image_material(material, load_image(path, f"Texture_{name}"))
    return material


def solid_material(name: str, color):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.9
    return material


def update_oak_leaf_material():
    material = bpy.data.materials.get("Tree_Oak_Foliage")
    if material is None:
        raise RuntimeError("The original oak foliage material is missing")
    set_image_material(material, load_image(OAK_LEAF_MAP, "Restored_Oak_Foliage"))


def validate_original_trees():
    expected = {
        "BirchTrunk": (286, 143), "BirchCanopy": (132, 220),
        "OakTrunk": (304, 152), "OakCanopy": (168, 280),
    }
    for name, counts in expected.items():
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH" or (len(obj.data.vertices), len(obj.data.polygons)) != counts:
            raise RuntimeError(f"Expected an unchanged original tree mesh: {name} {counts}")


def add_cone_between(name, start, end, radius_start, radius_end, material, collection, sides=8):
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cone_add(
        vertices=sides,
        radius1=radius_start,
        radius2=radius_end,
        depth=direction.length,
        location=(start + end) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_ellipsoid(name, location, scale, material, collection, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def join_meshes(objects, name, material, collection):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    active.data.name = f"{name}_Mesh"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    active.data.materials.clear()
    active.data.materials.append(material)
    move_to_collection(active, collection)
    for polygon in active.data.polygons:
        polygon.use_smooth = False
    if not active.data.uv_layers:
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(island_margin=0.015)
        bpy.ops.object.mode_set(mode="OBJECT")
    return active


def parent_keep_world(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def add_empty(name, location, collection, parent=None):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def create_apple(collection):
    apple_material = image_material("Apple_Skin_Bright", TEXTURES_ROOT / "apple_skin.png")
    stem_material = solid_material("Apple_Stem_WarmBrown", (0.19, 0.105, 0.045))
    leaf_material = solid_material("Apple_Leaf_Lime", (0.2, 0.48, 0.13))
    root = add_empty("AppleRoot", (0, 0, 0), collection)

    fruit = add_ellipsoid("AppleFruit", (0, 0, 0.19), (0.18, 0.165, 0.2), apple_material, collection, 14, 10)
    for vertex in fruit.data.vertices:
        z = vertex.co.z + 0.19
        if z > 0.32:
            vertex.co.z -= (z - 0.32) * 0.2
        if z < 0.045:
            vertex.co.z += (0.045 - z) * 0.12
    fruit.data.update()
    stem = add_cone_between("AppleStem", (0, 0, 0.355), (0.015, 0.005, 0.45), 0.018, 0.01, stem_material, collection, 6)
    leaf = add_ellipsoid("AppleLeaf", (0.055, 0.005, 0.405), (0.075, 0.032, 0.008), leaf_material, collection, 8, 4)
    leaf.rotation_euler[1] = -0.35
    bpy.context.view_layer.objects.active = leaf
    leaf.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    for obj in (fruit, stem, leaf):
        parent_keep_world(obj, root)
    return root


def create_rock(collection, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(11.6, -1.8, 0.0))
    rock = bpy.context.object
    rock.name = "Rock_Stylized"
    for vertex in rock.data.vertices:
        point = vertex.co.copy()
        variation = 1.0 + 0.075 * math.sin(point.x * 5.7 + point.y * 2.1) + 0.035 * math.cos(point.z * 7.0 - point.x)
        vertex.co.x = point.x * 1.35 * variation
        vertex.co.y = point.y * 1.15 * variation
        vertex.co.z = point.z * 0.82 * variation + 0.045 * math.sin(point.x * 4.3 + point.y * 3.7)
    min_z = min(vertex.co.z for vertex in rock.data.vertices)
    for vertex in rock.data.vertices:
        vertex.co.z -= min_z
    rock.data.materials.append(material)
    bpy.context.view_layer.objects.active = rock
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    rock["design_style"] = "Bright cartoon low-poly stone"
    move_to_collection(rock, collection)
    return rock


def create_surface_previews(collection):
    materials = {label: image_material(f"Terrain_{label}_Bright", path) for label, path in SURFACE_MAPS.items()}
    for index, label in enumerate(("Earth", "Snow", "Sand", "Grass")):
        bpy.ops.mesh.primitive_plane_add(size=3.0, location=(-5.4 + index * 3.6, -8.0, 0.035))
        obj = bpy.context.object
        obj.name = f"Preview_Surface_{label}"
        obj.data.name = f"PreviewMesh_{label}"
        obj.data.materials.append(materials[label])
        move_to_collection(obj, collection)
    return materials


def duplicate_tree_preview(name, x, collection):
    previews = []
    for source_name in (f"{name}Trunk", f"{name}Canopy"):
        source = bpy.data.objects.get(source_name)
        preview = source.copy()
        preview.data = source.data
        preview.name = f"Preview_{source_name}"
        preview.location = (x, 0.0, 0.0)
        preview.hide_render = False
        preview.hide_set(False)
        collection.objects.link(preview)
        previews.append(preview)
    return previews


def duplicate_group_preview(root, name, location, collection):
    originals = [root, *root.children_recursive]
    copies = {obj: obj.copy() for obj in originals}
    for obj, duplicate in copies.items():
        if obj.data is not None:
            duplicate.data = obj.data
        duplicate.name = f"Preview_{obj.name}"
        duplicate.hide_render = False
        duplicate.hide_set(False)
        collection.objects.link(duplicate)
        if obj.parent in copies:
            duplicate.parent = copies[obj.parent]
            duplicate.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
        duplicate.matrix_basis = obj.matrix_basis.copy()
    copies[root].location = location
    return copies[root]


def export_selected(filepath: Path, objects):
    filepath.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def export_tree_models():
    names = [
        "BirchTrunk", "BirchCanopy", "OakTrunk", "OakCanopy",
    ]
    objects = [bpy.data.objects.get(name) for name in names]
    if any(obj is None for obj in objects):
        missing = [name for name, obj in zip(names, objects) if obj is None]
        raise RuntimeError(f"Missing tree meshes: {', '.join(missing)}")
    export_selected(MODEL_ROOT / "forest_trees.glb", objects)
    return objects


def export_group(filepath, root):
    return export_selected(filepath, [root, *root.children_recursive])


def tune_preview_lighting():
    scene = bpy.context.scene
    target = Vector((1.0, -4.0, 3.15))
    camera = scene.camera
    camera.location = (4.0, -35.0, 18.5)
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 37.5

    if scene.world is not None:
        scene.world.use_nodes = True
        background = next(node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND")
        background.inputs["Color"].default_value = (0.48, 0.61, 0.68, 1.0)
        background.inputs["Strength"].default_value = 0.68

    for name, location, power, size in [
        ("Stylized_Key", (-6.0, -12.0, 18.0), 2200.0, 10.0),
        ("Stylized_Fill", (13.0, -1.0, 12.0), 1250.0, 11.0),
    ]:
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        light_data = bpy.data.lights.new(name, type="AREA")
        light_data.energy = power
        light_data.shape = "DISK"
        light_data.size = size
        light_obj = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light_obj)
        light_obj.location = location
        light_obj.rotation_euler = (target - light_obj.location).to_track_quat("-Z", "Y").to_euler()

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 920
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"


def cli_args():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def main():
    args = cli_args()
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    validate_original_trees()
    collection = generated_objects_collection()
    clear_generated_objects()
    clear_spruce_materials()
    update_oak_leaf_material()

    apple_root = create_apple(collection)
    deer_root = create_deer(collection)
    create_surface_previews(collection)
    rock = create_rock(collection, image_material("Rock_Stone_Bright", TEXTURES_ROOT / "rock_surface.png"))

    # Export the original birch and oak geometry without rebuilding either tree.
    birch_sources = [bpy.data.objects[name] for name in ("BirchTrunk", "BirchCanopy")]
    oak_sources = [bpy.data.objects[name] for name in ("OakTrunk", "OakCanopy")]
    tree_objects = [*birch_sources, *oak_sources]
    export_selected(MODEL_ROOT / "forest_trees.glb", tree_objects)
    export_group(MODEL_ROOT / "apple.glb", apple_root)
    export_group(MODEL_ROOT / "deer.glb", deer_root)
    export_selected(MODEL_ROOT / "rock.glb", [rock])

    preview_positions = {"Birch": -6.0, "Oak": 0.0}
    for name, x in preview_positions.items():
        duplicate_tree_preview(name, x, collection)
    duplicate_group_preview(deer_root, "Deer", (7.8, 0.0, 0.0), collection)

    for obj in [*tree_objects, rock, apple_root, deer_root, *apple_root.children_recursive, *deer_root.children_recursive]:
        obj.hide_render = True
        obj.hide_set(True)
    starter_cube = bpy.data.objects.get("Cube")
    if starter_cube is not None:
        starter_cube.hide_render = True
        starter_cube.hide_set(True)

    tune_preview_lighting()
    bpy.ops.file.pack_all()
    output = next((Path(args[index + 1]) for index, arg in enumerate(args[:-1]) if arg == "--save-as"), Path(bpy.data.filepath))
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)

    if "--render-preview" in args:
        preview_path = Path(args[args.index("--render-preview") + 1])
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(preview_path)
        bpy.ops.render.render(write_still=True)

    print("STYLIZED_ASSETS", {
        "blend": str(output),
        "tree_glb": str(MODEL_ROOT / "forest_trees.glb"),
        "apple_glb": str(MODEL_ROOT / "apple.glb"),
        "deer_glb": str(MODEL_ROOT / "deer.glb"),
        "rock_glb": str(MODEL_ROOT / "rock.glb"),
        "tree_models": [obj.name for obj in tree_objects],
        "spruce_objects": [obj.name for obj in bpy.data.objects if "spruce" in obj.name.lower()],
    })


if __name__ == "__main__":
    main()
