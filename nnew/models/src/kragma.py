"""Phetus an Kragma / Belgardin Nightmare (gate II) — low-poly rigged model with arena clips.
Run: blender -b --factory-startup --python kragma.py -- <out_dir>
Clips match the action names in js/arena.js poseB(): Idle, Grab, Slam, Raise, Spin, Sling, Sweep, Guard.
Four huge jointless tentacles built like spinal columns (vertebrae with spiny processes) ending in hooked claws,
a toothed crown above a mask with a black vertical slit, an openwork ribcage and ragged cloth below."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bossgen import *

reset()
OUT = out_dir()
TAU = math.tau
X, Y, Z = V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1))

M = dict(
    shell=material('Shell', (.1, .085, .12), .45, .5),
    shellL=material('ShellLight', (.28, .25, .31), .5, .3),
    bone=material('Bone', (.55, .5, .52), .55),
    flesh=material('Flesh', (.12, .05, .14), .45, .2, emit=(.06, .01, .08), strength=1),
    rag=material('Rag', (.07, .055, .09), .85),
    void=material('Void', (.01, .005, .015), .9, emit=(.08, .02, .14), strength=1),
    purple=material('PurpleGlow', (.55, .3, .9), .3, emit=(.5, .25, 1.), strength=5),
    core=material('Core', (1., .35, .25), .3, emit=(1., .3, .2), strength=8),
    crystal=material('Crystal', (.6, .45, .9), .2, emit=(.4, .2, .8), strength=3),
    blade=material('Blade', (.42, .38, .48), .25, .7),
    violet=material('Violet', (.32, .16, .5), .4, .3, emit=(.25, .08, .45), strength=1.5),
)

# ---------------- skeleton ----------------
B = [('root', (0, 0, 0), (0, 0, .5), None),
     ('pelvis', (0, 0, 2.8), (0, 0, 3.3), 'root'),
     ('spine', (0, 0, 3.3), (0, 0, 4.0), 'pelvis'),
     ('chest', (0, 0, 4.0), (0, 0, 4.8), 'spine'),
     ('head', (0, 0, 4.9), (0, 0, 5.7), 'chest'),
     ('maw.L', (.3, -.36, 5.0), (.3, -.36, 5.7), 'head'),
     ('maw.R', (-.3, -.36, 5.0), (-.3, -.36, 5.7), 'head'),
     ('shards', (0, 0, 7.4), (0, 0, 7.8), 'root')]

NT = 10  # bones per tentacle


def arc_var(p0, d0, seg, axis, bends):
    """Chain joints whose direction turns by bends[k] radians about axis after each segment (S-curves, hooked tips)."""
    pts, p, d = [V(p0)], V(p0), V(d0).normalized()
    for b in bends:
        p = p + d * seg
        pts.append(p.copy())
        d = Quaternion(V(axis), b) @ d
    return pts


# (root, start direction, length, per-segment droop): + droops outwards/down, - hooks back at the tip
TENT_DEF = (((.42, .4, 4.75), (.62, .5, .62), 10.5, (.07, .12, .19, .25, .28, .28, .22, .08, -.3, -.55)),     # upper: rises then arcs over
            ((.45, .3, 4.15), (.8, .3, .1), 4.6, (.08, .14, .22, .28, .3, .26, .18, .06, -.3, -.6)))       # small purple arms: shorter, arch down
TENT = []  # (S, s, j, joints, droop axis)
for s, S in ((1, 'L'), (-1, 'R')):
    for j, (p0, d0, L, bends) in enumerate(TENT_DEF):
        d0 = V((d0[0] * s, d0[1], d0[2])).normalized()
        ax = d0.cross(V((0, 0, -1))).normalized()
        J = arc_var((p0[0] * s, p0[1], p0[2]), d0, L / NT, ax, bends)
        TENT.append((S, s, j, J, ax))
        B += chain(f'tent.{S}{j}_', J, 'chest')
RAGS = []  # wide cloth flaps (k = 'rag') and thin dark strands (k = 'str')
for i in range(18):
    a = i / 18 * TAU - TAU / 4 + .05 * math.sin(i * 2.1)
    r = V((math.cos(a), math.sin(a), 0))
    J = [V((0, 0, 3.05)) + r * .58, V((0, 0, 2.0)) + r * .75, V((0, 0, 1.0)) + r * 1.0, V((0, 0, .02 + .3 * (i % 4 == 1))) + r * (1.35 + .2 * (i % 2))]
    RAGS.append(('rag', i, a, r, J))
for i in range(12):
    a = (i + .5) / 12 * TAU - TAU / 4
    r = V((math.cos(a), math.sin(a), 0))
    J = [V((0, 0, 2.6)) + r * .62, V((0, 0, 1.7)) + r * .95, V((0, 0, .8)) + r * 1.35, V((0, 0, .02)) + r * (1.9 + .4 * (i % 3) / 2)]
    RAGS.append(('str', i, a, r, J))
# the skirt is driven by 9 sector chains; every flap and strand is skinned to the nearest one (keeps the bone count low)
NC = 9
CLOTH = []
for i in range(NC):
    a = i / NC * TAU - TAU / 4
    r = V((math.cos(a), math.sin(a), 0))
    J = [V((0, 0, 3.05)) + r * .58, V((0, 0, 2.0)) + r * .8, V((0, 0, 1.0)) + r * 1.1, V((0, 0, .02)) + r * 1.5]
    CLOTH.append((i, a, r, J))
    B += chain(f'cloth{i}_', J, 'pelvis')


def sector(a):
    return round(((a + TAU / 4) % TAU) / TAU * NC) % NC


arm = armature('Kragma_Rig', B)

# ---------------- mesh ----------------
m = Mesh()


def trunk_w(v):
    z = v.z
    if z < 3.3:
        return [('pelvis', 1.)]
    if z < 4.0:
        f = (z - 3.3) / .7
        return [('pelvis', 1 - f), ('spine', f)]
    f = min(1, (z - 4.0) / .4)
    return [('spine', 1 - f), ('chest', f)]


def zb(z):  # rigid bone for a part at height z
    return 'chest' if z > 4.0 else ('spine' if z > 3.3 else 'pelvis')


# trunk: narrow waist, broad chest (dark core inside the open ribcage)
m.lathe([(.5, 2.7), (.55, 3.1), (.42, 3.6), (.56, 4.0), (.82, 4.4), (.95, 4.7), (.66, 4.95), (.25, 5.05)], M['shell'], trunk_w, sides=9, scale=(1, .66), jitter=.12, seed=2)
m.ico((0, -.5, 4.25), .26, M['core'], 'chest', 1, (1, .7, 1.25))
# openwork ribcage: sternum, five pairs of curved ribs and a lattice between them
m.prism((0, -.74, 3.7), (0, -.74, 4.8), .07, .05, M['bone'], 'chest', 4)
for k in range(5):
    z = 3.75 + k * .23
    wr = .62 + .14 * math.sin(k / 4 * math.pi) + .05 * k
    for s in (1, -1):
        J = [V((.05 * s, -.74, z)), V((wr * .62 * s, -.66, z - .03)), V((wr * s, -.32, z - .1)), V((wr * .92 * s, .12, z - .16))]
        m.tube(J, [zb(z)], lambda f: .055 * (1 - .4 * f), M['bone'], sides=4, per=2)
        if k < 4:  # diagonal lattice struts + small thorns: the ornament between the ribs
            m.prism((wr * .62 * s, -.66, z - .03), (wr * .4 * s, -.71, z + .2), .02, .02, M['shellL'], zb(z), 3)
            m.spike((wr * s, -.32, z - .1), (wr * 1.18 * s, -.4, z - .02), .035, M['bone'], zb(z), 3)
# shaggy thorn mantle hanging from the shoulders
for k in range(18):
    a = k / 18 * TAU
    if math.sin(a) < -.75:
        continue  # keep the ribcage visible in front
    base = V((math.cos(a) * .82, math.sin(a) * .58, 4.78 - .1 * (k % 2)))
    tip = base + V((math.cos(a) * .35, math.sin(a) * .3, -.9 - .4 * (k % 3)))
    m.spike(base, tip, .15, M['shell'] if k % 3 else M['shellL'], 'chest')
# vertebral ridge on the back
for k in range(7):
    z = 3.2 + k * .26
    m.spike((0, .26 + k * .03, z), (0, .62 + k * .05, z + .25), .09, M['shell'], zb(z))
# tentacle mount: a spiked bony hump on the upper back
m.ico((0, .45, 4.5), .62, M['shell'], 'chest', 1, (1.15, .8, 1.0), jitter=.25, seed=21)
for k in range(9):
    a = (k / 8 - .5) * 2.6
    base = V((math.sin(a) * .5, .7, 4.5 + math.cos(a) * .35))
    m.spike(base, base + V((math.sin(a) * .35, .55, math.cos(a) * .45)), .1, M['shellL'] if k % 2 else M['bone'], 'chest', 4)
for S, s_, j, J, ax in TENT:  # collar ring where each tentacle leaves the hump
    t0 = (J[1] - J[0]).normalized()
    m.prism(J[0] - t0 * .15, J[0] + t0 * .2, (.75 if j == 0 else .63), (.66 if j == 0 else .55), M['shellL'], 'chest', 7)
# shoulders: spiked pauldrons
for s in (1, -1):
    m.ico((.9 * s, 0, 4.75), .38, M['shell'], 'chest', 1, (1.2, .9, .8), jitter=.2, seed=5)
    for k in range(4):
        a = .25 + k * .35
        m.spike((.95 * s, .05 * k, 4.9), (.95 * s + math.cos(a) * .9 * s, .15 * k, 4.9 + math.sin(a) * 1.0), .1, M['shellL'], 'chest')
# head: skull behind a two-piece bone mask split by a black vertical slit
m.ico((0, .08, 5.35), .56, M['shell'], 'head', 1, (1.05, .9, 1.15), jitter=.15, seed=9)
m.box((0, -.38, 5.3), (.11, .06, 1.2), M['void'], 'head')
m.prism((0, -.33, 4.95), (0, -.33, 5.7), .03, .03, M['purple'], 'head', 4)  # faint glow deep in the slit
for s, S in ((1, 'L'), (-1, 'R')):
    b = f'maw.{S}'
    pts = [V((.05 * s, -.5, 5.9)), V((.44 * s, -.38, 5.8)), V((.55 * s, -.28, 5.3)), V((.38 * s, -.36, 4.78)), V((.05 * s, -.48, 4.7))]
    back = [p + V((0, .16, 0)) for p in pts]
    n = len(pts)
    fs = [list(range(n)), [n + i for i in range(n)][::-1]] + [[i, n + i, n + (i + 1) % n, (i + 1) % n] for i in range(n)]
    if s < 0:
        fs = [f[::-1] for f in fs]
    m.add(pts + back, fs, M['bone'], b)
    m.box((.2 * s, -.49, 5.45), (.16, .02, .03), M['purple'], b, rot=(0, -.35 * s, 0))  # eye slit
    m.prism((.08 * s, -.5, 5.6), (.36 * s, -.42, 5.68), .025, .025, M['shellL'], b, 3)  # brow ridge
    for k in range(5):  # teeth along the slit
        z = 4.88 + k * .2
        m.spike((.06 * s, -.47, z), (-.02 * s, -.5, z - .07), .035, M['bone'], b, 3)
    for k in range(3):  # cheek thorns
        m.spike((.38 * s, -.33, 5.1 + k * .2), (.62 * s, -.25, 5.0 + k * .26), .05, M['shellL'], b, 3)
# crown: a heavy toothed band with two rows of jagged spikes
for k in range(12):
    a0, a1 = k / 12 * TAU, (k + 1) / 12 * TAU
    p = lambda a: V((math.sin(a) * .52, -math.cos(a) * .44 + .05, 5.75))
    m.prism(p(a0), p(a1), .08, .08, M['shellL'], 'head', 4)
for k in range(17):
    a = (k / 16 - .5) * 3.4
    front = math.cos(a)
    L = .75 + .65 * front ** 2 + .25 * (k % 2)
    base = V((math.sin(a) * .5, -math.cos(a) * .3 + .1, 5.72))
    tip = base + V((math.sin(a) * L * .9, .15 + .2 * (k % 3), L))
    m.spike(base, tip, .26 if k % 2 else .19, M['shell'] if k % 3 else M['shellL'], 'head')
    if k % 2 == 0:  # side barbs on the big teeth
        mid = base.lerp(tip, .55)
        m.spike(mid, mid + V((math.sin(a) * .3 + .05, .05, .15)), .05, M['shell'], 'head', 3)
for k in range(9):  # inner row
    a = (k / 8 - .5) * 2.4
    base = V((math.sin(a) * .3, .15, 5.75))
    m.spike(base, base + V((math.sin(a) * .25, .25, .7 + .2 * (k % 2))), .09, M['bone'] if k % 2 else M['shell'], 'head', 4)
for k in range(6):  # back crown spikes
    a = (k / 5 - .5) * 2
    base = V((math.sin(a) * .3, .3, 5.45))
    m.spike(base, base + V((math.sin(a) * .5, .9, .55)), .09, M['shell'], 'head')


def sickle(m, J, bones, length, width, mat, roll=0.):
    """Crescent blade continuing the chain's tip, curving towards the inside of the bend (roll turns it about the tip axis)."""
    tip, d = J[-1], (J[-1] - J[-2]).normalized()
    inside = (J[-2] - J[-3]).normalized().cross(d).cross(d).normalized() * -1  # direction the chain curls towards
    if inside.length < .5:
        inside = basis(d)[1]
    inside = Quaternion(d, roll) @ inside
    side = d.cross(inside).normalized()
    outer, inner = [], []
    for i in range(7):
        f = i / 6
        a = f * 1.9
        c = tip + (d * math.sin(a) + inside * (1 - math.cos(a))) * length * .55
        nrm = (d * math.sin(a) + inside * (1 - math.cos(a))).normalized() if i else d
        w = width * math.sin(min(1, f * 1.3) * math.pi) * (1 - f * .5)
        outer.append(c - inside.lerp(-nrm, .5).normalized() * w * .2)
        inner.append(c + inside * w)
    th = side * .04
    vs = [p + th for p in outer] + [p - th for p in outer] + [p + th for p in inner] + [p - th for p in inner]
    n = len(outer)
    fs = []
    for i in range(n - 1):
        fs += [[i, i + 1, 2 * n + i + 1, 2 * n + i], [n + i, 3 * n + i, 3 * n + i + 1, n + i + 1],
               [i, n + i, n + i + 1, i + 1], [2 * n + i, 2 * n + i + 1, 3 * n + i + 1, 3 * n + i]]
    m.add(vs, fs, mat, [[(bones[-1], 1.)]] * len(vs))


