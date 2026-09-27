"""Export the active Portfolio-models.blend deer and all forest variants for Sandbox.

Run from the connected Blender scene. Source object positions and selection are restored.
"""

from pathlib import Path

import bpy


MODEL_DIR = Path(r"C:\Users\travn1k\Desktop\projects\portfolio\src\pages\Sandbox\lib\art\models")
TREE_ROOTS = ("Oak_Spreading", "Birch_Forked", "Rowan_Fan", "Oak_Windswept")
ORIGINAL_TREES = ("BirchTrunk", "BirchCanopy", "OakTrunk", "OakCanopy")


def export_models():
    if Path(bpy.data.filepath).name.lower() != "portfolio-models.blend":
        raise RuntimeError("Open Portfolio-models.blend before exporting")
    required = (*TREE_ROOTS, *ORIGINAL_TREES, "DeerRoot", "Deer_Rig")
    missing = [name for name in required if name not in bpy.data.objects]
    if missing:
        raise RuntimeError(f"Missing source objects: {missing}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    selected = tuple(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    roots = [bpy.data.objects[name] for name in (*TREE_ROOTS, "DeerRoot")]
    locations = {root.name: root.location.copy() for root in roots}
    visibility = {
        name: (bpy.data.objects[name].hide_get(), bpy.data.objects[name].hide_render)
        for name in ORIGINAL_TREES
    }
    try:
        for root in roots:
            root.location = (0, 0, 0)
        for name in ORIGINAL_TREES:
            obj = bpy.data.objects[name]
            obj.hide_set(False)
            obj.hide_render = False
        bpy.context.view_layer.update()

        bpy.ops.object.select_all(action="DESELECT")
        for name in ORIGINAL_TREES:
            bpy.data.objects[name].select_set(True)
        for name in TREE_ROOTS:
            root = bpy.data.objects[name]
            root.select_set(True)
            for child in root.children_recursive:
                child.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(MODEL_DIR / "forest_trees.glb"),
            export_format="GLB",
            use_selection=True,
            export_animations=False,
        )

        bpy.ops.object.select_all(action="DESELECT")
        deer = bpy.data.objects["DeerRoot"]
        deer.select_set(True)
        for child in deer.children_recursive:
            child.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(MODEL_DIR / "deer.glb"),
            export_format="GLB",
            use_selection=True,
            export_animations=True,
            export_animation_mode="ACTIONS",
            export_skins=True,
        )
    finally:
        for root in roots:
            root.location = locations[root.name]
        for name, (hidden, hidden_render) in visibility.items():
            obj = bpy.data.objects[name]
            obj.hide_set(hidden)
            obj.hide_render = hidden_render
        bpy.ops.object.select_all(action="DESELECT")
        for obj in selected:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active
        bpy.context.view_layer.update()

    for name in ("forest_trees.glb", "deer.glb"):
        path = MODEL_DIR / name
        print(f"Exported {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    export_models()
