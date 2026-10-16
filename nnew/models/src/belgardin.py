"""Belgardin, Hand of Death (gate I) — low-poly rigged model with arena clips.
Run: blender -b --factory-startup --python belgardin.py -- <out_dir>
Generic clips match the action names in js/arena.js poseA() (Idle, Raise, Swing, Slam, Spin, Guard, Coffin, Cast, Flap);
the lowercase clips are the gate I attacks of js/data.js with the same keys and durations."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bossgen import *

reset()
OUT = out_dir()
TAU = math.tau

# ---------------- materials ----------------
M = dict(
    robe=material('Robe', (.075, .055, .1), .8),
    robe2=material('RobeLining', (.14, .07, .21), .7, emit=(.06, .015, .12), strength=.6),
    armor=material('Armor', (.06, .05, .08), .35, .75),
    fur=material('Fur', (.62, .6, .68), 1.),
    furD=material('FurDark', (.36, .34, .42), 1.),
    skin=material('Skin', (.84, .82, .88), .5),
    lip=material('Lip', (.25, .16, .26), .5),
    hair=material('Hair', (.82, .82, .88), .5, .1),
    glow=material('Glow', (.7, .45, 1.), .3, emit=(.62, .35, 1.), strength=6),
    steel=material('Steel', (.62, .68, .8), .15, .95, emit=(.05, .1, .14), strength=1),
    gold=material('Gold', (.55, .4, .18), .3, .9),
    coffin=material('Coffin', (.14, .08, .07), .55, .35, emit=(.18, .02, .02), strength=1),
    ribbon=material('Ribbon', (.09, .06, .13), .7, emit=(.05, .01, .09), strength=1),
)

# ---------------- skeleton ----------------
B = [('root', (0, 0, 0), (0, 0, .5), None),
     ('hips', (0, 0, 2.4), (0, 0, 2.8), 'root'),
     ('spine', (0, 0, 2.8), (0, 0, 3.25), 'hips'),
     ('chest', (0, 0, 3.25), (0, 0, 3.65), 'spine'),
     ('neck', (0, 0, 3.65), (0, 0, 3.85), 'chest'),
     ('head', (0, 0, 3.85), (0, 0, 4.35), 'neck')]
for s, S in ((1, 'L'), (-1, 'R')):
    B += [(f'shoulder.{S}', (.12 * s, 0, 3.55), (.55 * s, 0, 3.5), 'chest'),
          (f'upperarm.{S}', (.6 * s, 0, 3.45), (.68 * s, 0, 2.8), f'shoulder.{S}'),
          (f'forearm.{S}', (.68 * s, 0, 2.8), (.7 * s, -.06, 2.15), f'upperarm.{S}'),
          (f'hand.{S}', (.7 * s, -.06, 2.15), (.7 * s, -.08, 1.95), f'forearm.{S}')]
B += [('sword', (-.7, -.08, 1.95), (-.7, -.08, 1.45), 'hand.R'),
      ('coffin', (.7, -.12, 1.95), (.7, -.12, 1.55), 'hand.L')]
SWORDS = [(-1.0, .5, 4.85, -.16), (0, .62, 5.2, 0), (1.0, .5, 4.85, .16)]  # (x, y, guard height, tilt): hilts up, blades down
for i, (x, y, z, tilt) in enumerate(SWORDS):
    B.append((f'blade{i}', (x, y, z - .3), (x, y, z + .3), 'chest'))
HAIR = [V((0, .2, 4.22)), V((0, .34, 3.78)), V((0, .42, 3.2))]
B += chain('hair', HAIR, 'head')

# robe: 12 tattered strips around the waist, 3 bones each
ROBE = []
NR = 18
for i in range(NR):
    a = i / NR * TAU - TAU / 4 + .06 * math.sin(i * 2.3)  # i = 0 front (-Y)
    r = V((math.cos(a), math.sin(a), 0))
    back = max(0., r.y)  # strips at the back are longer and trail behind
    top = V((0, 0, 2.62)) + r * .5
    bot = V((0, 0, .06 + .35 * ((i * 7) % 3 == 0))) + r * (1.0 + .25 * back + .1 * (i % 2)) + V((0, .45 * back, 0))
    mid1 = top.lerp(bot, .4) + r * .1
    mid2 = top.lerp(bot, .78) - r * .12
    J = [top, mid1, mid2, bot]
    ROBE.append((i, a, r, J))

# root-like tendrils: the hem dissolves into long thin ribbons that splay out over the floor
TEN = []
for i in range(16):
    a = (i + .5) / 16 * TAU - TAU / 4 + .1 * math.sin(i * 1.7)
    r = V((math.cos(a), math.sin(a), 0))
    reach = 1.7 + .6 * ((i * 5) % 4) / 3
    J = [V((0, 0, 1.25)) + r * .62, V((0, 0, .55)) + r * .95, V((0, 0, .12)) + r * (reach * .75),
         V((0, 0, .02)) + r * reach + V((-r.y, r.x, 0)) * .35 * math.sin(i)]
    TEN.append((i, a, r, J))

# robe and tendrils are skinned to 9 sector chains around the waist (keeps the bone count and the GLB small)
NS = 9
SKIRT = []
for i in range(NS):
    a = i / NS * TAU - TAU / 4
    r = V((math.cos(a), math.sin(a), 0))
    J = [V((0, 0, 2.62)) + r * .5, V((0, 0, 1.6)) + r * .82, V((0, 0, .7)) + r * 1.05, V((0, 0, .04)) + r * 1.45]
    SKIRT.append((i, a, r, J))
    B += chain(f'skirt{i}_', J, 'hips')


def sector(a):
    return round(((a + TAU / 4) % TAU) / TAU * NS) % NS

# cape: two wide strips down the back
CAPE = []
for s, S in ((1, 'L'), (-1, 'R')):
    J = arc((.3 * s, .42, 3.48), (.08 * s, .25, -1), 3.4, 3, (1, 0, 0), -.35)
    CAPE.append((S, s, J))
    B += chain(f'cape.{S}', J, 'chest')

# floating mantle: separate tattered strands fanning out from each shoulder, in three depth layers
# (angle below horizontal, length, root width, layer depth, droop)
MANTLE = [(-16, 5.8, .34, .5, .95), (4, 5.4, .3, .5, 1.05), (27, 4.6, .26, .5, .85),    # back layer, highest and longest
          (-5, 5.1, .32, .18, .8), (17, 4.8, .28, .18, .9), (40, 4.0, .24, .18, .75),   # middle layer
          (10, 4.3, .3, -.14, .65), (31, 3.7, .24, -.14, .6), (56, 3.1, .2, -.14, .5)]  # front layer, shorter
RIB = []
for s, S in ((1, 'L'), (-1, 'R')):
    for j, (ang, L, w, dy, droop) in enumerate(MANTLE):
        a = math.radians(ang)
        d = V((math.cos(a) * s, .12 + dy * .4, -math.sin(a)))
        axis = d.cross(V((0, 0, -1)))
        J = arc(((.36 + .12 * (j % 3)) * s, .15 + dy, 3.62 - .1 * (j % 3) + .08 * (j // 3 == 0)), d, L, 4, axis, droop)
        RIB.append((S, s, j, J, axis.normalized(), w))
        B += chain(f'rib.{S}{j}_', J, f'shoulder.{S}')

arm = armature('Belgardin_Rig', B)

# ---------------- mesh ----------------
m = Mesh()


def torso_w(v):
    z = v.z
    if z < 2.8:
        return [('hips', 1.)]
    if z < 3.2:
        f = (z - 2.8) / .4
        return [('hips', 1 - f), ('spine', f)]
    f = min(1, (z - 3.2) / .25)
    return [('spine', 1 - f), ('chest', f)]


# body
m.lathe([(.4, 2.4), (.42, 2.62), (.36, 2.95), (.44, 3.2), (.52, 3.42), (.42, 3.58), (.16, 3.66)], M['armor'], torso_w, sides=8, scale=(1, .78))
m.lathe([(.78, .55), (.66, 1.3), (.54, 2.1), (.44, 2.66)], M['robe2'], 'hips', sides=10, jitter=.15, seed=3)  # under-skirt
# chest plate ridges and core
for k in range(3):
    z = 3.05 + k * .16
    m.prism((-.32 + k * .05, -.33, z), (.32 - k * .05, -.33, z + .05), .045, .045, M['gold'], 'chest' if z > 3.2 else 'spine', 4)
m.ico((0, -.42, 3.32), .1, M['glow'], 'chest', 1, (1, .6, 1.4))
for s in (1, -1):
    m.spike((.18 * s, -.36, 3.4), (.3 * s, -.5, 3.62), .06, M['armor'], 'chest')
for s in (1, -1):  # gold filigree V's and glowing veins from the core
    for k in range(3):
        z = 3.1 + k * .14
        m.prism((.05 * s, -.38, z), ((.18 + .07 * k) * s, -.33, z + .18), .018, .018, M['gold'], 'chest' if z > 3.2 else 'spine', 4)
    for k, (dx, dz) in enumerate(((.22, .14), (.26, -.06), (.12, -.22))):
        m.prism((.03 * s, -.44, 3.32), (dx * s, -.37, 3.32 + dz), .012, .006, M['glow'], 'chest', 3)
# belt with hanging tassels
m.prism((0, 0, 2.58), (0, 0, 2.72), .46, .46, M['gold'], 'hips', 10)
for k in range(8):
    a = k / 8 * TAU + .2
    p = V((math.cos(a) * .47, math.sin(a) * .38, 2.6))
    m.spike(p, p + V((math.cos(a) * .06, math.sin(a) * .06, -.45 - .15 * (k % 2))), .03, M['gold'] if k % 2 else M['armor'], 'hips', 3)
# fur collar: lumpy ring of icospheres + tufts
for k in range(16):
    a = k / 16 * TAU
    c = V((math.cos(a) * .45, math.sin(a) * .38, 3.62 + .05 * math.sin(a * 3)))
    m.ico(c, .22 + .04 * (k % 3), M['fur'] if k % 4 else M['furD'], 'chest', 1, (1.15, 1, .75), jitter=.35, seed=k)
for layer in range(2):  # two layers of tufts: a ragged ash-grey mane over the shoulders
    for k in range(20):
        a = k / 20 * TAU + .1 + layer * .15
        base = V((math.cos(a) * (.58 + .1 * layer), math.sin(a) * (.5 + .08 * layer), 3.62 - .12 * layer))
        tip = base + V((math.cos(a) * (.32 + .1 * layer), math.sin(a) * .28, -.15 - .12 * (k % 3) - .15 * layer))
        m.spike(base, tip, .09 - .015 * layer, M['fur'] if (k + layer) % 3 else M['furD'], 'chest')
# head
m.prism((0, 0, 3.62), (0, 0, 3.9), .11, .1, M['skin'], 'neck', 6)
m.ico((0, -.02, 4.08), .25, M['skin'], 'head', 2, (.82, .9, 1.12))
m.prism((0, -.17, 3.98), (0, -.12, 3.86), .08, .0, M['skin'], 'head', 4)  # chin/jaw point
for s in (1, -1):
    m.box((.085 * s, -.215, 4.1), (.07, .02, .025), M['glow'], 'head', rot=(0, .25 * s, 0))
    m.box((.09 * s, -.215, 4.15), (.11, .03, .025), M['hair'], 'head', rot=(0, .25 * s, -.18 * s))  # brow
    m.prism((.13 * s, -.17, 4.03), (.09 * s, -.2, 3.94), .035, .0, M['skin'], 'head', 4)  # cheekbone
m.spike((0, -.2, 4.12), (0, -.255, 4.02), .03, M['skin'], 'head', 3)  # nose
m.box((0, -.2, 3.97), (.07, .015, .012), M['lip'], 'head')
# hair: cap + long strands flowing down the back + side locks
m.ico((0, .08, 4.17), .26, M['hair'], 'head', 1, (.92, .86, 1.0), jitter=.12, seed=11)
for k in range(7):
    x = (k - 3) * .075
    J = [h + V((x * (1 + i * .5), -.02 * abs(k - 3), 0)) for i, h in enumerate(HAIR)]
    J = [V((0, -.02, 4.36)) + V((x * .3, 0, 0))] + J
    m.strip(J, ['head', 'hair0', 'hair1'], lambda f: .16 * (1 - f * .7), M['hair'], (0, 1, .2), per=2, tip='point', seed=k)
for s in (1, -1):
    m.strip([V((.2 * s, -.12, 4.3)), V((.27 * s, -.14, 4.0)), V((.28 * s, -.05, 3.62))], ['head', 'head'], lambda f: .12 * (1 - f * .6),
            M['hair'], (s, -.3, 0), per=2, tip='point')
    m.spike((.12 * s, -.2, 4.3), (.2 * s, -.27, 4.05), .05, M['hair'], 'head')
# shoulders / arms
for s, S in ((1, 'L'), (-1, 'R')):
    m.ico((.62 * s, 0, 3.5), .26, M['armor'], f'shoulder.{S}', 1, (1.1, 1, .7))
    for k in range(3):
        m.spike((.55 * s + .08 * k * s, -.08 + .08 * k, 3.6), (.75 * s + .14 * k * s, -.08 + .1 * k, 3.98 - .08 * k), .06, M['armor'], f'shoulder.{S}')
    m.prism((.63 * s, 0, 3.4), (.68 * s, 0, 2.82), .13, .11, M['robe'], f'upperarm.{S}', 6)
    m.prism((.68 * s, 0, 2.8), (.7 * s, -.06, 2.2), .11, .09, M['armor'], f'forearm.{S}', 6)
    m.prism((.69 * s, -.03, 2.55), (.7 * s, -.06, 2.0), .1, .3, M['robe'], f'forearm.{S}', 7)  # flared sleeve
    m.box((.7 * s, -.07, 2.06), (.1, .07, .17), M['skin'], f'hand.{S}')
    for k in range(4):
        m.spike((.66 * s + .025 * k * s, -.1, 1.98), (.65 * s + .035 * k * s, -.16, 1.72), .02, M['armor'], f'hand.{S}')
    for k in range(5):  # ragged sleeve hem
        a = k / 5 * TAU
        p = V((.7 * s + math.cos(a) * .27, -.06 + math.sin(a) * .27, 2.02))
        m.spike(p, p + V((math.cos(a) * .08, math.sin(a) * .08, -.35 - .1 * (k % 2))), .07, M['robe'], f'forearm.{S}', 3)
    m.prism((.66 * s, -.02, 2.75), (.7 * s, -.06, 2.25), .125, .105, M['gold'], f'forearm.{S}', 6)  # vambrace trim
    m.spike((.78 * s, -.02, 2.6), (.95 * s, .05, 2.75), .04, M['armor'], f'forearm.{S}')
# sword (held point-down, swings with the right hand)
hx, hy, hz = -.7, -.08, 2.02
m.prism((hx, hy, hz + .12), (hx, hy, hz - .12), .04, .04, M['armor'], 'sword', 6)
m.box((hx, hy, hz - .15), (.06, .36, .05), M['gold'], 'sword')
m.prism((hx, hy, hz - .17), (hx, hy, hz - 2.55), .1, .055, M['steel'], 'sword', 4, ref=V((1, 0, 0)), flat=(1, .2))
m.spike((hx, hy, hz - 2.55), (hx, hy, hz - 2.9), .055, M['steel'], 'sword', 4)
m.box((hx, hy - .015, hz - 1.3), (.012, .012, 2.2), M['glow'], 'sword')
# coffin (only visible in the Coffin clip: the coffin bone is scaled to 0 elsewhere)
cx, cy, cz = .7, -.12, 1.05
cof = [(0, .9), (.45, .6), (.36, -1.0), (-.36, -1.0), (-.45, .6), (0, .9)]
pts = [V((cx + x, cy, cz + z)) for x, z in cof[:-1]]
vs = [p + V((0, -.2, 0)) for p in pts] + [p + V((0, .2, 0)) for p in pts]
n = len(pts)
m.add(vs, [list(range(n))[::-1], [n + i for i in range(n)]] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)], M['coffin'], 'coffin')
m.box((cx, cy - .21, cz + .05), (.08, .02, 1.0), M['gold'], 'coffin')
m.box((cx, cy - .21, cz + .3), (.45, .02, .08), M['gold'], 'coffin')
# three ornate swords behind the back, hilts above the shoulders
for i, (x, y, z, tilt) in enumerate(SWORDS):
    R = Matrix.Translation((x, y, z)) @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Scale(1.15 if i == 1 else 1., 4)
    b = f'blade{i}'
    g = lambda p: R @ V(p)
    m.prism(g((0, 0, -.12)), g((0, 0, -2.5)), .13, .07, M['armor'], b, 4, ref=V((0, 1, 0)), flat=(1, .22))  # blade
    m.spike(g((0, 0, -2.5)), g((0, 0, -2.9)), .07, M['armor'], b, 4, ref=V((0, 1, 0)))
    m.prism(g((0, -.03, -.2)), g((0, -.03, -2.3)), .014, .008, M['glow'], b, 3)  # glowing fuller
    m.prism(g((-.5, 0, 0)), g((.5, 0, 0)), .06, .05, M['armor'], b, 4)  # crossguard
    for sx in (-1, 1):
        m.spike(g((.48 * sx, 0, 0)), g((.66 * sx, 0, .2)), .05, M['armor'], b, 4)  # upswept quillons
        m.spike(g((.3 * sx, 0, -.02)), g((.36 * sx, 0, -.28)), .035, M['armor'], b, 3)
        m.spike(g((.15 * sx, 0, .03)), g((.24 * sx, 0, .28)), .03, M['armor'], b, 3)
    m.ico(g((0, -.04, 0)), .1, M['glow'], b, 1, (1, .6, 1.2))  # gem in the guard
    m.prism(g((0, 0, .04)), g((0, 0, .5)), .05, .04, M['armor'], b, 6)  # grip
    for k in range(3):  # spiked thorn pommel
        a = (k - 1) * .6
        m.spike(g((0, 0, .48)), g((math.sin(a) * .2, 0, .58 + math.cos(a) * .25)), .05, M['armor'], b, 4)
    m.ico(g((0, -.02, .52)), .06, M['glow'], b, 0)
# robe strips
for i, a, r, J in ROBE:
    bones = [f'skirt{sector(a)}_{k}' for k in range(3)]
    w0, w1 = .26, .42 + .12 * (i % 3)
    m.strip(J, bones, lambda f, w0=w0, w1=w1: (w0 + (w1 - w0) * min(1, f * 1.4)) * (1 - max(0, f - .8) * 2.2),
            M['robe'] if i % 3 else M['robe2'], r, per=3, tip='fork' if i % 2 else 'point', seed=i, curl=.06)
for i, a, r, J in TEN:
    m.strip(J, [f'skirt{sector(a)}_{k}' for k in (1, 2, 2)], lambda f: .16 * (1 - f) + .02, M['robe2'] if i % 4 == 0 else M['robe'], r, per=3, tip='point', seed=80 + i, curl=.08)
for S, s, J in CAPE:
    m.strip(J, [f'cape.{S}{k}' for k in range(3)], lambda f: .7 + .35 * f, M['robe'], (0, 1, 0), per=3, tip='fork', seed=40 + s)
for S, s, j, J, axis, w in RIB:
    bones = [f'rib.{S}{j}_{k}' for k in range(4)]
    mat = (M['robe'], M['ribbon'], M['robe2'])[j % 3 if j < 6 else (j + 1) % 2]
    m.strip(J, bones, lambda f, w=w: w * (1 - .8 * f) ** .8 + .03, mat, (0, -1, .15), per=4, tip='fork' if j % 2 else 'point', seed=60 + j + 9 * (s > 0))
    if j < 3:  # back-layer strands get a split second tail for a more tattered edge
        m.strip([p + V((0, .03, -.08 * k)) for k, p in enumerate(J)], bones, lambda f, w=w: w * .5 * (1 - .9 * f) + .02, M['ribbon'], (0, -1, .15),
                per=3, tip='point', seed=90 + j)
body = m.build('Belgardin', arm)

# ---------------- animation ----------------
# Same scheme as kragma.py: every clip is a timeline of moves with the timings of the gate I sims in js/data.js.
# Moves pose the arms (sword, coffin, casts) directly and give *targets* to the 18 mantle strands — the strands are his
# whips: they lash out to points on the arena floor (heading 0 = front, 90 = boss right, clockwise; arena units).
# Strands and skirt follow their targets with spring physics (stiff roots, loose tips, inertia on spins and rises,
# no sinking into the floor or cutting through the body).
W = TAU / 2.4  # idle loop frequency
X, Y, Z = V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1))


def lift_side(s, a):  # raise an arm sideways (a > 0 = up, away from the body)
    return q_axis((0, -s, 0), a)


def lift_fwd(a):  # raise an arm forwards
    return q_axis(X, -a)


def hd(h, r=1., z=0.):
    a = math.radians(h)
    return V((-math.sin(a) * r, -math.cos(a) * r, z))


def bezier(P, n=24):
    return [P[0] * (1 - t) ** 3 + P[1] * 3 * (1 - t) ** 2 * t + P[2] * 3 * (1 - t) * t * t + P[3] * t ** 3 for t in (i / n for i in range(n + 1))]


def walk(poly, segs):
    out, cur, i = [], poly[0].copy(), 0
    for seg in segs:
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


# ---- chains driven by physics ----
CH = {}
for S, s, j, J, axis, w in RIB:
    CH[('rib', S, j)] = dict(bones=[f'rib.{S}{j}_{k}' for k in range(4)], J0=J[0].copy(), r=[(J[k + 1] - J[k]).normalized() for k in range(4)],
                             seg=[(J[k + 1] - J[k]).length for k in range(4)], ax=axis, s=s, j=j, L=sum((J[k + 1] - J[k]).length for k in range(4)),
                             k0=200., k1=55., col=True)
for i, a, r, J in SKIRT:
    CH[('skirt', i)] = dict(bones=[f'skirt{i}_{k}' for k in range(3)], J0=J[0].copy(), r=[(J[k + 1] - J[k]).normalized() for k in range(3)],
                            seg=[(J[k + 1] - J[k]).length for k in range(3)], ax=V((math.sin(a), -math.cos(a), 0)), a=a, k0=160., k1=60., col=False)
STR = [k for k in CH if k[0] == 'rib']
SIDE = {'L': [k for k in STR if k[1] == 'L'], 'R': [k for k in STR if k[1] == 'R']}
BACKL, MIDL, FRONTL = ([k for k in STR if k[2] in g] for g in ((0, 1, 2), (3, 4, 5), (6, 7, 8)))


def own(key):  # natural heading of a strand: its own side, spread by its rest angle
    return (270 if key[1] == 'L' else 90) + (key[2] % 3 - 1) * 14 * (1 if key[1] == 'L' else -1) - (key[2] // 3 - 1) * 10 * (1 if key[1] == 'L' else -1)


def sfk(key, t, up=0., flap=0., wave=.09, flare=0.):
    """Strand/skirt rest pose plus sway (FK), as segment directions."""
    c = CH[key]
    D, out = Quaternion(), []
    for k in range(len(c['r'])):
        if key[0] == 'rib':
            q = q_axis(c['ax'], wave * math.sin(W * t * 2 - k * .8 + c['j'] * .9) + flap * math.sin(W * t * 5 - k * .6) * (.3 + .1 * k) - up * (.55 if k == 0 else .12))
        else:
            q = q_axis(c['ax'], .05 * math.sin(W * t * 2 - k * .9 + key[1] * 1.3) + flare * (.35 if k == 0 else .15)) @ q_axis(Z, .04 * math.sin(W * t + key[1]))
        D = D @ q
        out.append(D @ c['r'][k])
    return out


def lash(key, h, r=None, z=.25):
    """Strand whips out over its own side and lays its tip at heading h (as far as its length allows)."""
    c = CH[key]
    J0, s = c['J0'], c['s']
    T = hd(h, min(r or c['L'], c['L'] * .95), z)
    return walk(bezier([J0, J0 + V((s * .9, .1, .7)), T.lerp(J0, .4) + V((0, 0, .9)), T]), c['seg'])


def wrapf(key, r=1.1, z=2.6):
    """Strand curls around its side of the body to the front."""
    c = CH[key]
    J0, s = c['J0'], c['s']
    return walk(bezier([J0, J0 + V((s * 1.2, .3, -.2)), V((s * 1.4, -.8, z)), V((s * .3, -r, z - .5))]), c['seg'])


# ---- moves: f(t, u) -> (strand targets {key: (w, dirs)}, body {channel: value}, arms {bone: (q, w)}) ----
def phase(u, a, b, c, d):
    return hold(u, a, b, c, d)


def m_swing(dirn=1, lash_side=True):
    """Sword slash across the front; dirn 1 = forehand (right to left), -1 = backhand. The right-side strands follow the blade."""
    def f(t, u):
        wind = phase(u, 0, .32, .36, .5)
        cut = env(u, .36, .5) * (1 - env(u, .72, 1))
        w = max(wind, cut, hold(u, 0, .1, .8, 1))
        zr = (-1.6 * cut + .5 * wind) if dirn > 0 else (1.3 * cut - 1.0 * wind)
        arms = {'upperarm.R': (q_axis(Z, zr) @ lift_fwd(.05 + 2.3 * wind + 1.4 * cut) @ lift_side(-1, .12 + .9 * wind), w),
                'forearm.R': (lift_fwd(.18 + .6 * wind + .1 * cut), w), 'hand.R': (lift_fwd(.4 * wind), w),
                'upperarm.L': (lift_side(1, .5 * wind + .3 * cut) @ lift_fwd(.2), w)}
        st = {}
        if lash_side:
            h0, h1 = (60, -40) if dirn > 0 else (-60, 40)
            hh = h0 + (h1 - h0) * env(u, .36, .55)
            for key in (FRONTL + MIDL):
                st[key] = (cut * .8, lash(key, hh + (key[2] % 3 - 1) * 15, 4.5, .8))
        return st, dict(twist=(.35 * wind - .45 * cut) * dirn, lean=.15 * cut, flare=.2 * cut), arms
    return f


def m_slam(lash_keys=None, heads=None, r=None):
    """Sword overhead in both hands, smashed into the floor; optional strand lashes at the moment of impact."""
    def f(t, u):
        up, down, rec = env(u, 0, .4), env(u, .45, .58), env(u, .78, 1)
        a = (2.8 * up - 2.2 * down) * (1 - rec)
        w = hold(u, 0, .1, .85, 1)
        arms = {}
        for s, S in ((1, 'L'), (-1, 'R')):
            arms[f'upperarm.{S}'] = (q_axis(Z, -.35 * s * up * (1 - rec)) @ lift_fwd(.05 + a) @ lift_side(s, .12), w)
            arms[f'forearm.{S}'] = (lift_fwd(.18 + .3 * up * (1 - down)), w)
        st = {}
        if lash_keys:
            for key in lash_keys:
                st[key] = (down * (1 - rec), lash(key, heads(key), r, .25))
        return st, dict(lean=(-.2 * up + .55 * down) * (1 - rec), hz=(.4 * up - .75 * down) * (1 - rec), flare=.35 * down * (1 - rec), up=.4 * up * (1 - down)), arms
    return f


def m_raise(k_up=2.5, rise=.35, strands_up=.6):
    def f(t, u):
        k = hold(u, 0, .25, .78, 1)
        arms = {}
        for s, S in ((1, 'L'), (-1, 'R')):
            arms[f'upperarm.{S}'] = (lift_side(s, .12 + k_up * k) @ lift_fwd(.05 + .25 * k), k)
            arms[f'forearm.{S}'] = (lift_fwd(.18 + .2 * k), k)
        return {}, dict(lean=-.18 * k, head=-.25 * k, hz=rise * k, flare=.25 * k, up=strands_up * k), arms
    return f


def m_channel(spread=1.2, rise=.4):
    """Hovering, arms spread low, mantle fanned wide — casting a field / waiting out a mechanic."""
    def f(t, u):
        k = hold(u, 0, .15, .88, 1)
        arms = {}
        for s, S in ((1, 'L'), (-1, 'R')):
            arms[f'upperarm.{S}'] = (lift_side(s, .12 + spread * k) @ lift_fwd(.25 * k), k)
            arms[f'forearm.{S}'] = (lift_fwd(.3 * k), k)
            arms[f'hand.{S}'] = (lift_fwd(-.4 * k), k)
        st = {key: (k * .8, lash(key, own(key), None, 2.2)) for key in STR}
        return st, dict(hz=rise * k, lean=-.1 * k, head=-.1 * k, flare=.3 * k), arms
    return f


def m_spin(turns=1., low=False):
    def f(t, u):
        k = hold(u, 0, .15, .85, 1)
        arms = {f'upperarm.{S}': (lift_side(s, .12 + 1.35 * k), k) for s, S in ((1, 'L'), (-1, 'R'))}
        arms.update({f'forearm.{S}': (lift_fwd(.1), k) for S in 'LR'})
        st = {key: (k, lash(key, own(key), None, 1.0 if low else 2.4)) for key in STR}
        return st, dict(yaw=-TAU * turns * ease(u), hz=.25 * k, flare=.7 * k), arms
    return f


def m_guard():
    def f(t, u):
        k = hold(u, 0, .18, .85, 1)
        arms = {'upperarm.R': (q_axis(Z, -.45) @ lift_fwd(1.0), k), 'forearm.R': (lift_fwd(1.83), k), 'hand.R': (lift_fwd(-.2), k),
                'upperarm.L': (q_axis(Z, .55) @ lift_fwd(.95), k), 'forearm.L': (lift_fwd(1.38), k)}
        st = {key: (k * .7, wrapf(key)) for key in FRONTL}
        return st, dict(lean=-.12 * k), arms
    return f


def m_coffin(scale=1.5, hold_out=True):
    """Summons the coffin and holds it up beside him in the left hand."""
    def f(t, u):
        k = hold(u, .05, .25, .85, 1)
        lift = .05 + 1.25 * k
        arms = {'upperarm.L': (q_axis(Z, .25 * k) @ lift_fwd(lift) @ lift_side(1, .12), 1.), 'forearm.L': (lift_fwd(.18 + .45 * k), 1.),
                'hand.L': (lift_fwd(-.3 * k), 1.)}
        return {}, dict(coffin=scale * k, coffin_up=lift + .18 + .45 * k - .3 * k), arms
    return f


def m_drag(h0=-60, h1=200, scale=1.6):
    """Swings the big coffin in a wide half circle at arm's length (aggro 5 opener)."""
    def f(t, u):
        k = hold(u, 0, .2, .85, 1)
        p = ease((u - .25) / .5)
        sw = math.radians(h0 + (h1 - h0) * p)
        arms = {'upperarm.L': (q_axis(Z, -.9 + 1.8 * p) @ lift_side(1, .9 * k) @ lift_fwd(.6 * k), k), 'forearm.L': (lift_fwd(.25), k)}
        return {}, dict(coffin=scale * k, coffin_up=.9 * k, twist=.6 - 1.2 * p, lean=.15 * k, flare=.3 * k), arms
    return f


