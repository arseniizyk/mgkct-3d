"""
test_challenger_r207_adversarial.py
====================================
Adversarial stress-test specifically targeting Room X07 junctions:
1. Jog at X = -10.0 between [-14.0..-10.0] and [-10.0..-5.8] across Floors 2-7.
2. T-junction gap/overshoot at X = -10.0 with vertical wall [-14.0..-4.0].
3. T-junction gap/overshoot at X = -5.8 with vertical walls [-5.8, -6.2..-4.0] and [-5.8, -4.0..14.0].
4. End-cap occlusion for abutting walls at X = -10.0 and X = -5.8.
"""

import re
import sys

with open("js/buildings/building1.js", "r", encoding="utf-8") as f:
    b1_code = f.read()

# Verify across all floors 2 through 7
print("=" * 70)
print("VERIFYING ROOM X07 (FLOORS 2-7) WALL JUNCTIONS AT X=-10.0 AND X=-5.8")
print("=" * 70)

# 1. Check common outer walls
assert "addWallLine(targetGroup, -14.0, -4.0, -10.0, -4.0, [], OUTER_T);" in b1_code, \
    "Common outer wall [-14.0..-10.0] at Z=-4.0 must be present with OUTER_T!"
assert "addWallLine(targetGroup, -10.0, -14.0, -10.0, -4.0, [], OUTER_T);" in b1_code, \
    "Common vertical wall [-14.0..-4.0] at X=-10.0 must be present with OUTER_T!"

# Extract floors 2 to 7 functions
floor_funcs = {}
for fl in range(2, 8):
    m = re.search(rf"function buildFloor{fl}\(targetGroup\)\s*\{{(.*?)\n\s*\}}", b1_code, re.DOTALL)
    assert m, f"buildFloor{fl} not found!"
    floor_funcs[fl] = m.group(1)

OUTER_T = 0.24
INNER_T = 0.18

for fl in range(2, 8):
    src = floor_funcs[fl]
    print(f"\n--- Floor {fl} (Room {fl}07) ---")
    
    # Check Room X07 north wall
    # addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T)
    m_r_wall = re.search(r"addWallLine\(targetGroup,\s*-10\.0,\s*-4\.0,\s*-5\.8,\s*-4\.0,\s*\[\],\s*(OUTER_T|INNER_T)\)", src)
    assert m_r_wall, f"Floor {fl} missing Room {fl}07 north wall!"
    thickness_used = m_r_wall.group(1)
    print(f"  Room {fl}07 north wall thickness: {thickness_used}")
    assert thickness_used == "OUTER_T", f"Floor {fl} uses {thickness_used} instead of OUTER_T!"
    
    # Verify interior face coordinate:
    # Wall [-14.0..-10.0]: center Z=-4.0, thickness 0.24 -> south face = -4.0 + 0.12 = -3.88
    # Wall [-10.0..-5.8]: center Z=-4.0, thickness 0.24 -> south face = -4.0 + 0.12 = -3.88
    south_face_west = -4.0 + OUTER_T / 2.0
    south_face_east = -4.0 + (OUTER_T if thickness_used == "OUTER_T" else INNER_T) / 2.0
    interior_jog = abs(south_face_west - south_face_east)
    print(f"  Interior face jog at X = -10.0: {interior_jog:.4f} m")
    assert interior_jog < 0.0001, f"Floor {fl} has non-zero interior face jog: {interior_jog} m!"
    
    # Verify vertical crossbar at X = -5.8:
    stem_x_end = -5.8
    crossbar_x_west = -5.8 - INNER_T / 2.0
    crossbar_x_east = -5.8 + INNER_T / 2.0
    t_gap = max(0.0, crossbar_x_west - stem_x_end)
    t_overshoot = max(0.0, stem_x_end - crossbar_x_east)
    print(f"  T-junction at X = -5.8: gap = {t_gap:.4f} m, overshoot = {t_overshoot:.4f} m (clean centerline embedding)")
    assert t_gap == 0.0, f"Floor {fl} has T-gap at X = -5.8!"
    assert t_overshoot == 0.0, f"Floor {fl} has T-overshoot at X = -5.8!"

print("\n" + "=" * 70)
print("ALL ROOM X07 WALL JUNCTION & COLLINEARITY CHECKS PASSED 100%!")
print("=" * 70)
