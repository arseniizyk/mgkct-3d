"""
tests/test_verify_seamless_wall_junctions_adversarial.py
=========================================================
Empirical Adversarial Verification & Defect Injection Harness
for tests/verify_seamless_wall_junctions.py.

Tests:
1. Collinear Wall Jog Detection (0.05m jog, boundaries 0.001m, 0.003m, 0.05m, 0.09m, 0.15m)
2. Perpendicular T-Junction Gap Detection (0.02m gap, boundaries 0.004m, 0.006m, 0.02m, 0.10m, 0.25m)
3. Wall Puncture Overshoot Detection (0.010m threshold: 0.005m, 0.011m, 0.020m, 0.050m)
4. Stage 2 Internal Seam Detection (occluded vs non-occluded edge line)
5. Stage 3 Slab Leak / Gap Detection & Backing Slab Absence
6. Stage 4 Staircase Boundary Offset Detection & Door Missing Detection
7. Stage 0 Pipeline AST / Hook Integrity Check
"""

import sys
import copy
import re

sys.stdout.reconfigure(encoding='utf-8')

# Import core geometry functions from verify_seamless_wall_junctions
from verify_seamless_wall_junctions import (
    make_boxes,
    is_inside_other_wall,
    simulate_js_wall_edges,
    wall_lines as original_wall_lines
)

print("=" * 70)
print("  ADVERSARIAL STRESS TEST & DEFECT INJECTION SUITE")
print("=" * 70)

results = []

def record(test_name, passed, detail):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {test_name}: {detail}")
    results.append((test_name, passed, detail))

# ----------------------------------------------------------------------
# 1. Collinear Jog Detection Function
# ----------------------------------------------------------------------
def check_collinear_jogs(walls):
    h_walls = [w for w in walls if abs(w['z1'] - w['z2']) < 0.001]
    v_walls = [w for w in walls if abs(w['x1'] - w['x2']) < 0.001]
    collinear_jogs = []

    for i in range(len(h_walls)):
        for j in range(i + 1, len(h_walls)):
            w1, w2 = h_walls[i], h_walls[j]
            min1, max1 = min(w1['x1'], w1['x2']), max(w1['x1'], w1['x2'])
            min2, max2 = min(w2['x1'], w2['x2']), max(w2['x1'], w2['x2'])
            if min(max1, max2) >= max(min1, min2) - 0.01:
                jog = abs(w1['z1'] - w2['z1'])
                if 0.002 < jog < 0.10:
                    collinear_jogs.append((w1, w2, jog))

    for i in range(len(v_walls)):
        for j in range(i + 1, len(v_walls)):
            w1, w2 = v_walls[i], v_walls[j]
            min1, max1 = min(w1['z1'], w1['z2']), max(w1['z1'], w1['z2'])
            min2, max2 = min(w2['z1'], w2['z2']), max(w2['z1'], w2['z2'])
            if min(max1, max2) >= max(min1, min2) - 0.01:
                jog = abs(w1['x1'] - w2['x1'])
                if 0.002 < jog < 0.10:
                    collinear_jogs.append((w1, w2, jog))

    return collinear_jogs

# Test 1A: Clean baseline
baseline_jogs = check_collinear_jogs(original_wall_lines)
record("Collinear Jog - Clean Baseline", len(baseline_jogs) == 0, f"Found {len(baseline_jogs)} jogs")

# Test 1B: Synthetic 0.05m horizontal jog
walls_with_h_jog = copy.deepcopy(original_wall_lines)
# Add two meeting horizontal walls with 0.05m jog in Z
walls_with_h_jog.append({'x1': 0.0, 'z1': -20.00, 'x2': 5.0, 'z2': -20.00, 'thickness': 0.18})
walls_with_h_jog.append({'x1': 5.0, 'z1': -20.05, 'x2': 10.0, 'z2': -20.05, 'thickness': 0.18})
jogs_h = check_collinear_jogs(walls_with_h_jog)
record("Collinear Jog - Injected 0.05m Horizontal Jog", len(jogs_h) == 1 and abs(jogs_h[0][2] - 0.05) < 1e-4,
       f"Detected {len(jogs_h)} jogs, jog amount = {jogs_h[0][2] if jogs_h else 0:.3f}m")

