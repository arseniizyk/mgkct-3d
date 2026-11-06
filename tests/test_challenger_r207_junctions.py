import re

with open('js/buildings/building1.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern for addWallLine
wall_pattern = re.compile(r'addWallLine\(\s*targetGroup\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*(\[[^\]]*\])\s*,\s*([A-Za-z0-9_]+)\s*\)')

print("Walls touching X=-5.8 or Z=-4.0:")
for m in wall_pattern.finditer(text):
    x1, z1, x2, z2, openings, thick = m.groups()
    x1, z1, x2, z2 = float(x1), float(z1), float(x2), float(z2)
    # Check if wall touches or comes close to (-5.8, -4.0) or (-10.0, -4.0)
    d1 = math_dist = ((x1 - (-5.8))**2 + (z1 - (-4.0))**2)**0.5
    d2 = ((x2 - (-5.8))**2 + (z2 - (-4.0))**2)**0.5
    d3 = ((x1 - (-10.0))**2 + (z1 - (-4.0))**2)**0.5
    d4 = ((x2 - (-10.0))**2 + (z2 - (-4.0))**2)**0.5
    if min(d1, d2, d3, d4) < 0.1:
        print(f"Wall: ({x1:5.1f}, {z1:5.1f}) -> ({x2:5.1f}, {z2:5.1f}), thickness={thick:10s}, openings={openings}")
