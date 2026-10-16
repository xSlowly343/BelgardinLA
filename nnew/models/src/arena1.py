"""Arena 1 — 거룩한 안식의 묘원 (Holy Rest Cemetery), gate I. Static low-poly GLB.
Run: blender -b --factory-startup --python arena1.py -- <out_dir>
Layout from nnew/references/arena1 (official overview 01, sky 02): a round flagstone platform (r 10.5, top at z 0) with a rim
step and two pale inlaid rings, sunk in a misty graveyard; crypt with clock and spire to the north (+Y), hooded statues,
dead trees, candles and braziers, gothic spires and pines in the distance, storm sky with a dark vortex dome overhead."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bossgen import reset, out_dir, material, Mesh
from arenakit import *

reset()
OUT = out_dir()
rnd = random.Random(7)

M = dict(
    flag=material('Flagstone', (.24, .23, .25), .92),
    flag2=material('FlagstoneDark', (.17, .165, .18), .95),
    rim=material('RimStone', (.13, .12, .14), .95),
    inlay=material('Inlay', (.6, .6, .68), .4, emit=(.35, .35, .45), strength=.8),
    sigil=material('Sigil', (.35, .25, .5), .5, emit=(.3, .12, .55), strength=1.5),
    earth=material('Earth', (.07, .06, .07), 1.),
    grave=material('GraveStone', (.2, .19, .21), .9),
    moss=material('MossStone', (.14, .15, .13), .95),
    iron=material('Iron', (.05, .05, .06), .5, .8),
    wood=material('DeadWood', (.09, .075, .08), .95),
    crypt=material('CryptStone', (.17, .16, .19), .85),
    roof=material('Slate', (.08, .08, .1), .7, .2),
    clock=material('ClockFace', (.5, .48, .42), .4, emit=(.25, .22, .15), strength=.6),
    flame=material('Flame', (1., .5, .15), .5, emit=(1., .42, .1), strength=2.5),
    far=material('FarSilhouette', (.09, .09, .12), 1.),
    pine=material('Pine', (.06, .07, .08), 1.),
    cloud=material('StormCloud', (.12, .12, .16), 1., emit=(.05, .05, .07), strength=1),
    vortex=material('Vortex', (.02, .015, .03), 1.),
    vglow=material('VortexGlow', (.3, .15, .55), .5, emit=(.38, .16, .75), strength=1.2),
    blob=material('BlackBlob', (.01, .01, .012), 1.),
)
SKY = [(e, material(f'Sky{k}', c, 1., emit=c, strength=1.)) for k, (e, c) in enumerate(
    [(-5, (.03, .03, .045)), (4, (.1, .1, .135)), (10, (.13, .13, .17)), (18, (.11, .11, .15)), (30, (.08, .08, .11)),
     (45, (.055, .055, .08)), (65, (.035, .035, .055)), (90, (.02, .02, .035))])]

# ---------------------------------------------------------------- platform
P = Mesh()
# flagstone rings (radial rows), inner sigil disc, rim step
r = 2.3
row = 0
while r < 10.5:
    w = min(.95 + .15 * rnd.random(), 10.5 - r)
    n = max(8, int(TAU * (r + w / 2) / (1.0 + .3 * rnd.random())))
    off = rnd.random() * TAU / n
    for i in range(n):
        a0 = off + i / n * TAU
        slab(P, a0, a0 + TAU / n, r, r + w, -.01 + rnd.uniform(-.012, .012), .25, M['flag'] if (i + row) % 5 else M['flag2'], gap=.035, jitter=.02, rnd=rnd)
    r += w
    row += 1
disc(P, 2.3, -.02, M['flag2'], 48)
cyl(P, 10.5, 10.6, -.6, -.02, M['rim'], 96, cap=False)
for i in range(64):  # rim step blocks
    a0 = i / 64 * TAU
    slab(P, a0, a0 + TAU / 64, 10.6, 11.6, -.3, .5, M['rim'] if i % 3 else M['flag2'], gap=.03, jitter=.03, rnd=rnd)
cyl(P, 11.6, 11.7, -1.0, -.3, M['rim'], 96, cap=False)
platform = P.build('platform')

I = Mesh()
ring_strip(I, 9.3, .13, .004, M['inlay'], 128)
ring_strip(I, 5.2, .1, .004, M['inlay'], 96)
ring_strip(I, 2.3, .08, .004, M['sigil'], 64)
for k in range(5):  # cracked pentagram in the centre disc
    a, b = k / 5 * TAU + TAU / 4, (k + 2) / 5 * TAU + TAU / 4
    p0, p1 = V((math.cos(a) * 2.1, math.sin(a) * 2.1, .006)), V((math.cos(b) * 2.1, math.sin(b) * 2.1, .006))
    I.prism(p0, p1, .035, .035, M['sigil'], NONE, 4, flat=(1, .3))
for k in range(9):  # cracks running out from the centre
    a = rnd.random() * TAU
    p = V((0, 0, .005))
    for s in range(3):
        q = p + V((math.cos(a), math.sin(a), 0)) * rnd.uniform(.6, 1.4)
        I.prism(p, q, .02, .01, M['sigil'], NONE, 3, flat=(1, .3))
        p, a = q, a + rnd.uniform(-.6, .6)
inlays = I.build('inlays')

# ---------------------------------------------------------------- graveyard
G = Mesh()
ground_disc(G, 11.7, 70, -.9, M['earth'], rings=16, segs=80, amp=.6, seed=3., drop=1.5)
CRYPT = V((0, 25))
for i in range(170):
    a = rnd.random() * TAU
    rr = 13 + rnd.random() ** .8 * 24
    x, y = math.cos(a) * rr, math.sin(a) * rr
    if (V((x, y)) - CRYPT).length < 8:
        continue
    headstone(G, x, y, height_at(x, y, -.9, .6, 3.) + .05, a + math.pi / 2 + rnd.uniform(-.4, .4), rnd.choice((0, 0, 0, 1, 2)), M['grave'] if rnd.random() < .7 else M['moss'], rnd)
for k in range(10):  # iron fences around plots
    a = rnd.random() * TAU
    rr = 15 + rnd.random() * 14
    cx, cy = math.cos(a) * rr, math.sin(a) * rr
    if (V((cx, cy)) - CRYPT).length < 8:
        continue
    w, d = rnd.uniform(2.5, 4), rnd.uniform(2, 3)
    rot = rnd.random() * math.pi
    R = Matrix.Translation((cx, cy, height_at(cx, cy, -.9, .6, 3.))) @ Matrix.Rotation(rot, 4, 'Z')
    corners = [R @ V(p) for p in ((-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0))]
    for e in range(4 if rnd.random() < .6 else 3):
        p0, p1 = corners[e], corners[(e + 1) % 4]
        n = int((p1 - p0).length / .35)
        for s in range(n + 1):
            p = p0.lerp(p1, s / n)
            G.prism(p, p + V((0, 0, 1.1 + .1 * (s % 2))), .025, .0 if s % 2 else .02, M['iron'], NONE, 4)
        G.prism(p0 + V((0, 0, .95)), p1 + V((0, 0, .95)), .025, .025, M['iron'], NONE, 4)
        G.prism(p0 + V((0, 0, .3)), p1 + V((0, 0, .3)), .02, .02, M['iron'], NONE, 4)
for k in range(8):  # broken pillars and an arch fragment
    a = k / 8 * TAU + rnd.uniform(-.2, .2)
    rr = 13.5 + rnd.random() * 3
    x, y = math.cos(a) * rr, math.sin(a) * rr
    if (V((x, y)) - CRYPT).length < 9:
        continue
    h = rnd.uniform(1.5, 4)
    G.prism(V((x, y, -.9)), V((x, y, -.9 + h)), .35, .3, M['crypt'], NONE, 8)
    G.box(V((x, y, -.9 + h + .1)), (.8, .8, .2), M['crypt'], NONE, rot=(rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), a))
    rock(G, (x + rnd.uniform(-1, 1), y + rnd.uniform(-1, 1), -.8), .4, M['crypt'], seed=k)
for k in range(6):  # hooded statues on plinths, facing the platform
    a = k / 6 * TAU + .5
    rr = 16 + rnd.random() * 3
    x, y = math.cos(a) * rr, math.sin(a) * rr
    if (V((x, y)) - CRYPT).length < 9:
        a += .5
        x, y = math.cos(a) * rr, math.sin(a) * rr
    hooded(G, x, y, height_at(x, y, -.9, .6, 3.), a + math.pi / 2, M['grave'], M['crypt'], rnd, h=3.2, arms=None)
for k in range(18):  # dead trees, kept beyond the arena camera's orbit (dist 23, el 48°) so they don't block the view
    a = rnd.random() * TAU
    rr = 21 + rnd.random() ** .7 * 20
    x, y = math.cos(a) * rr, math.sin(a) * rr
    if (V((x, y)) - CRYPT).length < 7:
        continue
    dead_tree(G, x, y, height_at(x, y, -.9, .6, 3.), rnd.uniform(5, 11), M['wood'], rnd)
graveyard = G.build('graveyard')

# ---------------------------------------------------------------- crypt (north) and mausoleums
C = Mesh()


def crypt(c, w, d, h, spire_h, clock=True, rot=0.):
    R = Matrix.Translation(c) @ Matrix.Rotation(rot, 4, 'Z')
    g = lambda p: R @ V(p)
    C.box(g((0, 0, .3)), (w + 1, d + 1, .6), M['crypt'], NONE, rot=(0, 0, rot))           # stepped base
    C.box(g((0, 0, h / 2 + .6)), (w, d, h), M['crypt'], NONE, rot=(0, 0, rot))
    C.add([g((-w / 2 - .2, -d / 2 - .2, h + .6)), g((w / 2 + .2, -d / 2 - .2, h + .6)), g((w / 2 + .2, d / 2 + .2, h + .6)),
           g((-w / 2 - .2, d / 2 + .2, h + .6)), g((0, -d / 2 - .2, h + .6 + w * .55)), g((0, d / 2 + .2, h + .6 + w * .55))],
          [[0, 1, 4], [3, 5, 2], [0, 4, 5, 3], [1, 2, 5, 4], [0, 3, 2, 1]], M['roof'], NONE)          # pitched roof
    for sx in (-1, 1):  # front columns and corner pinnacles
        C.prism(g((sx * w * .32, -d / 2 - .5, .6)), g((sx * w * .32, -d / 2 - .5, .6 + h * .85)), .22, .2, M['crypt'], NONE, 8)
        C.prism(g((sx * w / 2, -d / 2, h + .6)), g((sx * w / 2, -d / 2, h + 2.2)), .18, 0, M['crypt'], NONE, 4)
    C.box(g((0, -d / 2 - .02, .6 + h * .35)), (w * .32, .06, h * .7), M['vortex'], NONE, rot=(0, 0, rot))   # dark doorway
    if clock:
        C.prism(g((0, -d / 2 - .25, h + .6 + w * .25)), g((0, -d / 2 - .3, h + .6 + w * .25)), w * .16, w * .16, M['clock'], NONE, 16)
        for k in range(2):
            a = k * 1.9 + .4
            C.prism(g((0, -d / 2 - .33, h + .6 + w * .25)), g((math.sin(a) * w * .12, -d / 2 - .33, h + .6 + w * .25 + math.cos(a) * w * .12)), .03, .015, M['iron'], NONE, 3)
    if spire_h:
        spire(C, *g((0, d * .15, h + .6 + w * .3)), w * .35, spire_h, M['crypt'], rnd, rot)


crypt(V((0, 25, -1.1)), 7, 6, 6.5, 13)
crypt(V((-15, 21, -1.1)), 4, 4, 4, 0, False, .5)
crypt(V((15, 22, -1.1)), 4, 4.5, 4.5, 6, False, -.45)
crypts = C.build('crypts')

# ---------------------------------------------------------------- lights: candles on graves, braziers round the rim
L = Mesh()
for k in range(8):
    a = k / 8 * TAU + .2
    x, y = math.cos(a) * 12.4, math.sin(a) * 12.4
    L.prism(V((x, y, -.3)), V((x, y, 1.0)), .08, .06, M['iron'], NONE, 6)
    L.prism(V((x, y, 1.0)), V((x, y, 1.35)), .12, .32, M['iron'], NONE, 8)
    L.prism(V((x, y, 1.2)), V((x, y, 1.9)), .2, 0, M['flame'], NONE, 5)
for k in range(40):
    a = rnd.random() * TAU
    rr = 13 + rnd.random() * 20
    x, y = math.cos(a) * rr, math.sin(a) * rr
    z = height_at(x, y, -.9, .6, 3.)
    L.prism(V((x, y, z)), V((x, y, z + .25)), .05, .05, M['grave'], NONE, 5)
    L.prism(V((x, y, z + .25)), V((x, y, z + .42)), .05, 0, M['flame'], NONE, 4)
lights = L.build('flames')

# ---------------------------------------------------------------- far: spires, cathedral, pines
F = Mesh()
for k in range(22):
    a = k / 22 * TAU + rnd.uniform(-.1, .1)
    rr = 42 + rnd.random() * 25
    spire(F, math.cos(a) * rr, math.sin(a) * rr, -2.5, rnd.uniform(2, 4.5), rnd.uniform(10, 26), M['far'], rnd, a)
spire(F, -16, 58, -2.5, 9, 34, M['far'], rnd, .2)  # cathedral, as in the overview
spire(F, -8, 60, -2.5, 6, 26, M['far'], rnd, .2)
F.box(V((-12, 59, 5)), (12, 7, 15), M['far'], NONE, rot=(0, 0, .2))
for k in range(90):
    a = rnd.random() * TAU
    rr = 48 + rnd.random() * 30
    pine(F, math.cos(a) * rr, math.sin(a) * rr, -2.5, rnd.uniform(7, 13), M['pine'], rnd)
far = F.build('far')

# ---------------------------------------------------------------- sky: dome, storm clouds, vortex dome, floating black blobs
S = Mesh()
sky_dome(S, 220, SKY, 48)
for k in range(46):
    a = rnd.random() * TAU
    rr = 60 + rnd.random() * 90
    rock(S, (math.cos(a) * rr, math.sin(a) * rr, 26 + rnd.random() * 30), rnd.uniform(10, 22), M['cloud'], seed=100 + k, squash=(1.6, 1.2, .35))
disc(S, 30, 62, M['vortex'], 48)
cyl(S, 30, 34, 61.5, 62.5, M['vglow'], 64, cap=False)
for k in range(14):  # violet streaks spiralling out of the vortex
    a = k / 14 * TAU
    p0 = V((math.cos(a) * 31, math.sin(a) * 31, 61))
    p1 = V((math.cos(a + .5) * 52, math.sin(a + .5) * 52, 52 + rnd.uniform(-4, 4)))
    S.prism(p0, p1, .5, .05, M['vglow'], NONE, 4, flat=(1, .2))
for k in range(9):
    a = rnd.random() * TAU
    rr = 14 + rnd.random() * 26
    rock(S, (math.cos(a) * rr, math.sin(a) * rr, 18 + rnd.random() * 14), rnd.uniform(.4, 1.1), M['blob'], seed=200 + k, squash=(1, 1, 1))
sky = S.build('sky')

objs = [platform, inlays, graveyard, crypts, lights, far, sky]
glb = os.path.join(OUT, 'arena1.glb')
export_static(glb, objs)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'arena1.blend'))
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
print('TRIS', tris, 'GLB', os.path.getsize(glb))
if '--no-preview' not in sys.argv:
    os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
    render_shots(os.path.join(OUT, 'preview', 'arena1'), [
        ('overview', (0, -30, 17), (0, 6, -1), 24),     # like the official overview, looking north at the crypt
        ('ground', (9, -13, 2.2), (-2, 10, 2.5), 22),
        ('top', (0, -.1, 48), (0, 0, 0), 40), ('sky', (6, -10, 1.5), (-2, 6, 30), 18)],
        world=(.05, .05, .07), sun=((math.radians(50), 0, math.radians(-35)), 4.0, (.75, .78, .95)))