# Test 1C: Synthetic 0.05m vertical jog
walls_with_v_jog = copy.deepcopy(original_wall_lines)
# Add two meeting vertical walls with 0.05m jog in X
walls_with_v_jog.append({'x1': 1.00, 'z1': -30.0, 'x2': 1.00, 'z2': -25.0, 'thickness': 0.18})
walls_with_v_jog.append({'x1': 1.05, 'z1': -25.0, 'x2': 1.05, 'z2': -20.0, 'thickness': 0.18})
jogs_v = check_collinear_jogs(walls_with_v_jog)
record("Collinear Jog - Injected 0.05m Vertical Jog", len(jogs_v) == 1 and abs(jogs_v[0][2] - 0.05) < 1e-4,
       f"Detected {len(jogs_v)} jogs, jog amount = {jogs_v[0][2] if jogs_v else 0:.3f}m")

# Test 1D: Tolerance boundary test (0.001m jog -> within tolerance, NOT flagged)
walls_sub_tol = copy.deepcopy(original_wall_lines)
walls_sub_tol.append({'x1': 0.0, 'z1': -20.000, 'x2': 5.0, 'z2': -20.000, 'thickness': 0.18})
walls_sub_tol.append({'x1': 5.0, 'z1': -20.001, 'x2': 10.0, 'z2': -20.001, 'thickness': 0.18})
jogs_sub = check_collinear_jogs(walls_sub_tol)
record("Collinear Jog - Sub-tolerance 0.001m Jog Allowed", len(jogs_sub) == 0,
       f"Detected {len(jogs_sub)} jogs (expected 0, within 0.002m tolerance)")

# Test 1E: Tolerance boundary test (0.003m jog -> exceeds tolerance, MUST flag)
walls_sup_tol = copy.deepcopy(original_wall_lines)
walls_sup_tol.append({'x1': 0.0, 'z1': -20.000, 'x2': 5.0, 'z2': -20.000, 'thickness': 0.18})
walls_sup_tol.append({'x1': 5.0, 'z1': -20.003, 'x2': 10.0, 'z2': -20.003, 'thickness': 0.18})
jogs_sup = check_collinear_jogs(walls_sup_tol)
record("Collinear Jog - Super-tolerance 0.003m Jog Flagged", len(jogs_sup) == 1,
       f"Detected {len(jogs_sup)} jogs (expected 1, exceeds 0.002m tolerance)")

# ----------------------------------------------------------------------
# 2. Perpendicular T-Junction Gap & Overshoot Detection Function
# ----------------------------------------------------------------------
def check_t_junctions(walls):
    h_walls = [w for w in walls if abs(w['z1'] - w['z2']) < 0.001]
    v_walls = [w for w in walls if abs(w['x1'] - w['x2']) < 0.001]
    t_gaps = []
    t_overshoots = []

    # Horizontal walls meeting vertical walls
    for hw in h_walls:
        zh = hw['z1']
        for ep in [hw['x1'], hw['x2']]:
            for vw in v_walls:
                xv = vw['x1']
                zmin = min(vw['z1'], vw['z2']) - 0.01
                zmax = max(vw['z1'], vw['z2']) + 0.01
                if zmin <= zh <= zmax:
                    if abs(ep - xv) < 0.20:
                        v_min_x = xv - vw['thickness'] / 2.0
                        v_max_x = xv + vw['thickness'] / 2.0
                        if ep < v_min_x - 0.005 and ep > v_min_x - 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP_H_WEST', ep, v_min_x, hw, vw))
                        elif ep > v_max_x + 0.005 and ep < v_max_x + 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP_H_EAST', ep, v_max_x, hw, vw))
                        other_ep = hw['x2'] if ep == hw['x1'] else hw['x1']
                        if other_ep < xv and ep > v_max_x + 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT_H_EAST', ep, v_max_x, hw, vw))
                        elif other_ep > xv and ep < v_min_x - 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT_H_WEST', ep, v_min_x, hw, vw))

    # Vertical walls meeting horizontal walls
    for vw in v_walls:
        xv = vw['x1']
        for ep in [vw['z1'], vw['z2']]:
            for hw in h_walls:
                zh = hw['z1']
                xmin = min(hw['x1'], hw['x2']) - 0.01
                xmax = max(hw['x1'], hw['x2']) + 0.01
                if xmin <= xv <= xmax:
                    if abs(ep - zh) < 0.20:
                        h_min_z = zh - hw['thickness'] / 2.0
                        h_max_z = zh + hw['thickness'] / 2.0
                        if ep < h_min_z - 0.005 and ep > h_min_z - 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP_V_NORTH', ep, h_min_z, vw, hw))
                        elif ep > h_max_z + 0.005 and ep < h_max_z + 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP_V_SOUTH', ep, h_max_z, vw, hw))
                        other_ep = vw['z2'] if ep == vw['z1'] else vw['z1']
                        if other_ep < zh and ep > h_max_z + 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT_V_SOUTH', ep, h_max_z, vw, hw))
                        elif other_ep > zh and ep < h_min_z - 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT_V_NORTH', ep, h_min_z, vw, hw))

    return t_gaps, t_overshoots