def chain_at(J, s):
    """Point and tangent at chain parameter s (s = k at joint k)."""
    k = min(int(s), len(J) - 2)
    f = s - k
    return J[k].lerp(J[k + 1], f), (J[k + 1] - J[k]).normalized()


# tentacles: spinal columns — a sinew core threaded through stacked vertebrae with spiny processes, hooked claw at the tip
NV = 26  # vertebrae per tentacle
for S, s, j, J, ax in TENT:
    bones = [f'tent.{S}{j}_{k}' for k in range(NT)]
    R0 = .6 if j == 0 else .36
    rad = lambda f, R0=R0: R0 * (1 - .78 * f) + .05
    m.tube(J, bones, lambda f, rad=rad: rad(f) * .55, M['flesh'], sides=6, per=2)
    seg = (J[1] - J[0]).length
    for i in range(NV):
        sv = (i + .5) / NV * NT
        f = sv / NT
        p, t = chain_at(J, sv)
        r = rad(f)
        dors = (t.cross(ax) * -1).normalized()  # convex (outer) side of the curl
        lat = t.cross(dors).normalized()
        w = Mesh.chain_w(bones, sv)
        h = seg * NT / NV * .36
        n0 = len(m.bm.verts)
        m.prism(p - t * h, p + t * h, r, r * .9, (M['shellL'] if i % 2 else M['bone']) if j == 0 else (M['violet'] if i % 2 else M['shell']), [w] * 12, 6, ref=dors, twist=.5)  # vertebral body
        m.prism(p - t * h * .4, p + t * h * .4, r * 1.12, r * 1.12, M['shell'], [w] * 12, 6, ref=dors)  # rim
        # spinous process: long, swept back towards the root
        m.spike_w(p + dors * r * .7 - t * h * .3, p + dors * r * (2.6 - .8 * f) - t * r * 1.4, r * .32, M['shellL'], w, ref=t)
        for sx in (-1, 1):  # transverse processes, curving back like ribs
            m.spike_w(p + lat * sx * r * .85, p + lat * sx * r * (2.3 - .6 * f) - t * r * .9 + dors * r * .35, r * .22, M['bone'], w, ref=t)
            if i % 3 == 1:  # small ventral hooks
                m.spike_w(p - dors * r * .7 + lat * sx * r * .4, p - dors * r * 1.5 + lat * sx * r * .6 - t * r * .5, r * .15, M['shell'], w, ref=t)
    for roll, L, wd in ((0, 2.1, .55), (1.2, 1.25, .32), (-1.2, 1.25, .32)):  # hooked claw: main sickle + two side hooks
        sickle(m, J, bones, (L if j == 0 else L * .6), wd if j == 0 else wd * .7, M['blade'] if j == 0 else M['violet'], roll)
