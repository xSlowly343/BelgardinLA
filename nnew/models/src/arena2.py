"""Arena 2 — 크라그마의 사멸지 (Kragma's Annihilation Ground), gate II. Static low-poly GLB.
Run: blender -b --factory-startup --python arena2.py -- <out_dir>
From nnew/references/arena2: a carved stone disc (r 10.5, top at z 0) floating over a black glossy void, white rune rings,
red-robed cultists frozen mid-ritual on floating rocks round the rim, violet-pink-blue nebula with Kragma's spined ring.
"Terrain Destruction" (js/data.js 'terrain'): the floor collapses to r 8, later to about r 6 — so the outer ring
(8–10.5, objects outer_00..) and the middle ring (6–8, mid_00..) are separate chunks the arena can drop one by one."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bossgen import reset, out_dir, material, Mesh
from arenakit import *

reset()
OUT = out_dir()
rnd = random.Random(11)

M = dict(
    stone=material('DiscStone', (.17, .155, .2), .85),
    stone2=material('DiscStoneDark', (.11, .1, .13), .9),
    ridge=material('Ridge', (.26, .24, .29), .7, .15),
    groove=material('Groove', (.05, .045, .06), 1.),
    rune=material('Rune', (.85, .8, 1.), .3, emit=(.75, .7, 1.), strength=2.2),
    under=material('Underside', (.1, .08, .12), 1.),
    robe=material('CultistRobe', (.42, .05, .05), .8),
    blood=material('Blood', (.18, .01, .02), .5),
    rockf=material('FloatRock', (.14, .11, .17), 1.),
    void=material('VoidWater', (.01, .005, .015), .06, .9),
    ember=material('Ember', (1., .25, .1), .5, emit=(1., .2, .08), strength=5),
    neb1=material('NebulaViolet', (.2, .06, .32), 1., emit=(.22, .06, .36), strength=.45),
    neb2=material('NebulaPink', (.35, .08, .25), 1., emit=(.38, .08, .26), strength=.4),
    neb3=material('NebulaBlue', (.08, .22, .45), 1., emit=(.08, .25, .5), strength=.55),
    ringb=material('KragmaRing', (.24, .2, .26), .6, .3),
    eye=material('RingEye', (.2, .9, .85), .5, emit=(.25, .95, .85), strength=1.5),
)
SKY = [(e, material(f'NSky{k}', c, 1., emit=c, strength=1.)) for k, (e, c) in enumerate(
    [(-10, (.02, .008, .035)), (2, (.07, .03, .12)), (8, (.14, .05, .18)), (16, (.17, .06, .2)), (26, (.13, .05, .19)),
     (40, (.08, .04, .16)), (60, (.045, .025, .1)), (90, (.02, .012, .05))])]
RIDGES = [(1.2, .12, .016), (2.0, .18, .02), (3.0, .12, .014), (4.5, .3, .025), (6.0, .22, .02), (7.1, .12, .014), (8.0, .22, .02),
          (9.0, .14, .014), (10.3, .3, .025)]                    # (radius, width, height) carved ridges; kept under 0.03 = arena.js telegraph height
RUNES = [(4.5, .1), (9.55, .12)]                                 # glowing rune rings (radius, width)
RADIALS = [i / 24 * TAU for i in range(24)]                      # radial grooves between r 3 and the edge


def zone(m, r0, r1, a0, a1, depth, seed):
    """One piece of the disc: top slab with its share of ridges, grooves and runes, rocky underside."""
    slab(m, a0, a1, r0, r1, 0, .9, M['stone'] if seed % 3 else M['stone2'], gap=.03, jitter=.015, rnd=rnd)
    for r, w, h in RIDGES:
        if r0 + w / 2 < r < r1 - w / 2:
            slab(m, a0, a1, r - w / 2, r + w / 2, h, h + .02, M['ridge'], gap=.02)
            slab(m, a0, a1, r + w / 2 + .03, r + w / 2 + .1, .004, .02, M['groove'], gap=.0)
    for r, w in RUNES:
        if r0 < r < r1:
            n = max(2, int((a1 - a0) * r / .45))
            for k in range(n):  # dashed glyph ring: dashes with little cross ticks
                b0 = a0 + (a1 - a0) * k / n
                slab(m, b0, b0 + (a1 - a0) / n * .62, r - w / 2, r + w / 2, .012, .02, M['rune'], gap=0)
                if k % 3 == 0:
                    c = b0 + (a1 - a0) / n * .8
                    m.prism(V((math.cos(c) * (r - .2), math.sin(c) * (r - .2), .012)), V((math.cos(c) * (r + .2), math.sin(c) * (r + .2), .012)),
                            .025, .025, M['rune'], NONE, 3, flat=(1, .3))
    for a in RADIALS:
        if a0 + .01 < a < a1 - .01 and r1 > 3.1:
            p0, p1 = max(r0, 3.1), r1 - .15
            m.prism(V((math.cos(a) * p0, math.sin(a) * p0, .006)), V((math.cos(a) * p1, math.sin(a) * p1, .006)), .05, .05, M['groove'], NONE, 4, flat=(1, .2))
    am = (a0 + a1) / 2
    for k in range(3):  # rocky roots under the piece
        rr = r0 + (r1 - r0) * rnd.uniform(.25, .75)
        aa = a0 + (a1 - a0) * rnd.uniform(.2, .8)
        rad = min(1.3, rnd.uniform(.6, 1.2) * (r1 - r0) / 2.5 + .4)
        rock(m, (math.cos(aa) * rr, math.sin(aa) * rr, -1.0 - rad * 1.7 - rnd.uniform(0, depth)), rad, M['under'], seed=seed * 7 + k, squash=(1, 1, 1.6))


objs = []
# core (r < 6): one piece with a deep jagged underside cone and a central medallion
C = Mesh()
for k in range(8):
    zone(C, 0, 6, k / 8 * TAU, (k + 1) / 8 * TAU, 2.5, k)
cyl(C, 6, 1.2, -.9, -10, M['under'], 16, cap=True, jitter=.35, seed=3)
cyl(C, 3.5, .2, -6, -15, M['under'], 9, cap=True, jitter=.5, seed=4)
cyl(C, .9, .95, 0, .022, M['ridge'], 24)
ring_strip(C, .7, .08, .026, M['rune'], 32)
objs.append(C.build('core'))
# middle ring 6–8 and outer ring 8–10.5: separate chunks with uneven seams
for name, r0, r1, n, depth in (('mid', 6, 8, 8, 3.5), ('outer', 8, 10.5, 10, 4.5)):
    cuts = sorted((k + rnd.uniform(-.25, .25)) / n * TAU for k in range(n))
    for k in range(n):
        a0, a1 = cuts[k], (cuts[(k + 1) % n] + (TAU if k == n - 1 else 0))
        m = Mesh()
        zone(m, r0, r1, a0, a1, depth, 50 + k + (0 if name == 'mid' else 20))
        objs.append(m.build(f'{name}_{k:02d}'))

# cultists on floating rocks round the rim
K = Mesh()
for k in range(12):
    a = k / 12 * TAU + .13
    rr = 12.6 + rnd.uniform(-.3, .5)
    x, y = math.cos(a) * rr, math.sin(a) * rr
    z = rnd.uniform(-.6, .3)
    rock(K, (x, y, z - .5), 1.1, M['rockf'], seed=300 + k, squash=(1.2, 1.2, .55))
    rock(K, (x, y, z - 1.6), .7, M['rockf'], seed=320 + k, squash=(1, 1, 1.4))
    hooded(K, x, y, z, a + math.pi / 2, M['robe'], None, rnd, h=2.4, arms=rnd.uniform(.5, 1.))
    K.prism(V((x, y, z + .05)), V((x, y, z + .5)), .74, .62, M['blood'], NONE, 8)           # blood-soaked hem
    K.prism(V((x + .2, y - .1, z + .9)), V((x + .15, y - .2, z + 1.3)), .22, .05, M['blood'], NONE, 5)  # stains
cultists = K.build('cultists')
objs.append(cultists)

# the void: black glossy water far below, floating debris and embers
Vd = Mesh()
disc(Vd, 220, -16, M['void'], 64)
for k in range(70):
    a = rnd.random() * TAU
    rr = 16 + rnd.random() ** .7 * 70
    rock(Vd, (math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(-12, 22)), rnd.uniform(.4, 3.2), M['rockf'], seed=500 + k, squash=(1, 1, rnd.uniform(.5, 1.2)))
for k in range(320):
    a = rnd.random() * TAU
    rr = 11 + rnd.random() * 55
    c = V((math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(-6, 18)))
    s = rnd.uniform(.05, .14)
    Vd.add([c + V((s, 0, 0)), c + V((-s, s, 0)), c + V((-s, -s, 0)), c + V((0, 0, s * 1.6))], [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]], M['ember'], NONE)
void = Vd.build('void')
objs.append(void)

# sky: nebula dome, glowing clouds, Kragma's spined ring with a teal eye
S = Mesh()
sky_dome(S, 240, SKY, 48)
for k in range(140):  # nebula wisps: many smaller, subdivided puffs instead of a few flat slabs
    a = rnd.random() * TAU
    rr = 130 + rnd.random() * 80
    mat = rnd.choice((M['neb1'], M['neb1'], M['neb1'], M['neb2'], M['neb3']))
    rock(S, (math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(-15, 80)), rnd.uniform(8, 20), mat, seed=700 + k, squash=(2.2, 1.6, .55), sub=1)
RC, RR = V((0, 150, 55)), 32
for k in range(40):  # ring of vertebrae, facing the platform
    a = k / 40 * TAU
    p = RC + V((math.cos(a) * RR, 0, math.sin(a) * RR))
    t = V((-math.sin(a), 0, math.cos(a)))
    S.prism(p - t * 2.2, p + t * 2.2, 2.6, 2.2, M['ringb'], NONE, 7)
    S.prism(p, p + V((math.cos(a), 0, math.sin(a))) * (6 + 3 * (k % 2)), 1.0, 0, M['ringb'], NONE, 4)
    S.prism(p, p - V((math.cos(a), 0, math.sin(a))) * 3, .6, 0, M['ringb'], NONE, 4)
for k in range(24):
    a = k / 24 * TAU
    S.prism(RC + V((0, 2, 0)), RC + V((math.cos(a) * RR * .85, 2, math.sin(a) * RR * .85)), 1.5, .2, M['eye'] if k % 2 else M['neb3'], NONE, 3, flat=(1, .2))
rock(S, RC + V((0, 1, 0)), 7, M['eye'], seed=900, squash=(1, .3, 1))
sky = S.build('sky')
objs.append(sky)

glb = os.path.join(OUT, 'arena2.glb')
export_static(glb, objs)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'arena2.blend'))
print('TRIS', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs), 'OBJS', len(objs), 'GLB', os.path.getsize(glb))
if '--no-preview' not in sys.argv:
    os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
    render_shots(os.path.join(OUT, 'preview', 'arena2'), [
        ('overview', (0, -26, 15), (0, 4, -1), 24), ('ground', (8, -12, 2.2), (-2, 10, 4), 22),
        ('top', (0, -.1, 44), (0, 0, 0), 40), ('below', (18, -22, -8), (0, 0, -2), 28)],
        world=(.05, .03, .08), sun=((math.radians(55), 0, math.radians(30)), 3.0, (.85, .75, 1.)))
