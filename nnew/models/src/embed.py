"""Embed the boss/arena GLBs as base64 scripts for the page (it runs from file://, so no fetch).
Run from anywhere: python nnew/models/src/embed.py
Writes js/glb/<name>.js -> (window.GLB_DATA ||= {})[name] = "<base64>"; js/arena.js injects them on demand."""
import base64, os

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.normpath(os.path.join(HERE, '..'))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'js', 'glb'))
os.makedirs(OUT, exist_ok=True)
for name in ('belgardin', 'kragma', 'arena1', 'arena2'):
    with open(os.path.join(MODELS, name + '.glb'), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    path = os.path.join(OUT, name + '.js')
    with open(path, 'w', encoding='ascii', newline='\n') as f:
        f.write('(window.GLB_DATA=window.GLB_DATA||{})["%s"]="%s";\n' % (name, b64))
    print(name, os.path.getsize(path))