# lower body: ragged cloth flaps and dark strands, hanging like a marionette's skirt
m.lathe([(.7, .6), (.6, 1.6), (.55, 3.0)], M['flesh'], 'pelvis', sides=8)
for k, i, a, r, J in RAGS:
    bones = [f'cloth{sector(a)}_{b}' for b in range(3)]
    if k == 'rag':
        m.strip(J, bones, lambda f, i=i: (.42 + .18 * (i % 3) + .25 * f) * (1 - max(0, f - .75) * 2.5), M['rag'] if i % 3 else M['flesh'],
                r, per=3, tip='fork' if i % 2 else 'point', seed=i, curl=.05)
    else:
        m.strip(J, bones, lambda f: .09 * (1 - f) + .02, M['shell'], r, per=3, tip='point', seed=50 + i, curl=.1)
m.prism((0, 0, 2.95), (0, 0, 3.1), .62, .6, M['shellL'], 'pelvis', 9)  # girdle
# floating shards
for k in range(7):
    a = k / 7 * TAU
    m.ico((math.cos(a) * 1.4, math.sin(a) * 1.4, 7.55), .17, M['crystal'], 'shards', 0, (.6, .6, 2.2), rot=(.3 * math.cos(a), .3 * math.sin(a), 0))
body = m.build('Kragma', arm)