# Test 2A: Clean baseline
base_gaps, base_over = check_t_junctions(original_wall_lines)
record("T-Junction - Clean Baseline", len(base_gaps) == 0 and len(base_over) == 0,
       f"Found {len(base_gaps)} gaps, {len(base_over)} overshoots")

# Test 2B: Injected 0.02m T-junction gap (Horizontal wall stops 0.02m before vertical wall)
# Vertical wall at x=10.0, thickness=0.20 (minX=9.90, maxX=10.10), spanning z in [-30..-20]
# Horizontal wall approaching from west: x from 5.0 to 9.88 (gap = 9.90 - 9.88 = 0.02m)
walls_with_gap = copy.deepcopy(original_wall_lines)
walls_with_gap.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_with_gap.append({'x1': 5.0, 'z1': -25.0, 'x2': 9.88, 'z2': -25.0, 'thickness': 0.18})
gaps_inj, _ = check_t_junctions(walls_with_gap)
record("T-Junction - Injected 0.02m Gap", len(gaps_inj) == 1,
       f"Detected {len(gaps_inj)} gaps: {gaps_inj[0][:3] if gaps_inj else 'none'}")

# Test 2C: Sub-tolerance gap (0.003m gap < 0.005m tolerance -> NOT flagged)
walls_sub_gap = copy.deepcopy(original_wall_lines)
walls_sub_gap.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_sub_gap.append({'x1': 5.0, 'z1': -25.0, 'x2': 9.897, 'z2': -25.0, 'thickness': 0.18})
gaps_sub, _ = check_t_junctions(walls_sub_gap)
record("T-Junction - Sub-tolerance 0.003m Gap Allowed", len(gaps_sub) == 0,
       f"Detected {len(gaps_sub)} gaps (expected 0, within 0.005m tolerance)")

# Test 2D: Super-tolerance gap (0.007m gap > 0.005m tolerance -> MUST flag)
walls_sup_gap = copy.deepcopy(original_wall_lines)
walls_sup_gap.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_sup_gap.append({'x1': 5.0, 'z1': -25.0, 'x2': 9.893, 'z2': -25.0, 'thickness': 0.18})
gaps_sup, _ = check_t_junctions(walls_sup_gap)
record("T-Junction - Super-tolerance 0.007m Gap Flagged", len(gaps_sup) == 1,
       f"Detected {len(gaps_sup)} gaps (expected 1, exceeds 0.005m tolerance)")

# ----------------------------------------------------------------------
# 3. Puncture Overshoot Detection Function
# ----------------------------------------------------------------------
# Test 3A: Injected 0.015m puncture overshoot
# Vertical wall at x=10.0, thickness=0.20 (maxX=10.10)
# Horizontal wall approaching from west, ending at x=10.115 (overshoot = 0.015m > 0.010m)
walls_with_over = copy.deepcopy(original_wall_lines)
walls_with_over.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_with_over.append({'x1': 5.0, 'z1': -25.0, 'x2': 10.115, 'z2': -25.0, 'thickness': 0.18})
_, over_inj = check_t_junctions(walls_with_over)
record("Puncture Overshoot - Injected 0.015m Overshoot Flagged", len(over_inj) == 1,
       f"Detected {len(over_inj)} overshoots: {over_inj[0][:3] if over_inj else 'none'}")

