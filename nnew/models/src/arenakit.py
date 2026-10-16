"""Shared building blocks for the low-poly raid arenas (static meshes, no textures).
Arena units = metres = js/arena.js units: the fight circle has radius 10.5 with its top at z = 0, and +Y (Blender) is the
arena's "north" (three.js -Z after glTF export, where the boss faces at heading 0)."""
import bpy, bmesh, math, os, random
from mathutils import Vector as V, Matrix, Euler, noise
from bossgen import Mesh, material, basis

TAU = math.tau
NONE = 'x'  # dummy deform group name for static geometry


def nz(x, y, s=1., seed=0.):
    return noise.noise(V((x * s + seed, y * s - seed, seed * .37)))


# ---------------------------------------------------------------- primitives
def slab(m, a0, a1, r0, r1, z, th, mat, gap=.04, seg=None, jitter=0., rnd=None):
    """Curved stone slab between angles a0..a1 and radii r0..r1, top at z, thickness th."""
    seg = seg or max(1, int((a1 - a0) * r1 / .5))
    rr0, rr1 = r0 + gap, r1 - gap
    ga0, ga1 = a0 + gap / max(r0, .5), a1 - gap / max(r0, .5)
    top, bot = [], []
    for i in range(seg + 1):
        a = ga0 + (ga1 - ga0) * i / seg
        for r in (rr0, rr1):
            dz = (rnd.random() - .5) * jitter if rnd else 0
            top.append(V((math.cos(a) * r, math.sin(a) * r, z + dz)))
            bot.append(V((math.cos(a) * r, math.sin(a) * r, z - th)))
    n = len(top)
    verts = top + bot
    faces = []
    for i in range(seg):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        faces.append([a, b, c, d])                      # top (counter-clockwise from above: normal up)
        faces.append([n + d, n + c, n + b, n + a])      # bottom
        faces.append([a, d, n + d, n + a])          # inner wall
        faces.append([b, n + b, n + c, c])          # outer wall
    faces.append([0, n, n + 1, 1])
    faces.append([2 * seg, 2 * seg + 1, n + 2 * seg + 1, n + 2 * seg])
    return m.add(verts, faces, mat, NONE)


def ring_strip(m, r, w, z, mat, segs=96, a0=0., a1=TAU, th=.02):
    """Thin flat ring band (inlays, rune rings)."""
    return slab(m, a0, a1, r - w / 2, r + w / 2, z, th, mat, gap=0, seg=segs)


def disc(m, r, z, mat, segs=48, c=(0, 0)):
    verts = [V((c[0] + math.cos(i / segs * TAU) * r, c[1] + math.sin(i / segs * TAU) * r, z)) for i in range(segs)] + [V((c[0], c[1], z))]
    return m.add(verts, [[i, (i + 1) % segs, segs] for i in range(segs)], mat, NONE)


def cyl(m, r0, r1, z0, z1, mat, segs=48, c=(0, 0), cap=True, jitter=0., seed=0):
    rnd = random.Random(seed)
    verts = []
    for z, r in ((z0, r0), (z1, r1)):
        for i in range(segs):
            a = i / segs * TAU
            k = 1 + (rnd.random() - .5) * jitter
            verts.append(V((c[0] + math.cos(a) * r * k, c[1] + math.sin(a) * r * k, z)))
    faces = [[i, (i + 1) % segs, segs + (i + 1) % segs, segs + i] for i in range(segs)]
    if cap:
        faces += [list(range(segs))[::-1], [segs + i for i in range(segs)]]
    return m.add(verts, faces, mat, NONE)


def box(m, c, size, mat, rot=(0, 0, 0)):
    return m.box(V(c), size, mat, NONE, rot=rot)


def prism(m, p0, p1, r0, r1, mat, sides=6, flat=(1, 1)):
    return m.prism(V(p0), V(p1), r0, r1, mat, NONE, sides, flat=flat)