# ---------------- animation ----------------
# Every clip is a timeline of moves (timings from js/data.js, so hits land on the arena telegraphs).
# A move sets *targets* for the tentacles — either a bend of the rest pose or a curve through the shoulder to a point
# on the arena floor (arena heading convention: 0 = boss front, 90 = boss right, clockwise; 1 unit = 1 arena unit).
# The tentacles then follow their targets with spring physics: roots stiff, tips loose (whip and follow-through),
# inertia when the body spins or jumps, and they can't sink into the floor or pass through the body.
W = TAU / 3.0
REST = {}
for S, s, j, J, ax in TENT:
    REST[(S, j)] = dict(s=s, j=j, J0=J[0].copy(), r=[(J[k + 1] - J[k]).normalized() for k in range(NT)], seg=(J[1] - J[0]).length, ax=ax,
                        f=min(1., (J[1] - J[0]).length * NT / 8.4))
L0, R0, L1, R1 = ('L', 0), ('R', 0), ('L', 1), ('R', 1)
BIG, SMALL, ALL = [L0, R0], [L1, R1], [L0, R0, L1, R1]


def side(s, a):  # raise a limb sideways/upwards
    return q_axis((0, -s, 0), a)


def prof(k):  # bend distribution along a tentacle: soft at the root, strongest towards the tip
    return .45 + 1.1 * k / (NT - 1)


def hd(h, r=1., z=0.):
    a = math.radians(h)
    return V((-math.sin(a) * r, -math.cos(a) * r, z))


def bezier(P, n=36):
    return [P[0] * (1 - t) ** 3 + P[1] * 3 * (1 - t) ** 2 * t + P[2] * 3 * (1 - t) * t * t + P[3] * t ** 3 for t in (i / n for i in range(n + 1))]


def walk(poly, seg, n):
    """Directions of n segments of length seg laid along a polyline (continuing straight past its end)."""
    out, cur, i = [], poly[0].copy(), 0
    for _ in range(n):
        need, start = seg, cur.copy()
        while True:
            if i >= len(poly) - 1:
                d = poly[-1] - poly[-2]
                cur = cur + (d.normalized() if d.length > 1e-6 else V((0, 0, -1))) * need
                break
            nxt = poly[i + 1]
            dl = (nxt - cur).length
            if dl >= need and dl > 1e-9:
                cur = cur + (nxt - cur) * (need / dl)
                break
            need -= dl
            cur = nxt.copy()
            i += 1
        out.append((cur - start).normalized())
    return out


def blend(a, b, w):
    if w <= 0:
        return a
    if w >= 1:
        return b
    c = a.lerp(b, w)
    return c.normalized() if c.length > 1e-4 else b


# ---- target shapes (lists of NT segment directions) ----
def fk(key, t, curl=0., steer=0., wave=.1, sway=.06):
    R = REST[key]
    D, out = Quaternion(), []
    for k in range(NT):
        q = q_axis(R['ax'], curl * prof(k) + wave * math.sin(W * 2 * t - k * .7 + R['j'] * 1.3)) @ q_axis(Z, -R['s'] * steer * prof(k) + sway * math.sin(W * t - k * .56 + R['j']))
        D = D @ q
        out.append(D @ R['r'][k])
    return out


def path(key, ctrl):
    R = REST[key]
    return walk(bezier([R['J0']] + ctrl), R['seg'], NT)


def ground(key, h, r, arch=2.4, z=.3):
    """Over the shoulder on its own side, then down onto the floor at heading h, distance r."""
    R = REST[key]
    J0, s, T = R['J0'], R['s'], hd(h, r, z)
    return path(key, [J0 + V((s * 1.6, -.2, arch * .55)), T.lerp(J0, .45) + V((s * .6, 0, arch * .7)), T])


def poised(key, k=1.):
    """Reared up high and curled forward over the head, like a scorpion tail."""
    R = REST[key]
    J0, s, f = R['J0'], R['s'], R['f']
    return path(key, [J0 + V((s * .8, .5, 2.6)) * f, J0 + V((s * 1.7, .3, 6.2 * k)) * f, J0 + V((s * 1.2, -1.6, 7.8 * k)) * f])


