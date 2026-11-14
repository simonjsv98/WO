"""Raytracade bilder av stallet med Blender Cycles.

Körs med Blenders Python-modul (pip install bpy):

    python render/render.py stallet.glb sources.json utmapp [--width 1920] [--samples 256] [--only namn]

stallet.glb är exporten från visaren ("Ladda ner som GLB") och sources.json är listan
med ljuskällor (window.stallet.sources i visaren). Se README för hela flödet.
"""

import argparse
import json
import math
import os

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument("glb")
parser.add_argument("sources")
parser.add_argument("out")
parser.add_argument("--width", type=int, default=1920)
parser.add_argument("--samples", type=int, default=256)
parser.add_argument("--only", default="")
parser.add_argument("--exposure", type=float, default=-0.2)
args = parser.parse_args()

# Vyerna: kameraläge och siktpunkt i modellens koordinater (x längs soffväggen, y upp,
# z tvärs över rummet), vertikal bildvinkel i grader och delar som göms i just den vyn.
VIEWS = {
    "soffhornan": dict(position=(5.0, 1.5, 4.35), target=(5.75, 0.8, 1.3), fov=60),
    "matplatsen": dict(position=(4.3, 1.5, 3.5), target=(1.5, 0.9, 1.7), fov=58),
    "vedspisen": dict(position=(1.9, 1.35, 1.75), target=(0.55, 0.8, 0.55), fov=60),
    "kaminen": dict(position=(5.2, 1.35, 1.9), target=(3.7, 0.8, 4.5), fov=58),
    "koket": dict(position=(4.1, 1.5, 4.9), target=(0.9, 1.0, 7.2), fov=58),
    "langs-rummet": dict(position=(0.55, 1.55, 3.75), target=(6.5, 1.05, 2.4), fov=62),
    "oversikt": dict(
        position=(-4.6, 9.4, 13.6),
        target=(4.9, 0.4, 4.0),
        fov=38,
        hide=("Takbrador", "Takbjalkar", "Lysror", "Langvagg", "Koksgavel"),
    ),
}


def to_blender(p):
    """Modellen har y uppåt, Blender har z uppåt."""
    return Vector((p[0], -p[2], p[1]))


def linear(hex_color):
    def channel(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(channel((hex_color >> shift) & 255) for shift in (16, 8, 0))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.glb)
scene = bpy.context.scene

# ---------------------------------------------------------------- material

def principled(material):
    if not material.node_tree:
        return None
    for node in material.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node
    return None


def glow(material, color, strength):
    node = principled(material)
    if node:
        node.inputs["Emission Color"].default_value = (*color, 1)
        node.inputs["Emission Strength"].default_value = strength


def make_window_glass(material):
    """Tunt fönsterglas: släpper igenom ljus rakt av och speglar lite."""
    tree = material.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    mix = tree.nodes.new("ShaderNodeMixShader")
    clear = tree.nodes.new("ShaderNodeBsdfTransparent")
    gloss = tree.nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.03
    mix.inputs[0].default_value = 0.08
    tree.links.new(clear.outputs[0], mix.inputs[1])
    tree.links.new(gloss.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], out.inputs["Surface"])


WARM = linear(0xFFC58A)
for material in bpy.data.materials:
    name = material.name.split(".")[0]
    if name == "glass":
        make_window_glass(material)
    elif name == "tube":
        glow(material, (0, 0, 0), 0)  # lysrören är släckta på kvällen
    elif name == "linenShade":
        glow(material, WARM, 1.1)
    elif name == "enamelInside":
        glow(material, WARM, 1.5)
    elif name == "bulb":
        glow(material, linear(0xFFD9A0), 18)
    elif name == "flame":
        glow(material, linear(0xFFB347), 120)
    elif name == "ember":
        glow(material, (1.0, 0.16, 0.015), 1.6)

# Glödlampor och lågor ska inte skugga ljuskällan som sitter inuti dem.
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    names = {slot.material.name.split(".")[0] for slot in obj.material_slots if slot.material}
    if names & {"bulb", "flame"}:
        obj.visible_shadow = False

# ---------------------------------------------------------------- ljus

POWER = {"lamp": 0.75, "candle": 0.8, "string": 0.6, "fire": 1.3}  # watt i Blender per "glödlampswatt"
SIZE = {"lamp": 0.04, "candle": 0.008, "string": 0.02, "fire": 0.1}

with open(args.sources) as f:
    sources = json.load(f)
for i, source in enumerate(sources):
    data = bpy.data.lights.new(f"ljus-{i}", "POINT")
    data.color = linear(source["color"])
    data.energy = source["watts"] * POWER[source["kind"]]
    data.shadow_soft_size = SIZE[source["kind"]]
    lamp = bpy.data.objects.new(f"ljus-{i}", data)
    lamp.location = to_blender(source["position"])
    scene.collection.objects.link(lamp)

# Skymning utanför fönstren.
world = bpy.data.worlds.new("Skymning")
world.use_nodes = True
background = world.node_tree.nodes["Background"]
background.inputs["Color"].default_value = (0.045, 0.075, 0.17, 1)
background.inputs["Strength"].default_value = 0.8
scene.world = world

bpy.ops.mesh.primitive_plane_add(size=300, location=(5, -4, -0.16))
grass = bpy.data.materials.new("Mark")
grass.use_nodes = True
principled(grass).inputs["Base Color"].default_value = (0.03, 0.05, 0.03, 1)
bpy.context.object.data.materials.append(grass)

# ---------------------------------------------------------------- rendering

scene.render.engine = "CYCLES"
cycles = scene.cycles
cycles.device = "CPU"
cycles.samples = args.samples
cycles.use_adaptive_sampling = True
cycles.adaptive_threshold = 0.03
cycles.use_denoising = True
cycles.max_bounces = 8
cycles.diffuse_bounces = 5
cycles.glossy_bounces = 4
cycles.transparent_max_bounces = 8
cycles.sample_clamp_indirect = 6
cycles.caustics_reflective = False
cycles.caustics_refractive = False
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * 9 / 16)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = args.exposure


def descendants(obj):
    for child in obj.children:
        yield child
        yield from descendants(child)


def set_hidden(names):
    for obj in bpy.data.objects:
        obj.hide_render = False
    for obj in bpy.data.objects:
        if obj.name.split(".")[0] in names:
            obj.hide_render = True
            for child in descendants(obj):
                child.hide_render = True


camera_data = bpy.data.cameras.new("Kamera")
camera = bpy.data.objects.new("Kamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.sensor_fit = "VERTICAL"
camera_data.clip_start = 0.05

os.makedirs(args.out, exist_ok=True)
for name, view in VIEWS.items():
    if args.only and name not in args.only.split(","):
        continue
    position = to_blender(view["position"])
    direction = to_blender(view["target"]) - position
    camera.location = position
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.angle_y = math.radians(view["fov"])
    set_hidden(set(view.get("hide", ())))
    scene.render.filepath = os.path.join(args.out, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("klar:", name, flush=True)
