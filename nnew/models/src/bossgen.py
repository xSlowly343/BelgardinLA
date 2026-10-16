"""Shared helpers for the low-poly boss generators (run inside Blender: blender -b --factory-startup --python <boss>.py).

Geometry is written into one bmesh with per-vertex bone weights, so every boss ends up as a single skinned mesh
on one armature. Animations are sampled from Python pose functions and baked to one action per clip.
Pose rotations are given in the armature's *rest* axes (Blender: -Y front, +Z up, +X = character's left)."""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix, Quaternion, Euler

FPS = 30
V = Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    return sc


def out_dir():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    d = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    os.makedirs(d, exist_ok=True)
    return os.path.abspath(d)


def material(name, color, rough=.6, metal=0., emit=None, strength=2.):
    m = bpy.data.materials.new(name)
    m.use_backface_culling = False  # glTF doubleSided: cloth strips and ribbons are single sheets
    m.diffuse_color = (*color, 1)
    n = m.node_tree.nodes['Principled BSDF'] if m.node_tree else None
    if n is None:
        m.use_nodes = True
        n = m.node_tree.nodes['Principled BSDF']
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Roughness'].default_value = rough
    n.inputs['Metallic'].default_value = metal
    if emit:
        n.inputs['Emission Color'].default_value = (*emit, 1)
        n.inputs['Emission Strength'].default_value = strength
    return m


def basis(d, ref=None):
    """Orthonormal (u, v) perpendicular to direction d."""
    d = d.normalized()
    ref = ref or (V((0, 0, 1)) if abs(d.z) < .9 else V((1, 0, 0)))
    u = d.cross(ref).normalized()
    return u, d.cross(u).normalized()