def up(key, spread=1.):
    R = REST[key]
    J0, s, f = R['J0'], R['s'], R['f']
    return path(key, [J0 + V((s * .5, .3, 2.)) * f, J0 + V((s * 1.4 * spread, .5, 4.6)) * f, J0 + V((s * 2.3 * spread, .6, 7.4)) * f])


def wrap(key, r=2.4, z=3.2):
    """Around its own side of the body and in front of the core."""
    R = REST[key]
    J0, s = R['J0'], R['s']
    return path(key, [J0 + V((s * 1.6, .1, .3)), V((s * 2.3, -1.0, z)), V((s * .45, -r, z - .4))])


def behind(key):
    R = REST[key]
    J0, s, f = R['J0'], R['s'], R['f']
    return path(key, [J0 + V((s * .4, 1., .4)) * f, J0 + V((s * .9, 2.6, -.3)) * f, J0 + V((s * .5, 3.8, -1.2)) * f])


def overhead(key):
    """Raised and converging above the head (holding the portal)."""
    R = REST[key]
    J0, s = R['J0'], R['s']
    return path(key, [J0 + V((s * .7, .2, 2.4)), V((s * 2.2, .2, 7.6)), V((s * .2, -.4, 9.4))])


# ---- moves: f(t, u) -> ({key: (weight, dirs)}, {body channel: value}) ----
def _keys(keys):
    return keys if isinstance(keys, list) else [keys]


def _h(h, key):
    return h(key) if callable(h) else h


def strike(keys, h, r, arch=2.6, wind=.42, hit=.58, rec=.85, rear=False):
    """Wind up (reared over the head, or straight up for rear strikes), whip down onto heading h at distance r."""
    keys = _keys(keys)

    def f(t, u):
        ew, eh, er = env(u, 0, wind), env(u, wind, hit), env(u, rec, 1)
        out = {}
        for key in keys:
            a = up(key, .8) if rear else poised(key)
            out[key] = (ew * (1 - er), [blend(x, y, eh) for x, y in zip(a, ground(key, _h(h, key), r, arch))])
        big = any(k[1] == 0 for k in keys)
        return out, dict(lean=(-.12 * ew + (.4 if big else .2) * eh) * (1 - er), pz=(.2 * ew - .3 * eh) * (1 - er) * big, maw=.9 * eh * (1 - er))
    return f


def sweep(keys, h0, h1, r, z=.6, a=.3, b=.7):
    """Lay the tentacles along the floor at distance r and sweep them from heading h0 to h1."""
    keys = _keys(keys)

    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        p = ease((u - a) / (b - a))
        return {key: (w, ground(key, _h(h0, key) + (_h(h1, key) - _h(h0, key)) * p, r, 1.4, z)) for key in keys}, dict(lean=.2 * w, maw=.4 * w)
    return f


def grab(keys, h, spread, r, close=.45):
    """Reach out wide (h ± spread), then drag the claws in towards the centre line and the body."""
    keys = _keys(keys)

    def f(t, u):
        w = hold(u, 0, .25, .85, 1)
        c = env(u, .5, .75)
        out = {}
        for key in keys:
            s = REST[key]['s']
            hh = _h(h, key) - s * spread * (1 - c) * (1 if REST[key]['j'] == 0 else .7)
            out[key] = (w, ground(key, hh, r * (1 - (1 - close) * c), 1.6, .4))
        return out, dict(lean=.3 * w, pz=-.2 * w, maw=.7 * c * w)
    return f


def spin(turns=1.):
    def f(t, u):
        w = hold(u, 0, .12, .88, 1)
        out = {key: (w, ground(key, 270 if key[0] == 'L' else 90, 7.5 if key[1] == 0 else 4, 1.0, 1.2 + .8 * key[1])) for key in ALL}
        return out, dict(yaw=-TAU * turns * ease(u), pz=.2 * w, rag=.6 * w)
    return f


def raise_(spread=1.):
    def f(t, u):
        w = hold(u, 0, .3, .8, 1)
        return {key: (w, up(key, spread)) for key in ALL}, dict(lean=-.3 * w, pz=.5 * w, head=-.35 * w, maw=1.1 * w)
    return f


def guard():
    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        return {key: (w, wrap(key, 2.4 if key[1] == 0 else 1.7, 3.4 if key[1] == 0 else 3.0)) for key in ALL}, dict(lean=.15 * w, pz=-.15 * w, head=.15 * w, maw=.2 * w)
    return f


def hug():
    def f(t, u):
        w = hold(u, 0, .3, .8, 1)
        return {key: (w, wrap(key, 1.3, 3.6)) for key in ALL}, dict(lean=.25 * w, pz=-.3 * w, head=.25 * w)
    return f


def counter():
    """Co-op counter window: reared and glowing, maw wide open, slightly recoiling."""
    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        out = {key: (w, poised(key, .9)) for key in BIG}
        out.update({key: (w, up(key, 1.3)) for key in SMALL})
        return out, dict(lean=-.2 * w, py=.4 * w, maw=1.2 * w, head=-.2 * w)
    return f


def hide_back():
    """Arms behind the back, leaning in (green fog in front)."""
    def f(t, u):
        w = hold(u, 0, .25, .8, 1)
        return {key: (w, behind(key)) for key in ALL}, dict(lean=.4 * w, head=.2 * w, maw=.7 * w)
    return f


def portal():
    def f(t, u):
        w = hold(u, 0, .2, .88, 1)
        return {key: (w, overhead(key)) for key in ALL}, dict(lean=-.25 * w, head=-.4 * w, maw=.6 * w, pz=.3 * w)
    return f