def m_cast(hand='L'):
    def f(t, u):
        e = math.sin(math.pi * min(1, u))
        s = 1 if hand == 'L' else -1
        arms = {f'upperarm.{hand}': (q_axis(Z, -.25 * s * e) @ lift_fwd(.05 + 1.55 * e) @ lift_side(s, .12), e), f'forearm.{hand}': (lift_fwd(.18 - .1 * e), e),
                f'hand.{hand}': (lift_fwd(.9 * e), e)}
        st = {key: (e * .7, lash(key, (key[2] - 4) * 6, 4.5, 1.6)) for key in FRONTL}
        return st, dict(twist=-.2 * e * s, up=.2 * e), arms
    return f


def m_flap(lashes=None):
    """Wing beat: the mantle rises and beats; optional lashes at the bottom of the beat (butterfly)."""
    def f(t, u):
        k = hold(u, 0, .2, .8, 1)
        hit = hold(u, .35, .5, .7, .9)
        arms = {f'upperarm.{S}': (lift_side(s, .12 + .7 * k) @ lift_fwd(-.25 * k), k) for s, S in ((1, 'L'), (-1, 'R'))}
        st = {}
        if lashes:
            for key in STR:
                st[key] = (hit, lash(key, lashes(key), None, .5))
        return st, dict(hz=.5 * k, lean=.15 * k, flare=.4 * k, up=.9 * k * (1 - hit), flap=.9 * k * (1 - hit)), arms
    return f