class Mesh:
    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()
        self.groups, self.mats = [], []

    def _gi(self, b):
        if b not in self.groups:
            self.groups.append(b)
        return self.groups.index(b)

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, mat, weights):
        """weights: bone name, or one entry per vertex (bone name or [(bone, w), ...])."""
        vs = [self.bm.verts.new(V(v)) for v in verts]
        ws = weights if isinstance(weights, list) else [weights] * len(vs)
        for v, w in zip(vs, ws):
            for b, x in ([(w, 1.)] if isinstance(w, str) else w):
                if x > 1e-4:
                    v[self.dl][self._gi(b)] = x
        mi = self._mi(mat)
        for f in faces:
            try:
                self.bm.faces.new([vs[i] for i in f]).material_index = mi
            except ValueError:
                pass
        return vs

    def add_bm(self, tmp, mat, bone, mtx=Matrix()):
        tmp.verts.ensure_lookup_table()
        idx = {v: i for i, v in enumerate(tmp.verts)}
        verts = [mtx @ v.co for v in tmp.verts]
        faces = [[idx[v] for v in f.verts] for f in tmp.faces]
        tmp.free()
        return self.add(verts, faces, mat, bone)

    # ---- primitives -------------------------------------------------------
    def ico(self, c, r, mat, bone, sub=1, scale=(1, 1, 1), jitter=0., seed=0, rot=(0, 0, 0)):
        t = bmesh.new()
        bmesh.ops.create_icosphere(t, subdivisions=sub, radius=1)
        rnd = random.Random(seed)
        for v in t.verts:
            v.co *= 1 + (rnd.random() - .5) * jitter
        m = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((r * scale[0], r * scale[1], r * scale[2], 1))
        return self.add_bm(t, mat, bone, m)

    def box(self, c, size, mat, bone, rot=(0, 0, 0)):
        t = bmesh.new()
        bmesh.ops.create_cube(t, size=1)
        m = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
        return self.add_bm(t, mat, bone, m)

    def prism(self, p0, p1, r0, r1, mat, bone, sides=6, ref=None, flat=(1, 1), twist=0.):
        """Tapered n-gon prism (r1 = 0 gives a spike). flat scales the cross-section (u, v)."""
        p0, p1 = V(p0), V(p1)
        u, v = basis(p1 - p0, ref)
        verts, faces = [], []
        for p, r in ((p0, r0), (p1, r1)):
            if r <= 0:
                verts.append(p)
                continue
            for i in range(sides):
                a = i / sides * math.tau + twist
                verts.append(p + u * math.cos(a) * r * flat[0] + v * math.sin(a) * r * flat[1])
        if r1 <= 0:
            faces = [[i, (i + 1) % sides, sides] for i in range(sides)] + [list(range(sides))[::-1]]
        elif r0 <= 0:
            faces = [[0, 1 + (i + 1) % sides, 1 + i] for i in range(sides)] + [[1 + i for i in range(sides)]]
        else:
            faces = [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
            faces += [list(range(sides))[::-1], [sides + i for i in range(sides)]]
        return self.add(verts, faces, mat, bone)

    def spike(self, base, tip, r, mat, bone, sides=4, ref=None):
        return self.prism(base, tip, r, 0, mat, bone, sides, ref)

    def lathe(self, prof, mat, bone, sides=10, c=(0, 0, 0), jitter=0., seed=0, scale=(1, 1)):
        """prof: [(radius, z), ...] bottom to top, revolved around Z."""
        rnd = random.Random(seed)
        verts, faces, n = [], [], sides
        for r, z in prof:
            for i in range(n):
                a = i / n * math.tau
                k = 1 + (rnd.random() - .5) * jitter
                verts.append(V(c) + V((math.cos(a) * r * k * scale[0], math.sin(a) * r * k * scale[1], z)))
        for j in range(len(prof) - 1):
            for i in range(n):
                faces.append([j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i])
        faces.append(list(range(n))[::-1])
        faces.append([(len(prof) - 1) * n + i for i in range(n)])
        w = bone if not callable(bone) else [bone(v) for v in verts]
        return self.add(verts, faces, mat, w)

    # ---- chain-skinned pieces ---------------------------------------------
    @staticmethod
    def chain_w(bones, s):
        """Blend weights for chain parameter s in [0, len(bones)] (s = k at joint k)."""
        n = len(bones)
        x = min(max(s - .5, 0), n - 1)
        k = min(int(x), n - 1)
        f = x - k
        if k + 1 >= n:
            return [(bones[n - 1], 1.)]
        return [(bones[k], 1 - f), (bones[k + 1], f)]

    @staticmethod
    def sample(joints, per=3):
        """Points along a joint polyline with their chain parameter s."""
        out = []
        for k in range(len(joints) - 1):
            for i in range(per):
                f = i / per
                out.append((joints[k].lerp(joints[k + 1], f), k + f))
        out.append((joints[-1], len(joints) - 1))
        return out

    def strip(self, joints, bones, width, mat, normal, per=3, tip='point', seed=0, curl=0.):
        """Flat tapered ribbon along joints. width(f) -> width at f in [0,1]; normal = sheet facing hint.
        tip: 'point' | 'fork' (two tattered points) | 'flat'."""
        rnd = random.Random(seed)
        pts = self.sample(joints, per)
        n = len(pts)
        verts, ws = [], []
        for i, (p, s) in enumerate(pts):
            f = s / (len(joints) - 1)
            t = (pts[min(i + 1, n - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
            side = t.cross(V(normal)).normalized()
            off = V(normal).normalized() * curl * math.sin(f * math.pi)
            hw = width(f) / 2 * (1 + (rnd.random() - .5) * .25)
            last = i == n - 1
            if last and tip == 'point':
                verts.append(p + off)
                ws.append(self.chain_w(bones, s))
            elif last and tip == 'fork':
                seg = (pts[i][0] - pts[i - 1][0]).length
                verts += [p + off - side * hw * 1.1, p + off - t * seg * .8, p + off + side * hw * 1.1]
                ws += [self.chain_w(bones, s)] * 3
            else:
                verts += [p + off - side * hw, p + off + side * hw]
                ws += [self.chain_w(bones, s)] * 2
        faces = []
        rows = n - 1
        for i in range(rows - 1):
            a = i * 2
            faces.append([a, a + 2, a + 3, a + 1])
        a = (rows - 1) * 2
        if tip == 'point':
            faces.append([a, a + 2, a + 1])
        elif tip == 'fork':
            # two tattered points with a notch (a+3) pulled back between them
            faces += [[a, a + 2, a + 3], [a, a + 3, a + 1], [a + 3, a + 4, a + 1]]
        else:
            faces.append([a, a + 2, a + 3, a + 1])
        return self.add(verts, faces, mat, ws)

    def tube(self, joints, bones, radius, mat, sides=6, per=2, spikes=None, spike_mat=None, ref=None):
        """Tapered tube along joints. radius(f). spikes: (every_n_rings, length(f), dir_fn(u, v) -> vector)."""
        pts = self.sample(joints, per)
        n = len(pts)
        verts, ws, faces = [], [], []
        frames = []
        for i, (p, s) in enumerate(pts):
            t = (pts[min(i + 1, n - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
            u, v = basis(t, ref)
            frames.append((t, u, v))
            f = s / (len(joints) - 1)
            r = radius(f)
            for k in range(sides):
                a = k / sides * math.tau
                verts.append(p + (u * math.cos(a) + v * math.sin(a)) * r)
                ws.append(self.chain_w(bones, s))
        for i in range(n - 1):
            for k in range(sides):
                faces.append([i * sides + k, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, (i + 1) * sides + k])
        faces.append(list(range(sides))[::-1])
        tipi = len(verts)
        verts.append(pts[-1][0] + frames[-1][0] * radius(1) * 2.5)
        ws.append(self.chain_w(bones, pts[-1][1]))
        faces += [[(n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides, tipi] for k in range(sides)]
        self.add(verts, faces, mat, ws)
        if spikes:
            every, length, dirfn = spikes
            for i in range(1, n - 1, every):
                p, s = pts[i]
                t, u, v = frames[i]
                f = s / (len(joints) - 1)
                d = dirfn(u, v, t, f).normalized()
                base = p + d * radius(f) * .7
                self.spike_w(base, base + d * length(f) - t * length(f) * .35, radius(f) * .45, spike_mat or mat, self.chain_w(bones, s), ref=t)
        return pts

    def spike_w(self, base, tip, r, mat, w, sides=4, ref=None):
        base, tip = V(base), V(tip)
        u, v = basis(tip - base, ref)
        verts = [base + (u * math.cos(k / sides * math.tau) + v * math.sin(k / sides * math.tau)) * r for k in range(sides)] + [tip]
        faces = [[k, (k + 1) % sides, sides] for k in range(sides)] + [list(range(sides))[::-1]]
        return self.add(verts, faces, mat, [w] * len(verts))

    def build(self, name, arm_obj=None):
        """Turn the accumulated geometry into an object; without arm_obj it is a static (unskinned) mesh."""
        me = bpy.data.meshes.new(name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        if arm_obj is None:
            return ob
        for g in self.groups:
            ob.vertex_groups.new(name=g)
        ob.parent = arm_obj
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm_obj
        return ob


# ---- armature --------------------------------------------------------------
def armature(name, bones):
    """bones: list of (name, head, tail, parent or None)."""
    ad = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, ad)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ad.edit_bones
    for n, h, t, p in bones:
        b = eb.new(n)
        b.head, b.tail = V(h), V(t)
        b.roll = 0
        if p:
            b.parent = eb[p]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    ad.display_type = 'STICK'
    return ob


def chain(prefix, joints, parent):
    return [(f'{prefix}{k}', joints[k], joints[k + 1], parent if k == 0 else f'{prefix}{k - 1}') for k in range(len(joints) - 1)]


def arc(p0, d0, length, n, bend_axis, bend):
    """Joint positions of a chain starting at p0 heading d0, turning `bend` radians in total about bend_axis."""
    pts, p, d = [V(p0)], V(p0), V(d0).normalized()
    q = Quaternion(V(bend_axis).normalized(), bend / n)
    for _ in range(n):
        p = p + d * (length / n)
        pts.append(p.copy())
        d = q @ d
    return pts


# ---- animation baking -----------------------------------------------------
def q_axis(axis, ang):
    return Quaternion(V(axis).normalized(), ang)


def q_euler(x=0., y=0., z=0.):
    return Euler((x, y, z)).to_quaternion()


def bake(arm, clips, step=2):
    """clips: list of (name, seconds, pose_fn). pose_fn(t, u) -> {bone: dict(q=Quaternion, loc=Vector, s=float)}
    q / loc are in rest armature axes and converted to each bone's local space."""
    rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
    arm.animation_data_create()
    acts = []
    for name, dur, fn in clips:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        frames = max(2, round(dur * FPS))
        fr = list(range(0, frames + 1, step))
        if fr[-1] != frames:
            fr.append(frames)
        # pass 1: evaluate every frame (pose functions may be stateful, so strictly in time order)
        vals = {pb.name: [] for pb in arm.pose.bones}
        for f in fr:
            pose = fn(f / FPS, f / frames)
            for pb in arm.pose.bones:
                B = rest[pb.name]
                d = pose.get(pb.name, {})
                q = (B.inverted() @ d.get('q', Quaternion()).to_matrix() @ B).to_quaternion()
                if vals[pb.name] and vals[pb.name][-1][0].dot(q) < 0:
                    q.negate()  # keep quaternion keys on one hemisphere so interpolation takes the short way
                s = d.get('s', 1.)
                s = V((s, s, s)) if not isinstance(s, (tuple, list, Vector)) else V(s)
                vals[pb.name].append((q, B.inverted() @ V(d.get('loc', (0, 0, 0))), s))
        # pass 2: key only channels that move (or sit away from the bind pose) — keeps the GLB small
        for pb in arm.pose.bones:
            seq = vals[pb.name]
            chans = []
            for ci, (path, ident) in enumerate((('rotation_quaternion', Quaternion()), ('location', V((0, 0, 0))), ('scale', V((1, 1, 1))))):
                first = seq[0][ci]
                moves = any(max(abs(a - b) for a, b in zip(x[ci], first)) > 1e-4 for x in seq)
                off = max(abs(a - b) for a, b in zip(first, ident)) > 1e-4
                if moves or off:
                    chans.append((ci, path, moves))
            for ci, path, moves in chans:
                for f, x in zip(fr if moves else fr[:1], seq if moves else seq[:1]):
                    setattr(pb, path, x[ci])
                    pb.keyframe_insert(path, frame=f, group=pb.name)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
        tr.mute = True
        acts.append(act)
        arm.animation_data.action = None
    return acts


def merge(*poses):
    """Compose pose dicts: rotations multiply (later applied on top), locations add, scales multiply."""
    out = {}
    for p in poses:
        for b, d in p.items():
            o = out.setdefault(b, {})
            if 'q' in d:
                o['q'] = d['q'] @ o['q'] if 'q' in o else d['q']
            if 'loc' in d:
                o['loc'] = V(o.get('loc', (0, 0, 0))) + V(d['loc'])
            if 's' in d:
                o['s'] = o.get('s', 1.) * d['s']
    return out


def ease(x):
    x = min(max(x, 0.), 1.)
    return x * x * (3 - 2 * x)


def env(u, a, b):
    """0 before a, ramps to 1 by b."""
    return ease((u - a) / (b - a)) if b > a else float(u >= a)


def hold(u, a, b, c, d):
    """Trapezoid envelope: up between a..b, down between c..d."""
    return env(u, a, b) * (1 - env(u, c, d))


# ---- export & preview -----------------------------------------------------
def export(path, arm, mesh, frame_step=2):
    for o in bpy.context.scene.objects:
        o.select_set(o in (arm, mesh))
    bpy.context.view_layer.objects.active = arm
    arm.animation_data.action = None
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=True, export_skins=True,
                              export_def_bones=False, export_yup=True, export_apply=False, export_materials='EXPORT',
                              export_normals=True, export_texcoords=False, export_extras=False, export_frame_step=frame_step)


def preview(path, arm, clip_frames, cam_loc, target, res=(520, 620), lens=50):
    """Render one frame per (action, frame) with Workbench into a horizontal strip of PNGs (path_N.png)."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    if not sc.world:
        sc.world = bpy.data.worlds.new('W')
    sc.world.color = (.05, .045, .06)
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = (V(target) - V(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    outs = []
    for i, (act, f) in enumerate(clip_frames):
        arm.animation_data.action = bpy.data.actions[act]
        sc.frame_set(f)
        sc.render.filepath = f'{path}_{i:02d}_{act}_{f}.png'
        bpy.ops.render.render(write_still=True)
        outs.append(sc.render.filepath)
    arm.animation_data.action = None
    bpy.data.objects.remove(cam)
    return outs