def butterfly():
    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        sp = 1.5 + .35 * math.sin(u * TAU * 2)
        return {key: (w, up(key, sp)) for key in ALL}, dict(lean=-.15 * w, pz=.3 * w)
    return f


def point(keys, h):
    keys = _keys(keys)

    def f(t, u):
        w = hold(u, 0, .25, .85, 1)
        return {key: (w, ground(key, _h(h, key), 5.5, .8, 1.6)) for key in keys}, {}
    return f


def beam():
    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        out = {key: (w, ground(key, 110 if key[0] == 'R' else 250, 4.5, 1.6)) for key in BIG}
        out.update({key: (w, up(key, .7)) for key in SMALL})
        return out, dict(lean=-.1 * w, maw=1.6 * w, pz=-.25 * w)
    return f


def vanish():
    def f(t, u):
        w = hold(u, 0, .45, .7, 1)
        return {key: (w, wrap(key, 1.0, 2.6)) for key in ALL}, dict(pz=-1.0 * w, lean=.4 * w)
    return f


def grind():
    """Claws planted ahead, dragging the body forward in heaves (the arena moves the boss)."""
    def f(t, u):
        w = hold(u, 0, .12, .9, 1)
        pull = .5 + .5 * math.sin(u * TAU * 3)
        out = {L0: (w, ground(L0, 335, 3.2 + 1.6 * pull, 1.8)), R0: (w, ground(R0, 25, 3.2 + 1.6 * (1 - pull), 1.8)),
               L1: (w, ground(L1, 320, 2.2 + .8 * (1 - pull), 1.0)), R1: (w, ground(R1, 40, 2.2 + .8 * pull, 1.0))}
        return out, dict(lean=.5 * w, pz=-.5 * w, head=-.2 * w, maw=.5 * w, rag=.15 * w)
    return f


def leap():
    """Crouch with the tentacles braced, launch (the arena hides the boss in the air), land and slam all around."""
    def f(t, u):
        crouch = hold(u, 0, .12, .16, .22)
        air = env(u, .16, .24) * (1 - env(u, .56, .62))
        land = hold(u, .6, .64, .8, 1)
        out = {}
        for key in ALL:
            h = {L0: 225, R0: 135, L1: 300, R1: 60}[key]
            a = ground(key, h, 3.6 if key[1] == 0 else 2.4, 1.2)
            out[key] = (max(crouch, land, air), [blend(x, y, air) for x, y in zip(a, behind(key))])
        return out, dict(pz=-.6 * crouch + 6.0 * air - .5 * land, lean=.3 * crouch - .2 * air + .3 * land, rag=.8 * air, maw=.8 * land)
    return f


def slingshot():
    """Claws planted ahead like a slingshot band, body drawn far back, then released into a lunge."""
    def f(t, u):
        pullb = hold(u, 0, .45, .55, .62)
        rel = hold(u, .55, .62, .8, 1)
        out = {key: (hold(u, 0, .15, .55, .65), ground(key, (330 if key[0] == 'L' else 30) if key[1] == 0 else (300 if key[0] == 'L' else 60), 5.5 if key[1] == 0 else 3, 1.2))
               for key in ALL}
        return out, dict(py=1.6 * pullb - .8 * rel, lean=-.35 * pullb + .55 * rel, pz=-.3 * pullb, maw=.8 * rel)
    return f


def carry():
    """Holding a caught player and walking: tentacles low and wide around the body."""
    def f(t, u):
        w = hold(u, 0, .15, .85, 1)
        return {key: (w, ground(key, (300 if key[0] == 'L' else 60) + 10 * math.sin(u * TAU * 2), 3.0 if key[1] == 0 else 2.0, 1.4, .8)) for key in ALL}, dict(lean=.15 * w)
    return f


def white_sweep():
    """Rotate: big tentacles out along 0/180, then both swing 90 degrees clockwise (data.js 2.5 → 3.4 s within the move)."""
    def f(t, u):
        w = hold(u, 0, .2, .85, 1)
        p = ease((u - .45) / .45)
        return {R0: (w, ground(R0, 0 + 90 * p, 8, 1.0, .5)), L0: (w, ground(L0, 180 + 90 * p, 8, 1.0, .5))}, dict(lean=.1 * w, yaw=0.)
    return f