def rock(m, c, r, mat, seed=0, squash=(1, 1, .7), sub=0):
    return m.ico(V(c), r, mat, NONE, sub, squash, jitter=.45, seed=seed)


def ground_disc(m, r_in, r_out, z, mat, rings=14, segs=72, amp=.35, seed=1., drop=0.):
    """Radial grid ground between r_in and r_out, displaced with noise; drop lowers it towards the outside."""
    verts, faces = [], []
    for j in range(rings + 1):
        r = r_in + (r_out - r_in) * (j / rings) ** 1.6
        for i in range(segs):
            a = i / segs * TAU
            x, y = math.cos(a) * r, math.sin(a) * r
            k = min(1, (r - r_in) / 3)
            verts.append(V((x, y, z + nz(x, y, .12, seed) * amp * k - drop * (r - r_in) / (r_out - r_in))))
    for j in range(rings):
        for i in range(segs):
            faces.append([j * segs + i, j * segs + (i + 1) % segs, (j + 1) * segs + (i + 1) % segs, (j + 1) * segs + i])
    return m.add(verts, faces, mat, NONE)


def height_at(x, y, z, amp=.35, seed=1., r_in=12.):
    r = math.hypot(x, y)
    return z + nz(x, y, .12, seed) * amp * min(1, max(0, r - r_in) / 3)


# ---------------------------------------------------------------- props
def headstone(m, x, y, z, rot, kind, mat, rnd):
    R = Matrix.Translation((x, y, z)) @ Euler((rnd.uniform(-.18, .18), rnd.uniform(-.12, .12), rot)).to_matrix().to_4x4()
    g = lambda p: R @ V(p)
    h = rnd.uniform(.7, 1.3)
    if kind == 0:  # rounded slab
        m.box(g((0, 0, h / 2 - .1)), (.6, .14, h), mat, NONE, rot=(rnd.uniform(-.18, .18), 0, rot))
        m.prism(g((0, -.07, h - .1)), g((0, .07, h - .1)), .3, .3, mat, NONE, 8)
    elif kind == 1:  # cross
        m.prism(g((0, 0, -.1)), g((0, 0, h + .3)), .07, .07, mat, NONE, 4)
        m.prism(g((-.3, 0, h - .05)), g((.3, 0, h - .05)), .06, .06, mat, NONE, 4)
    else:  # obelisk
        m.prism(g((0, 0, -.1)), g((0, 0, h * 1.4)), .18, .1, mat, NONE, 4)
        m.prism(g((0, 0, h * 1.4)), g((0, 0, h * 1.4 + .3)), .1, 0, mat, NONE, 4)
        m.box(g((0, 0, .05)), (.5, .5, .3), mat, NONE, rot=(0, 0, rot))


def dead_tree(m, x, y, z, h, mat, rnd, depth=4):
    def branch(p, d, L, r, k):
        e = p + d * L
        m.prism(p, e, r, r * .62, mat, NONE, 5)
        if k == 0 or r < .025:
            return
        for _ in range(2 if k < depth else 3):
            nd = (d + V((rnd.uniform(-.9, .9), rnd.uniform(-.9, .9), rnd.uniform(-.1, .5)))).normalized()
            branch(e, nd, L * rnd.uniform(.55, .8), r * .62, k - 1)
    lean = V((rnd.uniform(-.25, .25), rnd.uniform(-.25, .25), 1)).normalized()
    branch(V((x, y, z - .3)), lean, h * .45, h * .045, depth)


def pine(m, x, y, z, h, mat, rnd):
    m.prism(V((x, y, z - .2)), V((x, y, z + h * .3)), h * .03, h * .025, mat, NONE, 5)
    for k in range(3):
        b = z + h * (.22 + k * .24)
        m.prism(V((x, y, b)), V((x, y, b + h * .42)), h * (.2 - k * .05), 0, mat, NONE, 6)


