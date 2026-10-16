# Low-poly bosses for the 3D arena

| File | Boss | Tris | Bones | Clips |
|---|---|---|---|---|
| `belgardin.glb` | Belgardin, Hand of Death (gate I) | ~3.6k | 126 | Idle, Raise, Swing, Slam, Spin, Guard, Coffin, Cast, Flap + 28 attack clips (below) |
| `kragma.glb` | Phetus an Kragma / Belgardin Nightmare (gate II) | ~10k | 75 | Idle, Grab, Slam, Raise, Spin, Sling, Sweep, Guard + 24 attack clips (below) |

The capitalised clip names match the actions in `js/arena.js` (`poseA` / `poseB`), so `sim.act` entries `[start, action, duration]`
map straight onto `mixer.clipAction(clip)` with `timeScale = clip.duration / duration`.
Idle loops seamlessly; the other clips start and end close to the Idle pose, so a 0.2 s crossfade is enough.

### Belgardin attack clips

The lowercase clips are named after the gate I sims in `js/data.js`: flurry, aggro5, chakram, triangle, onetwox, blades, windmill, holdjg, burst3, rise, halfmoon, backstep, openingjg, butterfly, jumprope, kaisa, inhale, medusa, nightrea, imprison, five, coffinstag, insightbare, insightblade, pizza, coffinA, coffinB and vanish. Each one lasts exactly the sim's `dur` and plays from t = 0 with the sim.

- **Weapons.** The 18 mantle strands are his whips. They lash out at the telegraphed headings: both flanks in Butterfly, a half-circle in Half-Moon, a cross in Windmill and the five steps of Five-Step. The sword handles the swings, the X strike and the slams. The coffin grows to 1.6× and is swung in a wide arc (Aggro 5, Inhale).
- **What the arena still does.** The chakram, the flying blades, the standing coffins and the beams are arena items in `data.js`. Dashes, teleports and turns come from `b.b(...)`. The clips only animate the body in place.
- **Physics.** Strands and skirt are spring-simulated like Kragma's tentacles, with the same floor and body-column collisions. The robe and the root-like tendrils are skinned to 9 sector chains.
- **Frame rate.** Animation is exported at 10 fps to keep 37 clips at ~6.7 MB.

### Kragma attack clips

The lowercase clips are named after the gate II sims in `js/data.js`: agg4, orbslam, frontback, frontjg, suddenjg, rearrapid, leap, pacing, barrage, bomb4, cones2, swirl, sling, mirror, dslam, donutlaser, lattice2, wall, grind, orbjg, closegrab, launch, range and rotate.

- **Timing and aim.** Each clip lasts exactly the sim's `dur`. Play it from t = 0 together with the sim and every hit lands on its telegraph. The tentacles are aimed at the telegraph points in arena units, using the `dir()` heading convention (0 = front, 90 = boss right).
- **What the arena still does.** The sim's `b.b(...)` keys move and turn the boss and hide it (leap, mirror, lattice2). The clips only animate the body in place.
- **Limbs.** There are two long white tentacles (`tent.L0` / `tent.R0`, ~10.5) and two short purple "small arms" (`tent.L1` / `tent.R1`, ~4.6), as in the guide notes. All four grow from the hump on the back.
- **Physics.** Tentacle motion is baked from a spring simulation: stiff roots and loose tips give whip and follow-through, and the tentacles lag when the body spins or jumps. They're kept above the floor and outside the body column, so a strike never passes through the boss.

- One skinned mesh per boss, flat-shaded, no textures (colors and emissive glow live in the materials), so it works from `file://` once embedded as base64 the same way as `js/soldier-glb.js`.
- Units are metres, origin on the floor under the boss. Belgardin's robe tips reach the floor, and his body floats with a ±0.09 m bob.
- glTF front is **+Z**. The procedural bosses in `arena.js` face −Z, so add `rotation.y = Math.PI`.
- Belgardin's coffin is part of the mesh and is scaled to 0 outside the `Coffin` clip.
- Emissive strength above 1 (`KHR_materials_emissive_strength`) is ignored by three.js r128. The glowing parts still use their emissive color; bloom in the arena brightens them.

## Arenas

| File | Arena | Tris | Objects |
|---|---|---|---|
| `arena1.glb` | 거룩한 안식의 묘원 (Holy Rest Cemetery), gate I | ~45k | platform, inlays, graveyard, crypts, flames, far, sky |
| `arena2.glb` | 크라그마의 사멸지 (Kragma's Annihilation Ground), gate II | ~26k | core, mid_00–07, outer_00–09, cultists, void, sky |

- **Scale.** The units match `arena.js`: the fight circle has radius 10.5 with its top at y = 0, and north (the crypt in arena 1) is −Z. The arenas are static, with flat-shaded materials and no textures. Glowing parts (rings, runes, flames, embers, the vortex) use emissive colours.
- **Arena 2 floor.** It follows the Terrain Destruction gimmick (`terrain` in `data.js`), which collapses the floor to r 8 and later to about r 6. Hide or drop `outer_*` (ring 8–10.5) first, then `mid_*` (ring 6–8). The `core` (r < 6) never falls.
- **Sky.** The `sky` objects are big emissive domes. Turn fog off on them (`material.fog = false`) or swap in the arena's shader sky.
- **References.** See `nnew/references/arena1`, `nnew/references/arena2` and `nnew/references/ARENAS.md`.
- **Rebuild.** Run this, then the same for arena2:

```bash
/c/Users/fixadmin/Documents/blender/blender.exe -b --factory-startup --python nnew/models/src/arena1.py -- nnew/models
```

The previews are `preview/arena*_*.png`. The viewer takes an arena under the boss: `viewer.html?m=kragma&a=arena2`.

## Rebuild

The sources are in `src/`. `bossgen.py` holds the shared mesh, rig, animation-baking and export helpers, and `belgardin.py` / `kragma.py` hold the bosses.

```bash
bash nnew/models/src/build.sh belgardin
```

Each build writes the `.glb` and `.blend` files and fills `preview/` with Workbench renders plus a `*_sheet.jpg` contact sheet. Edit the pose functions to tweak an animation and the mesh section to tweak the shape, then rerun the build. The attack timelines are in `ATTACKS` in `belgardin.py` / `kragma.py` as (start, duration, move) entries, and the moves (`m_swing`, `m_lash`, `m_fan` … / `strike`, `sweep`, `grab` …) are defined just above.

Viewer: `viewer.html?m=belgardin|kragma`. It needs an http server (the `grimoire` launch config), not `file://`.

References: `nnew/references/1` (Belgardin) and `nnew/references/2` (Kragma).