# ---- clip timelines: (start, duration, move) — names match js/data.js gate II sims ----
X4 = lambda key: {L0: 315, R0: 45, L1: 225, R1: 135}[key]
SIDES = lambda key: 270 if key[0] == 'L' else 90
ATTACKS = {
    'agg4': (5.4, [(.15, .8, strike(L0, 0, 4.5)), (.95, .8, strike(R0, 0, 4.5)), (1.75, 1.0, spin(1)), (3.0, 1.3, strike(BIG, 0, 7, 3.0))]),
    'orbslam': (7.0, [(.7, 1.0, strike(BIG, SIDES, 5)), (2.2, 1.3, strike(BIG, 0, 6.6, 3.2))]),
    'frontback': (4.4, [(.1, .9, strike(SMALL, 0, 3.8, 1.6)), (1.9, .9, strike(SMALL, 0, 3.8, 1.6))]),
    'frontjg': (5.6, [(0, 1.7, hide_back()), (2.0, 2.1, guard()), (4.1, 1.0, strike(SMALL, 0, 4, 1.6))]),
    'suddenjg': (4.6, [(0, 1.9, guard()), (2.0, 1.4, counter())]),
    'rearrapid': (6.0, [(.05, .6, strike(L0, 180, 5, rear=True)), (.5, .6, strike(R0, 180, 5, rear=True)), (.95, .65, strike(L0, 180, 5, rear=True)),
                        (1.7, 1.2, counter()), (2.95, .8, sweep(SMALL, 60, -60, 3.5)), (3.9, 1.2, counter())]),
    'leap': (5.0, [(.05, .9, strike(SMALL, lambda k: 320 if k[0] == 'L' else 40, 2.5, 1.4)), (.85, 2.3, leap())]),
    'pacing': (6.4, [(0, 1.5, raise_(.8)), (1.4, 2.5, guard()), (4.0, .9, spin(1))]),
    'barrage': (7.2, [(0, 1.5, raise_(1.2)), (1.4, 2.6, butterfly()), (4.25, .6, strike(SMALL, 0, 4, 1.4)), (5.35, .6, strike(SMALL, 0, 4, 1.4))]),
    'bomb4': (6.4, [(0, 3.1, portal()), (3.05, 1.4, strike(L0, 0, 8)), (3.05, 1.4, strike(R0, 180, 8, rear=True))]),
    'cones2': (4.6, [(.1, .6, strike(L1, 0, 3.6, 1.4)), (.7, .6, strike(R1, 0, 3.6, 1.4)), (1.45, 1.5, strike(L0, 0, 7, rec=.92)), (1.45, 1.5, strike(R0, 180, 7, rear=True, rec=.92))]),
    'swirl': (5.6, [(.05, .6, strike(SMALL, 0, 3.5, 1.4)), (.75, 1.6, spin(2)), (2.45, 1.0, strike(BIG, 0, 2.8, 3.0))]),
    'sling': (6.4, [(0, 1.7, slingshot()), (1.7, 1.5, grab(ALL, 0, 100, 6)), (3.2, 1.3, counter())]),
    'mirror': (7.0, [(0, .9, vanish()), (.8, 2.8, butterfly()), (3.5, .9, raise_(1.))]),
    'dslam': (5.0, [(.05, 1.25, strike(BIG, 0, 8, 2.8, wind=.4)), (1.05, .75, strike(SMALL, SIDES, 3.5, 1.4)), (1.85, 1.0, strike(BIG, 0, 6.6))]),
    'donutlaser': (6.0, [(.1, .75, strike(R0, 90, 3, 2.2)), (.8, .75, strike(L0, 270, 3, 2.2)), (2.8, 2.0, beam())]),
    'lattice2': (4.4, [(.05, 1.3, raise_(.9)), (1.15, .55, vanish()), (1.6, 1.1, strike(ALL, X4, 5, 2.0))]),
    'wall': (6.4, [(1.65, 1.1, strike(BIG, 0, 8)), (4.25, 1.1, strike(BIG, 0, 8))]),
    'grind': (6.0, [(.1, 2.7, grind()), (2.75, 1.3, strike(BIG, SIDES, 5)), (2.75, 1.3, strike(SMALL, 0, 3.5, 1.4))]),
    'orbjg': (5.4, [(0, 1.3, butterfly()), (1.05, .55, strike(SMALL, 0, 4, 1.4)), (2.2, 1.7, strike(BIG, 0, 6, wind=.6, hit=.72))]),
    'closegrab': (5.0, [(0, .5, hide_back()), (.25, 1.15, grab(ALL, 0, 150, 3.6, .7)), (1.65, 1.1, strike(ALL, X4, 6, 2.0)), (2.8, 2.2, carry())]),
    'launch': (5.0, [(0, .85, strike(ALL, X4, 2.6, 1.6)), (.85, 1.0, strike(R0, 60, 8, 1.2, wind=.3, hit=.42)), (2.05, .85, strike(SMALL, 0, 4, 1.4))]),
    'range': (6.0, [(.1, .95, point(SMALL, lambda k: 300 if k[0] == 'L' else 60)), (.9, 1.9, grab(BIG, lambda k: 300 if k[0] == 'L' else 60, 30, 9)),
                    (2.95, 1.0, strike(R0, 25, 7)), (3.6, 1.0, strike(L0, 335, 7))]),
    'rotate': (6.0, [(.1, 1.0, hug()), (.95, 1.5, sweep(SMALL, lambda k: 300 if k[0] == 'L' else 60, 180, 2.6)), (1.5, 2.3, white_sweep()), (3.85, 1.2, guard())]),
}
# generic clips for the action names used by arena.js poseB()
GENERIC = {
    'Grab': (1.8, [(0, 1.8, grab(ALL, 0, 70, 5))]),
    'Slam': (2.2, [(0, 2.2, strike(BIG, 0, 6))]),
    'Raise': (2.4, [(0, 2.4, raise_())]),
    'Spin': (2.0, [(0, 2.0, spin(1))]),
    'Sling': (1.8, [(0, 1.8, slingshot())]),
    'Sweep': (2.2, [(0, 2.2, sweep(SMALL, 60, -60, 3.5)), (0, 2.2, sweep(BIG, lambda k: 300 if k[0] == 'L' else 60, lambda k: 220 if k[0] == 'L' else 140, 7))]),
    'Guard': (2.0, [(0, 2.0, guard())]),
}

# ---- physics ----
KS = [260 * (1 - .62 * k / (NT - 1)) for k in range(NT)]  # spring stiffness per bone (root → tip)
CS = [2 * math.sqrt(k) * .55 for k in KS]                 # slightly under-damped: a little overshoot, no jitter
INERT = [.15 + .75 * k / (NT - 1) for k in range(NT)]     # how much a bone resists the body's own turning/lifting
FLOOR, SUB = .22, 1 / 90


