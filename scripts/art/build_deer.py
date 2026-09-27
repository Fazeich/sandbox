"""Replace the deer in an open Portfolio-models scene and export its game GLB.

Run with Blender in the background:
  blender Portfolio-models.blend --background --python scripts/art/build_deer.py -- --save-as reviewed.blend --render-preview deer.png
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ART_ROOT = PROJECT_ROOT / "src" / "pages" / "Sandbox" / "lib" / "art"
COAT_PATH = ART_ROOT / "textures" / "deer_coat.png"
GLB_PATH = ART_ROOT / "models" / "deer.glb"


def parent_keep_world(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def material(name, color, image_path=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.94
    for link in list(mat.node_tree.links):
        if link.to_node == shader and link.to_socket == shader.inputs["Base Color"]:
            mat.node_tree.links.remove(link)
    if image_path:
        image = bpy.data.images.load(str(image_path), check_existing=False)
        image.name = "Deer_Coat_Adult"
        image.colorspace_settings.name = "sRGB"
        tex = next((node for node in nodes if node.type == "TEX_IMAGE"), None) or nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.extension = "REPEAT"
        mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    return mat


def empty(name, location, collection, parent=None):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = location
    if parent:
        parent_keep_world(obj, parent)
    return obj


def loft(name, rings, collection, parent, coat, cream=None, sides=12):
    """Low-poly elliptical sections along Blender Y, with an integrated pale underside."""
    vertices = []
    for y, cx, cz, rx, rz in rings:
        for side in range(sides):
            theta = side * 2 * math.pi / sides
            vertices.append((cx + math.sin(theta) * rx, y, cz + math.cos(theta) * rz))
    faces = []
    for ring in range(len(rings) - 1):
        for side in range(sides):
            next_side = (side + 1) % sides
            faces.append((ring * sides + side, (ring + 1) * sides + side,
                          (ring + 1) * sides + next_side, ring * sides + next_side))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(rings) - 1) * sides + side for side in range(sides)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(coat)
    if cream:
        mesh.materials.append(cream)
    uv = mesh.uv_layers.new(name="FurUV")
    side_faces = (len(rings) - 1) * sides
    for polygon in mesh.polygons:
        if polygon.index < side_faces:
            side = polygon.index % sides
            if cream and math.cos((side + 0.5) * 2 * math.pi / sides) < -0.53:
                polygon.material_index = 1
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            ring_index, side_index = divmod(vertex_index, sides)
            u = side_index / sides
            if polygon.index < side_faces and polygon.index % sides == sides - 1 and side_index == 0:
                u = 1
            uv.data[loop_index].uv = (u, ring_index / max(1, len(rings) - 1))
        polygon.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    parent_keep_world(obj, parent)
    return obj


def segment(name, start, end, radius_start, radius_end, mat, collection, parent, sides=9):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius_start,
                                    radius2=radius_end, depth=direction.length,
                                    location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    parent_keep_world(obj, parent)
    return obj


def ellipsoid(name, location, scale, mat, collection, parent, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    parent_keep_world(obj, parent)
    return obj


def ear(side, collection, parent, coat, inner):
    x = side
    vertices = [
        (x * 0.16, -1.46, 2.45),
        (x * 0.39, -1.32, 2.57),
        (x * 0.64, -1.24, 2.69),
        (x * 0.43, -1.56, 2.52),
        (x * 0.40, -1.59, 2.57),
        (x * 0.40, -1.38, 2.58),
    ]
    mesh = bpy.data.meshes.new(f"DeerEar{'L' if side < 0 else 'R'}_Mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2), (0, 2, 3), (0, 4, 2), (0, 2, 5)])
    mesh.materials.append(coat)
    mesh.materials.append(inner)
    mesh.polygons[2].material_index = 1
    mesh.update()
    obj = bpy.data.objects.new(f"DeerEar{'L' if side < 0 else 'R'}", mesh)
    collection.objects.link(obj)
    parent_keep_world(obj, parent)
    return obj


def hoof(name, side, x, y, collection, parent, dark):
    for split in (-1, 1):
        ellipsoid(f"{name}_Hoof_{split:+d}", (x + split * 0.049, y - 0.047, 0.075),
                  (0.047, 0.115, 0.072), dark, collection, parent, 8, 4)


def leg(name, side, front, collection, root, coat, darker, hoof_mat):
    x = side * 0.285
    y = -0.63 if front else 0.67
    hip_z = 1.18 if front else 1.16
    group = empty(name, (x, y, hip_z), collection, root)
    if front:
        points = [(x, y, hip_z), (x * 1.03, y - 0.08, 0.69),
                  (x * 1.1, y - 0.03, 0.28), (x * 1.13, y - 0.06, 0.14)]
        radii = [(0.15, 0.095), (0.083, 0.055), (0.054, 0.044)]
    else:
        points = [(x, y, hip_z), (x * 1.10, y - 0.24, 0.76),
                  (x * 1.15, y + 0.11, 0.42), (x * 1.2, y + 0.01, 0.14)]
        radii = [(0.20, 0.12), (0.092, 0.067), (0.058, 0.044)]
    for index, (start, end) in enumerate(zip(points, points[1:])):
        segment(f"{name}_Part{index}", start, end, *radii[index],
                coat if index < 2 else darker, collection, group)
    ellipsoid(f"{name}_Knee", points[1], (0.105, 0.11, 0.11), coat, collection, group, 9, 6)
    hoof(name, side, points[-1][0], points[-1][1], collection, group, hoof_mat)
    return group


def antlers(collection, head, antler_mat):
    pieces = []
    for side in (-1, 1):
        x = lambda value: side * value
        beam = [
            (x(0.15), -1.46, 2.45), (x(0.25), -1.40, 2.67),
            (x(0.37), -1.24, 2.89), (x(0.52), -1.10, 3.15),
            (x(0.67), -0.99, 3.43),
        ]
        for index, (start, end) in enumerate(zip(beam, beam[1:])):
            pieces.append(segment(f"DeerAntlerBeam_{side}_{index}", start, end,
                                  0.075 - index * 0.014, 0.060 - index * 0.014,
                                  antler_mat, collection, head, 8))
        tines = [
            (beam[1], (x(0.28), -1.75, 2.91), 0.039),
            (beam[2], (x(0.44), -1.55, 3.16), 0.035),
            (beam[3], (x(0.75), -1.25, 3.34), 0.030),
        ]
        for index, (start, end, radius) in enumerate(tines):
            pieces.append(segment(f"DeerAntlerTine_{side}_{index}", start, end,
                                  radius, 0.004, antler_mat, collection, head, 7))
    return pieces


def clear_old_deer():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(("Deer", "Leg_", "Preview_Deer", "Preview_Leg_")):
            bpy.data.objects.remove(obj, do_unlink=True)


def create_deer(collection):
    clear_old_deer()
    coat = material("Deer_Coat_Bright", (0.55, 0.31, 0.16), COAT_PATH)
    cream = material("Deer_Cream", (0.80, 0.71, 0.55))
    dark = material("Deer_Hooves_Nose", (0.105, 0.085, 0.065))
    antler_mat = material("Deer_Antlers", (0.23, 0.14, 0.08))
    inner = material("Deer_InnerEar", (0.61, 0.37, 0.28))
    eye = material("Deer_Eyes", (0.045, 0.034, 0.027))
    leg_brown = material("Deer_Leg_Brown", (0.35, 0.205, 0.105))
    root = empty("DeerRoot", (0, 0, 0), collection)

    loft("DeerBody", [
        (1.02, 0, 1.35, 0.08, 0.12), (0.79, 0, 1.38, 0.30, 0.33),
        (0.43, 0, 1.38, 0.39, 0.39), (0.02, 0, 1.39, 0.37, 0.37),
        (-0.43, 0, 1.43, 0.37, 0.40), (-0.75, 0, 1.45, 0.32, 0.43),
        (-0.95, 0, 1.46, 0.17, 0.27),
    ], collection, root, coat, cream)
    loft("DeerNeck", [
        (-0.69, 0, 1.45, 0.27, 0.28), (-0.91, 0, 1.66, 0.25, 0.28),
        (-1.15, 0, 1.99, 0.19, 0.24), (-1.42, 0, 2.27, 0.15, 0.18),
    ], collection, root, coat, None, 10)
    segment("DeerTail", (0, 0.94, 1.55), (0, 1.22, 1.67), 0.105, 0.015,
            cream, collection, root, 8)
    head = empty("DeerHead", (0, -1.42, 2.27), collection, root)
    loft("DeerHeadMesh", [
        (-1.38, 0, 2.30, 0.16, 0.17), (-1.52, 0, 2.33, 0.22, 0.22),
        (-1.69, 0, 2.28, 0.19, 0.18), (-1.84, 0, 2.18, 0.135, 0.12),
        (-1.99, 0, 2.13, 0.09, 0.07),
    ], collection, head, coat, None, 10)
    ellipsoid("DeerNose", (0, -2.015, 2.145), (0.085, 0.055, 0.045),
              dark, collection, head, 10, 6)
    for side in (-1, 1):
        ear(side, collection, head, coat, inner)
        ellipsoid(f"DeerEyePatch_{side}", (side * 0.197, -1.675, 2.35),
                  (0.025, 0.052, 0.05), leg_brown, collection, head, 9, 6)
        ellipsoid(f"DeerEye_{side}", (side * 0.221, -1.685, 2.36),
                  (0.018, 0.029, 0.029), eye, collection, head, 9, 6)
    antlers(collection, head, antler_mat)
    for side, label in [(-1, "Left"), (1, "Right")]:
        leg(f"Leg_Front{label}", side, True, collection, root, coat, leg_brown, dark)
        leg(f"Leg_Back{label}", side, False, collection, root, coat, leg_brown, dark)
    root["design_style"] = "Adult low-poly red deer with articulated legs"
    return root


def preview_copy(root, collection):
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
    copies[root].location = (7.8, 0, 0)


def export_deer(root):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root, *root.children_recursive]:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB_PATH), export_format="GLB", use_selection=True,
                              export_apply=True, export_materials="EXPORT", export_image_format="AUTO",
                              export_animations=False, export_cameras=False, export_lights=False)
    bpy.ops.object.select_all(action="DESELECT")


def render_preview(root, path):
    scene = bpy.context.scene
    for obj in scene.objects:
        obj.hide_render = obj not in [root, *root.children_recursive]
    for obj in [root, *root.children_recursive]:
        obj.hide_render = False
    bpy.ops.object.camera_add(location=(4.2, -6.3, 3.4))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, -0.2, 1.62)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.9
    scene.camera = camera
    camera.hide_render = False
    bpy.ops.object.light_add(type="AREA", location=(-3, -4, 7))
    light = bpy.context.object
    light.data.energy = 900
    light.data.shape = "DISK"
    light.data.size = 5
    light.rotation_euler = (Vector((0, 0, 1.5)) - light.location).to_track_quat("-Z", "Y").to_euler()
    light.hide_render = False
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    scene.world.color = (0.6, 0.68, 0.66)
    bpy.ops.render.render(write_still=True)


def args_after_separator():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def main():
    args = args_after_separator()
    collection = bpy.data.collections.get("Stylized Terrain Preview")
    if collection is None:
        collection = bpy.data.collections.new("Stylized Terrain Preview")
        bpy.context.scene.collection.children.link(collection)
    root = create_deer(collection)
    export_deer(root)
    preview_copy(root, collection)
    for obj in [root, *root.children_recursive]:
        obj.hide_render = True
        obj.hide_set(True)
    bpy.ops.file.pack_all()
    output = Path(args[args.index("--save-as") + 1]) if "--save-as" in args else Path(bpy.data.filepath)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    if "--render-preview" in args:
        render_preview(root, Path(args[args.index("--render-preview") + 1]))
    print("DEER_ASSET", {"blend": str(output), "glb": str(GLB_PATH),
                          "named_legs": [o.name for o in root.children_recursive if o.name.startswith("Leg_") and o.type == "EMPTY"]})


if __name__ == "__main__":
    main()