def m_lash(keys, heads, r=None, z=.3, a=.2, b=.4, c=.75, d=1.):
    """Strands whip out to headings and lie there for a moment (cones/rays on the floor)."""
    def f(t, u):
        w = hold(u, a, b, c, d)
        return {key: (w, lash(key, heads(key), r, z)) for key in keys}, dict(flare=.25 * w, lean=.1 * w), {}
    return f


def m_fan(side, h0, h1, r=None, z=.3, sweep=False):
    """One side's strands fanned across headings h0..h1 (half-moon, butterfly cones); sweep: the fan opens over time."""
    keys = sorted(SIDE[side], key=lambda k: (k[2] % 3, k[2] // 3))

    def f(t, u):
        w = hold(u, 0, .25, .8, 1)
        p = ease((u - .2) / .4) if sweep else 1.
        out = {}
        for n, key in enumerate(keys):
            h = h0 + (h1 - h0) * (n / (len(keys) - 1)) * p
            out[key] = (w, lash(key, h, r, z))
        s = 1 if side == 'L' else -1
        return out, dict(twist=-.3 * s * w, flare=.3 * w), {f'upperarm.{side}': (lift_side(s, 1.2 * w), w)}
    return f


def m_vanish():
    def f(t, u):
        k = hold(u, 0, .5, .7, 1)
        return {key: (k, wrapf(key, .6, 2.2)) for key in STR}, dict(hz=-1.2 * k, lean=.3 * k, flare=-.2 * k), {}
    return f


def m_dash(sword=True):
    """Lunge (the arena moves him): leaning in, mantle streaming back, sword trailing low."""
    def f(t, u):
        k = hold(u, 0, .15, .75, 1)
        arms = {'upperarm.R': (lift_side(-1, .5) @ lift_fwd(-.4), k)} if sword else {}
        st = {key: (k * .8, lash(key, 180 + (key[2] % 3 - 1) * 20 * (1 if key[1] == 'L' else -1), None, 2.6)) for key in STR}
        return st, dict(lean=.45 * k, hz=-.2 * k), arms
    return f


def m_backstep():
    def f(t, u):
        k = hold(u, 0, .2, .7, 1)
        st = {key: (k * .7, lash(key, (key[2] % 3 - 1) * 20 + (330 if key[1] == 'L' else 30), None, 2.4)) for key in STR}
        return st, dict(lean=-.35 * k, hz=.3 * k), {}
    return f


def m_counter():
    """Co-op counter window: reared back, arms wide, chest (core) exposed."""
    def f(t, u):
        k = hold(u, 0, .15, .85, 1)
        arms = {f'upperarm.{S}': (lift_side(s, 1.5 * k) @ lift_fwd(-.3 * k), k) for s, S in ((1, 'L'), (-1, 'R'))}
        return {}, dict(lean=-.3 * k, head=-.3 * k, hz=.2 * k, up=.7 * k), arms
    return f


def m_roots():
    """Imprison: hands thrust down, strands driven into the floor all around."""
    def f(t, u):
        k = hold(u, 0, .25, .8, 1)
        arms = {f'upperarm.{S}': (lift_side(s, .5 * k) @ lift_fwd(.3 * k), k) for s, S in ((1, 'L'), (-1, 'R'))}
        arms.update({f'hand.{S}': (lift_fwd(-.8 * k), k) for S in 'LR'})
        st = {key: (k, lash(key, own(key) + (key[2] // 3 - 1) * 40 * (1 if key[1] == 'L' else -1), 3.2, .05)) for key in STR}
        return st, dict(lean=.25 * k, hz=-.3 * k), arms
    return f


def m_ring(z=.3):
    """Strands lashed out radially all around (rings / donuts on the floor)."""
    def f(t, u):
        w = hold(u, .1, .3, .75, 1)
        st = {key: (w, lash(key, own(key) + (key[2] // 3 - 1) * 55 * (1 if key[1] == 'L' else -1), None, z)) for key in STR}
        return st, dict(flare=.5 * w, hz=-.2 * w), {}
    return f


def pick(*hs):
    """Distribute headings over a side's strands (round robin by index)."""
    return lambda key: hs[key[2] % len(hs)]


def windmill(a):
    """Two crossing lines through the boss at headings a and a+90: each side takes the two directions on its side."""
    dirs = [(a + k * 90) % 360 for k in range(4)]
    R_ = [h for h in dirs if 0 < h <= 180] or dirs[:2]
    L_ = [h for h in dirs if not (0 < h <= 180)] or dirs[2:]
    return lambda key: (R_ if key[1] == 'R' else L_)[key[2] % 2]


BOTH = lambda hl, hr: (lambda key: hl if key[1] == 'L' else hr)
ATTACKS = {
    'flurry': (4.6, [(.2, 1.3, m_raise(2.0, .3, .3)), (.35, 1.4, m_lash(STR, lambda k: (k[2] % 3 - 1) * 25 + (345 if k[1] == 'L' else 15), 6, .4)),
                     (1.5, .8, m_swing(1))]),
    'aggro5': (6.4, [(.35, 1.3, m_drag()), (1.85, .7, m_swing(1)), (2.65, .7, m_swing(-1)),
                     (3.4, 1.4, m_slam(STR, lambda k: {'L': 280}.get(k[1], 40 if k[2] % 2 else 160), None))]),
    'chakram': (7.2, [(.2, .8, m_raise(1.6, .2)), (.95, .7, m_dash()), (1.55, .7, m_dash()), (2.25, .7, m_dash()), (2.95, .7, m_dash()),
                      (4.2, 2.6, m_channel(1.0, .5))]),
    'triangle': (5.4, [(.2, 1.4, m_raise(2.2, .4)), (2.2, 1.9, m_slam(STR, lambda k: 180 if k[2] < 3 else (300 if k[1] == 'L' else 60), None))]),
    'onetwox': (5.0, [(.25, .7, m_swing(1)), (1.05, .7, m_swing(-1)), (2.0, 1.4, m_slam(MIDL + FRONTL, BOTH(325, 35), None))]),
    'blades': (6.8, [(.2, 1.1, m_spin(1)), (1.2, .5, m_vanish()), (2.6, .7, m_raise(2.2, .3)),
                     (3.35, 1.0, m_lash(STR, lambda k: 0 if k[2] >= 6 else (210 if k[1] == 'L' else 150))), (4.25, 1.0, m_lash(STR, BOTH(285, 75)))]),
    'windmill': (4.6, [(.3, 1.2, m_spin(.5)), (.3, 1.3, m_lash(STR, windmill(0), None, .4)), (1.7, 1.2, m_spin(.5)), (1.7, 1.3, m_lash(STR, windmill(45), None, .4))]),
    'holdjg': (5.6, [(.2, 1.2, m_raise(1.4, .2, .2)), (1.4, 2.3, m_guard()), (3.8, 1.2, m_swing(1))]),
    'burst3': (7.2, [(.1, 5.0, m_channel(.9, .5)), (.3, 1.2, m_ring()), (1.9, 1.2, m_ring()), (3.5, 1.2, m_ring()), (5.15, 1.2, m_spin(1, low=True))]),
    'rise': (6.6, [(.15, 1.0, m_raise(2.4, .6, .8)), (4.5, 1.3, m_slam(SIDE['R'] + MIDL, lambda k: 90 + (k[2] % 3 - 1) * 30, None))]),
    'halfmoon': (4.4, [(.15, 1.2, m_fan('L', 360, 180, None, .3, sweep=True)), (.15, 1.2, m_swing(-1, False)), (1.55, 1.0, m_spin(.6, low=True)),
                       (1.55, 1.0, m_fan('L', 350, 160))]),
    'backstep': (5.6, [(.1, .6, m_backstep()), (.4, 1.3, m_counter()), (2.0, 1.4, m_dash()), (2.1, 1.1, m_lash(STR, BOTH(270, 90), 2.2, .4))]),
    'openingjg': (5.2, [(.05, .9, m_flap()), (1.1, 3.6, m_channel(1.4, .3))]),
    'butterfly': (4.8, [(.15, 1.2, m_flap(lambda k: own(k) + (k[2] % 3 - 1) * 40 * (1 if k[1] == 'L' else -1))),
                        (1.65, 1.2, m_flap(lambda k: own(k) + (k[2] % 3 - 1) * 40 * (1 if k[1] == 'L' else -1)))]),
    'jumprope': (6.0, [(.1, 2.3, m_raise(2.4, .5, .6)), (2.4, .4, m_vanish()), (2.75, 1.0, m_slam(STR, lambda k: own(k), 2.5))]),
    'kaisa': (4.0, [(.2, 1.4, m_cast('L')), (.9, 1.2, m_cast('R'))]),
    'inhale': (6.4, [(.15, 2.2, m_coffin(1.6)), (.3, 1.9, m_lash(STR, lambda k: 180 + (k[2] % 3 - 1) * 25 * (1 if k[1] == 'L' else -1), 5, 1.0)),
                     (2.3, .8, m_swing(1)), (3.1, 1.1, m_drag(60, 200, 1.6)), (4.25, 1.2, m_ring(.2))]),
    'medusa': (5.4, [(.1, 1.9, m_raise(2.0, .5, .5)), (1.9, .6, m_vanish()), (2.6, 2.0, m_channel(1.2, .3))]),
    'nightrea': (6.6, [(.05, 1.3, m_dash()), (1.35, .55, m_vanish()), (2.15, 1.2, m_channel(1.0, .2)), (3.35, 1.8, m_counter())]),
    'imprison': (5.8, [(.2, .7, m_dash(False)), (.85, 1.8, m_roots()), (2.85, 1.4, m_fan('L', 360, 180, 5)), (2.85, 1.4, m_fan('R', 0, 180, 5)),
                       (4.7, .9, m_swing(1, False))]),
    'five': (7.6, [(.1, 7.4, m_channel(.9, .4)), (.2, 1.3, m_ring()), (1.5, 1.4, m_lash(STR, BOTH(270, 90))),
                   (2.9, 1.4, m_lash(STR, lambda k: 0 if k[2] >= 4 else 180)), (4.3, 1.4, m_ring()), (5.7, 1.4, m_lash(STR, BOTH(225, 45)))]),
    'coffinstag': (7.4, [(.1, 1.6, m_raise(2.2, .4)), (1.7, 3.8, m_channel(1.1, .5)), (5.5, 1.2, m_lash(STR, lambda k: (200 if k[2] % 2 else 290) if k[1] == 'L' else (20 if k[2] % 2 else 110)))]),
    'insightbare': (5.4, [(.35, 1.4, m_raise(2.6, .3, .3)), (1.85, 1.7, m_counter())]),
    'insightblade': (5.6, [(.3, 3.3, m_guard()), (3.4, 1.0, m_slam())]),
    'pizza': (5.6, [(.2, .8, m_swing(1)), (1.0, .8, m_swing(-1)), (1.95, .6, m_backstep()),
                    (2.45, 2.2, m_channel(1.3, .3)), (2.45, 2.2, m_lash(STR, lambda k: (225, 270, 315, 360)[k[2] % 4] if k[1] == 'L' else (0, 45, 90, 180)[k[2] % 4], None, .5))]),
    'coffinA': (5.2, [(.1, 1.0, m_raise(2.0, .3, .4)), (1.0, 2.6, m_channel(1.0, .4))]),
    'coffinB': (5.6, [(.1, 1.0, m_raise(2.0, .3, .4)), (1.0, 3.5, m_channel(1.0, .4))]),
    'vanish': (7.2, [(.05, .5, m_coffin(1.4)), (.3, .5, m_vanish()), (1.6, 1.0, m_swing(1)), (1.65, .9, m_lash(STR, lambda k: (k[2] % 3 - 1) * 30, 5, .3)),
                     (2.9, .5, m_vanish()), (3.6, 1.2, m_guard()), (4.85, 1.4, m_ring(.6))]),
}
# generic clips for the action names used by arena.js poseA()
GENERIC = {'Raise': (2.0, [(0, 2.0, m_raise())]), 'Swing': (1.6, [(0, 1.6, m_swing(1))]), 'Slam': (2.0, [(0, 2.0, m_slam())]),
           'Spin': (1.8, [(0, 1.8, m_spin(1))]), 'Guard': (2.0, [(0, 2.0, m_guard())]), 'Coffin': (2.4, [(0, 2.4, m_coffin(1.))]),
           'Cast': (1.4, [(0, 1.4, m_cast('L'))]), 'Flap': (2.4, [(0, 2.4, m_flap())])}

# ---- physics ----
SUB = 1 / 60
BODYR = lambda z: .6 if z > 2.4 else .6 + (2.4 - z) * .3  # torso, widening down the robe


def clip(dur, moves, loop=False):
    def evaluate(t):
        body = dict(lean=0., twist=0., hz=0., yaw=0., head=0., flare=0., up=0., flap=0., coffin=0., coffin_up=0.)
        acts = []
        for t0, d, mv in moves:
            if t0 <= t <= t0 + d:
                st, bd, arms = mv(t, (t - t0) / d)
                acts.append((st, arms))
                for k, v in bd.items():
                    body[k] += v
        tg = {}
        for key in CH:
            tg[key] = sfk(key, t, up=body['up'], flap=body['flap'], flare=body['flare']) if key[0] == 'rib' else sfk(key, t, flare=body['flare'])
        arms_all = {}
        for st, arms in acts:
            for key, (w, dirs) in st.items():
                if w > 1e-3:
                    tg[key] = [blend(a, b, w) for a, b in zip(tg[key], dirs)]
            for b, (q, w) in arms.items():
                arms_all.setdefault(b, []).append((q, w))
        return tg, body, arms_all

    st = {}

    def integrate(t_to):
        while st['t'] < t_to - 1e-9:
            dt = min(SUB, t_to - st['t'])
            st['t'] += dt
            tg, body, arms = evaluate(st['t'] % dur if loop else st['t'])
            dyaw, dz = body['yaw'] - st['yaw'], body['hz'] - st['hz']
            st.update(yaw=body['yaw'], hz=body['hz'], body=body, arms=arms)
            for key, c in CH.items():
                A, Vv, n = st['a'][key], st['v'][key], len(c['r'])
                p = c['J0'] + V((0, 0, body['hz']))
                for k in range(n):
                    a, v = A[k], Vv[k]
                    f = k / max(1, n - 1)
                    if dyaw:
                        q = q_axis(Z, -dyaw * (.2 + .7 * f))
                        a, v = q @ a, q @ v
                    if dz:
                        a = (a - V((0, 0, dz * (.2 + .6 * f) * .5 / c['seg'][k]))).normalized()
                    K = c['k0'] + (c['k1'] - c['k0']) * f
                    v = v + ((tg[key][k] - a) * K - v * (2 * math.sqrt(K) * .55)) * dt
                    a = (a + v * dt).normalized()
                    v = v - a * v.dot(a)
                    e = p + a * c['seg'][k]
                    fixed = False
                    if e.z < .04:
                        e.z, fixed = .04, True
                    if c['col'] and k >= 1:
                        rr, R_ = math.hypot(e.x, e.y), BODYR(e.z - body['hz'])
                        if .5 < e.z - body['hz'] < 4.3 and rr < R_:
                            nn = V((e.x, e.y, 0)).normalized() if rr > 1e-3 else V((c['s'], 0, 0))
                            e = V((nn.x * R_, nn.y * R_, e.z))
                            fixed = True
                    if fixed:
                        a = (e - p).normalized()
                        v = v * .3
                    A[k], Vv[k] = a, v
                    p = p + a * c['seg'][k]

    def fn(t, u):
        if not st:
            tg, body, arms = evaluate(0)
            st.update(t=0., yaw=body['yaw'], hz=body['hz'], body=body, arms=arms, a={k: list(v) for k, v in tg.items()},
                      v={k: [V((0, 0, 0))] * len(CH[k]['r']) for k in CH})
            if loop:
                integrate(dur)
                st['t0'] = dur
            else:
                for _ in range(30):
                    integrate(st['t'] + SUB)
                    st['t'] = 0.
                st['t0'] = 0.
        integrate(st['t0'] + t)
        body, arms = st['body'], st['arms']
        P = {'hips': {'loc': (0, 0, .09 * math.sin(W * t) + body['hz'])},
             'spine': {'q': q_axis(Z, body['twist'])},
             'head': {'q': q_axis(Z, .08 * math.sin(W * t * .5)) @ q_axis(X, .04 * math.sin(W * t) + body['head'])},
             'chest': {'q': q_axis(X, .03 * math.sin(W * t + 1) + body['lean'])}}
        if body['yaw']:
            P['root'] = {'q': q_axis(Z, body['yaw'])}
        base_arm = {}
        for s, S in ((1, 'L'), (-1, 'R')):
            base_arm[f'upperarm.{S}'] = lift_side(s, .12 + .04 * math.sin(W * t)) @ lift_fwd(.05)
            base_arm[f'forearm.{S}'] = lift_fwd(.18)
            base_arm[f'hand.{S}'] = Quaternion()
        for b in base_arm:
            q = base_arm[b]
            for qq, w in arms.get(b, []):
                q = q.slerp(qq, min(1., w))
            P[b] = {'q': q}
        for b in arms:
            if b not in P:
                q = Quaternion()
                for qq, w in arms[b]:
                    q = q.slerp(qq, min(1., w))
                P[b] = {'q': q}
        cf = body['coffin']
        P['coffin'] = {'s': max(.001, cf), 'q': lift_fwd(-body['coffin_up']), 'loc': (0, 0, .9 * min(1, cf))}
        for i in range(3):
            P[f'blade{i}'] = {'loc': (0, 0, .06 * math.sin(W * t + i * 2)), 'q': q_axis(Y, .03 * math.sin(W * t + i))}
        for k in range(2):
            P[f'hair{k}'] = {'q': q_axis(X, -.08 * math.sin(W * t * 2 - k) - .25 * body['lean'] * (k + 1))}
        for S, s, J in CAPE:
            for k in range(3):
                P[f'cape.{S}{k}'] = {'q': q_axis(X, -.06 * math.sin(W * t * 2 - k * .8) - body['flare'] * .25 - body['lean'] * .3)}
        for key, c in CH.items():
            D = Quaternion()
            for k, bname in enumerate(c['bones']):
                Dn = (D @ c['r'][k]).rotation_difference(st['a'][key][k]) @ D
                P[bname] = {'q': D.inverted() @ Dn}
                D = Dn
        return P
    return fn


CLIPS = [('Idle', 2.4, clip(2.4, [], loop=True))]
CLIPS += [(n, d, clip(d, mv)) for n, (d, mv) in GENERIC.items()]
CLIPS += [(n, d, clip(d, mv)) for n, (d, mv) in ATTACKS.items()]
bake(arm, CLIPS)

blend = os.path.join(OUT, 'belgardin.blend')
glb = os.path.join(OUT, 'belgardin.glb')
export(glb, arm, body, frame_step=3)  # 10 fps keys: 37 physics-driven clips stay a reasonable size
bpy.ops.wm.save_as_mainfile(filepath=blend)
prev = os.path.join(OUT, 'preview', 'belgardin')
os.makedirs(os.path.dirname(prev), exist_ok=True)
if '--no-preview' not in sys.argv:
    preview(prev, arm, [('Idle', 0), ('aggro5', 22), ('aggro5', 117), ('butterfly', 13), ('halfmoon', 25), ('windmill', 22),
                        ('onetwox', 67), ('inhale', 40), ('five', 54), ('kaisa', 30)], (5.2, -9.5, 3.4), (0, 0, 2.4), lens=36)
    preview(prev + '_front', arm, [('Idle', 0), ('Flap', 36)], (0, -12, 3.6), (0, 0, 3.2), res=(900, 520), lens=36)
print('TRIS', sum(len(p.vertices) - 2 for p in body.data.polygons), 'BONES', len(arm.data.bones), 'GLB', os.path.getsize(glb))