def clip(dur, moves, loop=False):
    def targets(t):
        tg = {key: fk(key, t) for key in ALL}
        body = dict(lean=0., pz=0., py=0., head=0., maw=0., yaw=0., rag=0.)
        for t0, d, mv in moves:
            if t0 <= t <= t0 + d:
                tt, bd = mv(t, (t - t0) / d)
                for key, (w, dirs) in tt.items():
                    if w > 1e-3:
                        tg[key] = [blend(a, b, w) for a, b in zip(tg[key], dirs)]
                for k, v in bd.items():
                    body[k] += v
        return tg, body

    st = {}

    def integrate(t_to):
        while st['t'] < t_to - 1e-9:
            dt = min(SUB, t_to - st['t'])
            st['t'] += dt
            tg, body = targets(st['t'] % dur if loop else st['t'])
            dyaw, dz = body['yaw'] - st['yaw'], body['pz'] - st['pz']
            st['yaw'], st['pz'], st['body'] = body['yaw'], body['pz'], body
            for key in ALL:
                R, A, Vv = REST[key], st['a'][key], st['v'][key]
                p = R['J0'] + V((0, 0, body['pz']))
                for k in range(NT):
                    a, v = A[k], Vv[k]
                    if dyaw:  # the body turned under the tentacle: it lags behind the turn
                        q = q_axis(Z, -dyaw * INERT[k])
                        a, v = q @ a, q @ v
                    if dz:    # the body rose/fell: the tentacle sags/flicks the other way
                        a = (a - V((0, 0, dz * INERT[k] * .5 / R['seg']))).normalized()
                    acc = (tg[key][k] - a) * KS[k] - v * CS[k]
                    v = v + acc * dt
                    a = (a + v * dt).normalized()
                    v = v - a * v.dot(a)
                    if k >= 1:  # collisions: floor and the body column
                        e = p + a * R['seg']
                        fixed = False
                        if e.z < FLOOR:
                            e.z, fixed = FLOOR, True
                        rad = .95 if e.z > 3.6 else .78
                        rr = math.hypot(e.x, e.y)
                        if 2.3 < e.z < 6.3 and rr < rad:
                            n = V((e.x, e.y, 0)).normalized() if rr > 1e-3 else V((R['s'], 0, 0))
                            e = V((n.x * rad, n.y * rad, e.z))
                            fixed = True
                        if fixed:
                            a = (e - p).normalized()
                            v = v * .3
                    A[k], Vv[k] = a, v
                    p = p + a * R['seg']

    def fn(t, u):
        if not st:
            tg, body = targets(0)
            st.update(t=0., yaw=body['yaw'], pz=body['pz'], body=body, a={k: list(v) for k, v in tg.items()}, v={k: [V((0, 0, 0))] * NT for k in ALL})
            if loop:  # pre-roll one cycle so the loop starts in its own steady state
                integrate(dur)
                st['t0'] = dur
            else:  # settle on the first target before recording
                for _ in range(30):
                    integrate(st['t'] + SUB)
                    st['t'] = 0.
                st['t0'] = 0.
        integrate(st['t0'] + t)
        body = st['body']
        P = {'pelvis': {'loc': (0, body['py'], .06 * math.sin(W * t) + body['pz'])},
             'chest': {'q': q_axis(X, .04 * math.sin(W * t) + body['lean'])},
             'head': {'q': q_axis(Z, .12 * math.sin(W * t * .5)) @ q_axis(X, .05 * math.sin(W * t + 1) + body['head'])},
             'shards': {'q': q_axis(Z, W * t / 3), 'loc': (0, 0, .15 * math.sin(W * t))}}
        if body['yaw']:
            P['root'] = {'q': q_axis(Z, body['yaw'])}
        mo = .04 * (1 + math.sin(W * t * 2)) + body['maw']
        P['maw.L'] = {'q': q_axis(Z, -.5 * mo)}
        P['maw.R'] = {'q': q_axis(Z, .5 * mo)}
        for key in ALL:  # parallel-transport the simulated directions into bone rotations
            R = REST[key]
            D = Quaternion()
            for k in range(NT):
                Dn = (D @ R['r'][k]).rotation_difference(st['a'][key][k]) @ D
                P[f'tent.{key[0]}{key[1]}_{k}'] = {'q': D.inverted() @ Dn}
                D = Dn
        for i, a, r, J in CLOTH:
            ax = V((math.sin(a), -math.cos(a), 0))
            for k in range(3):
                P[f'cloth{i}_{k}'] = {'q': q_axis(ax, .06 * math.sin(W * t * 2 - k + i * 1.7) + body['rag'] * (.5 if k == 0 else .2))}
        return P
    return fn


CLIPS = [('Idle', 3.0, clip(3.0, [], loop=True))]
CLIPS += [(n, d, clip(d, mv)) for n, (d, mv) in GENERIC.items()]
CLIPS += [(n, d, clip(d, mv)) for n, (d, mv) in ATTACKS.items()]
bake(arm, CLIPS)

blend = os.path.join(OUT, 'kragma.blend')
glb = os.path.join(OUT, 'kragma.glb')
export(glb, arm, body)
bpy.ops.wm.save_as_mainfile(filepath=blend)
prev = os.path.join(OUT, 'preview', 'kragma')
os.makedirs(os.path.dirname(prev), exist_ok=True)
preview(prev, arm, [('Idle', 0), ('agg4', 112), ('bomb4', 45), ('grind', 36), ('leap', 68), ('range', 56), ('rotate', 102), ('sling', 21),
                    ('closegrab', 69), ('swirl', 42)], (11, -19, 6.5), (0, 0, 4.2), lens=40)
preview(prev + '_back', arm, [('Idle', 0)], (10, 17, 8), (0, 0, 4.6), res=(700, 620), lens=36)
preview(prev + '_front', arm, [('Idle', 0)], (0, -20, 5.5), (0, 0, 4.6), res=(900, 620), lens=36)
print('TRIS', sum(len(p.vertices) - 2 for p in body.data.polygons), 'BONES', len(arm.data.bones), 'GLB', os.path.getsize(glb))