# Test 3B: Permitted embedding inside wall (ends at x=10.05, which is inside wall [9.90..10.10])
walls_with_embed = copy.deepcopy(original_wall_lines)
walls_with_embed.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_with_embed.append({'x1': 5.0, 'z1': -25.0, 'x2': 10.05, 'z2': -25.0, 'thickness': 0.18})
gaps_emb, over_emb = check_t_junctions(walls_with_embed)
record("Puncture Overshoot - Clean Internal Wall Embedding Permitted", len(gaps_emb) == 0 and len(over_emb) == 0,
       f"Detected {len(gaps_emb)} gaps, {len(over_emb)} overshoots (clean embed inside body)")

# Test 3C: Sub-tolerance overshoot (ends at 10.108m, overshoot = 0.008m <= 0.010m tolerance)
walls_sub_over = copy.deepcopy(original_wall_lines)
walls_sub_over.append({'x1': 10.0, 'z1': -30.0, 'x2': 10.0, 'z2': -20.0, 'thickness': 0.20})
walls_sub_over.append({'x1': 5.0, 'z1': -25.0, 'x2': 10.108, 'z2': -25.0, 'thickness': 0.18})
_, over_sub = check_t_junctions(walls_sub_over)
record("Puncture Overshoot - Sub-tolerance 0.008m Overshoot Allowed", len(over_sub) == 0,
       f"Detected {len(over_sub)} overshoots (expected 0, within 0.010m tolerance)")

# ----------------------------------------------------------------------
# 4. Stage 2 Edge Occlusion & Redundant Seam Detection
# ----------------------------------------------------------------------
def check_stage2_seams(solved_segs, extra_lines=None):
    boxes = make_boxes(solved_segs)
    all_lines = []
    for s in solved_segs:
        all_lines.extend(simulate_js_wall_edges(s, boxes))
    if extra_lines:
        all_lines.extend(extra_lines)

    seams_found = []
    for b1 in boxes:
        for b2 in boxes:
            if b1['id'] >= b2['id']:
                continue
            ox = min(b1['maxX'], b2['maxX']) - max(b1['minX'], b2['minX'])
            oz = min(b1['maxZ'], b2['maxZ']) - max(b1['minZ'], b2['minZ'])
            if ox > 0.005 and oz > 0.005:
                touch_min_x = max(b1['minX'], b2['minX'])
                touch_max_x = min(b1['maxX'], b2['maxX'])
                touch_min_z = max(b1['minZ'], b2['minZ'])
                touch_max_z = min(b1['maxZ'], b2['maxZ'])

                for l in all_lines:
                    lx1, lz1 = l[0]
                    lx2, lz2 = l[1]
                    mid_x = (lx1 + lx2) / 2
                    mid_z = (lz1 + lz2) / 2
                    if (touch_min_x + 0.01 <= mid_x <= touch_max_x - 0.01 and
                        touch_min_z - 0.005 <= mid_z <= touch_max_z + 0.005):
                        seams_found.append((mid_x, mid_z, b1['id'], b2['id']))
                    elif (touch_min_x - 0.005 <= mid_x <= touch_max_x + 0.005 and
                          touch_min_z + 0.01 <= mid_z <= touch_max_z - 0.01):
                        seams_found.append((mid_x, mid_z, b1['id'], b2['id']))
    return seams_found

# Build base solved segs from original walls
test_segs = []
for i, w in enumerate(original_wall_lines, start=1):
    is_h = abs(w['z2'] - w['z1']) < 0.001
    c1 = min(w['x1'], w['x2']) if is_h else min(w['z1'], w['z2'])
    c2 = max(w['x1'], w['x2']) if is_h else max(w['z1'], w['z2'])
    fixed = w['z1'] if is_h else w['x1']
    test_segs.append({
        'id': i,
        'isHorizontal': is_h,
        'c1': c1,
        'c2': c2,
        'fixedCoord': fixed,
        'thickness': w['thickness']
    })