def spire(m, x, y, z, w, h, mat, rnd, rot=0.):
    """Gothic tower: square shaft, pointed roof, side pinnacles."""
    R = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot, 4, 'Z')
    g = lambda p: R @ V(p)
    m.box(g((0, 0, h * .35)), (w, w, h * .7), mat, NONE, rot=(0, 0, rot))
    m.prism(g((0, 0, h * .7)), g((0, 0, h)), w * .72, 0, mat, NONE, 4)
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        m.prism(g((sx * w * .5, sy * w * .5, h * .55)), g((sx * w * .5, sy * w * .5, h * .82)), w * .12, 0, mat, NONE, 4)
    if rnd.random() < .5:
        m.box(g((0, -w * .51, h * .45)), (w * .3, .05, h * .14), mat, NONE, rot=(0, 0, rot))


def hooded(m, x, y, z, rot, robe, plinth, rnd, h=2.2, arms=None):
    """Hooded figure (statue or cultist): flared robe, tall pointed hood, optional raised arms."""
    R = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot, 4, 'Z')
    g = lambda p: R @ V(p)
    if plinth:
        m.box(g((0, 0, .35)), (1.0, 1.0, .7), plinth, NONE, rot=(0, 0, rot))
        z0 = .7
    else:
        z0 = 0
    m.prism(g((0, 0, z0)), g((0, 0, z0 + h * .62)), h * .3, h * .14, robe, NONE, 8)
    m.prism(g((0, 0, z0 + h * .58)), g((0, 0, z0 + h * .72)), h * .15, h * .12, robe, NONE, 8)
    m.prism(g((0, .02, z0 + h * .68)), g((0, .1, z0 + h * 1.08)), h * .11, 0, robe, NONE, 6)  # tall pointed hood
    if arms:
        for s in (1, -1):
            up = arms * (1 if s > 0 else rnd.uniform(.4, 1))
            m.prism(g((s * h * .12, 0, z0 + h * .56)), g((s * h * (.24 + .1 * up), -h * .1, z0 + h * (.5 + .38 * up))), h * .05, h * .035, robe, NONE, 5)


def sky_dome(m, r, bands, segs=40, z0=-30):
    """Inverted dome in latitude bands: bands = [(top elevation in degrees, material), ...] from below the horizon up to 90."""
    els = [-30] + [b[0] for b in bands]
    for k in range(len(bands)):
        e0, e1 = math.radians(els[k]), math.radians(els[k + 1])
        mat = bands[k][1]
        verts = []
        for e in (e0, e1):
            for i in range(segs):
                a = i / segs * TAU
                verts.append(V((math.cos(a) * math.cos(e) * r, math.sin(a) * math.cos(e) * r, math.sin(e) * r)))
        m.add(verts, [[segs + i, segs + (i + 1) % segs, (i + 1) % segs, i] for i in range(segs)], mat, NONE)


# ---------------------------------------------------------------- export / preview
def export_static(path, objs):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False, export_skins=False,
                              export_yup=True, export_apply=False, export_materials='EXPORT', export_normals=True,
                              export_texcoords=False, export_extras=False)


def render_shots(path, shots, world=(.02, .02, .03), sun=None, res=(1280, 720), mist=None):
    """EEVEE stills: shots = [(name, cam_loc, target, lens)]. A sun and world colour are preview-only (not exported)."""
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = res
    if not sc.world:
        sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (*world, 1)
    bg.inputs[1].default_value = 1.
    tmp = []
    if sun:
        ld = bpy.data.lights.new('sun', 'SUN')
        ld.energy, ld.color = sun[1], sun[2]
        lo = bpy.data.objects.new('sun', ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = sun[0]
        tmp.append(lo)
    cd = bpy.data.cameras.new('cam')
    cd.clip_end = 600
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    tmp.append(cam)
    outs = []
    for name, loc, tgt, lens in shots:
        cd.lens = lens
        cam.location = loc
        cam.rotation_euler = (V(tgt) - V(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{path}_{name}.png'
        bpy.ops.render.render(write_still=True)
        outs.append(sc.render.filepath)
    for o in tmp:
        bpy.data.objects.remove(o)
    return outs