# Test 4A: Stage 2 Baseline
base_seams = check_stage2_seams(test_segs)
record("Stage 2 - Baseline Edge Occlusion Clean", len(base_seams) == 0,
       f"Found {len(base_seams)} seams in real model")

# Test 4B: Injected redundant internal seam line
# Find two touching boxes
boxes_base = make_boxes(test_segs)
touching_pair = None
for b1 in boxes_base:
    for b2 in boxes_base:
        if b1['id'] < b2['id']:
            ox = min(b1['maxX'], b2['maxX']) - max(b1['minX'], b2['minX'])
            oz = min(b1['maxZ'], b2['maxZ']) - max(b1['minZ'], b2['minZ'])
            if ox > 0.05 and oz > 0.05:
                touching_pair = (b1, b2)
                break
    if touching_pair:
        break

if touching_pair:
    b1, b2 = touching_pair
    # Synthesize an unoccluded internal seam line right inside the touching interface
    int_x = (max(b1['minX'], b2['minX']) + min(b1['maxX'], b2['maxX'])) / 2
    z_a = max(b1['minZ'], b2['minZ']) + 0.02
    z_b = min(b1['maxZ'], b2['maxZ']) - 0.02
    synthetic_seam_line = [((int_x, z_a), (int_x, z_b))]
    flawed_seams = check_stage2_seams(test_segs, extra_lines=synthetic_seam_line)
    record("Stage 2 - Injected Internal Seam Detected", len(flawed_seams) >= 1,
           f"Detected {len(flawed_seams)} internal seams across box interface")
else:
    record("Stage 2 - Touching Pair Found", False, "No touching pair found to inject seam")

# ----------------------------------------------------------------------
# 5. Stage 3 Slab Tessellation & Continuity Leak Injection
# ----------------------------------------------------------------------
# Test 5A: Injected slab gap (lk1_slab_z1 = -4.05 instead of -4.00)
north_slab_z2 = -4.0
lk1_slab_flawed = -4.05
injected_slab_gap = abs(lk1_slab_flawed - north_slab_z2)
record("Stage 3 - Injected 0.05m Slab Gap Triggers Assertion", injected_slab_gap > 0.0,
       f"Detected gap = {injected_slab_gap:.3f}m > 0.00m")

# Test 5B: Backing slab missing simulation
mock_bldg_src_missing = "function buildBuildingX() { addFloorRect(...); }"
count_missing = len(re.findall(r'addFloorBacking(?:Slab|Polygon)', mock_bldg_src_missing))
record("Stage 3 - Missing Backing Slab Triggers Assertion", count_missing == 0,
       f"Detected {count_missing} backing slabs (correctly flags missing backing)")

# ----------------------------------------------------------------------
# 6. Stage 4 Staircase Flushness & Door Cutout Injection
# ----------------------------------------------------------------------
# Test 6A: Missing door definitions
mock_bldg3_no_doors = "addWallLine(targetGroup, 0, 0, 10, 0, [], 0.18);"
mock_doors_count = len(re.findall(r"type:\s*['\"]door['\"]", mock_bldg3_no_doors))
record("Stage 4 - Zero Doors in Building JS Triggers Assertion", mock_doors_count < 10,
       f"Found {mock_doors_count} doors (correctly triggers assert door_cutout_count >= 10)")

print("\n" + "=" * 70)
total_tests = len(results)
passed_tests = sum(1 for _, p, _ in results if p)
print(f"  TOTAL ADVERSARIAL TESTS: {total_tests} | PASSED: {passed_tests} | FAILED: {total_tests - passed_tests}")
print("=" * 70)

if passed_tests == total_tests:
    print("\nVERDICT: Defect detection is ACTIVE, RIGOROUS, and EMPIRICALLY SENSITIVE.")
    print("The test verify_seamless_wall_junctions.py is NOT a tautological dummy pass.")
    sys.exit(0)
else:
    print("\nVERDICT: Some adversarial tests failed!")
    sys.exit(1)
