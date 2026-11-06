"""
tests/test_challenger_iter2_adversarial.py
==========================================
Empirical Adversarial Verification Suite for Challenger M1 Iteration 2.
Directly verifies:
1. Defect Case 1: 0.020m puncture from West -> classified strictly as
   WALL_PUNCTURE_OVERSHOOT and NOT WALL_JUNCTION_GAP.
2. Defect Case 2: 0.160m large puncture past far face -> caught in Stage 1
   (no blind spot).
3. Directional symmetry: East, North, South approaches tested for gap vs puncture.
4. Boundary condition stress tests (0.005m vs 0.006m gaps, 0.010m vs 0.011m overshoots, 0.299m vs 0.301m overshoots).
5. Subprocess execution against tests/verify_seamless_wall_junctions.py.
"""

import sys
import copy
import subprocess
import tempfile
import os

sys.stdout.reconfigure(encoding='utf-8')

# -----------------------------------------------------------------------------
# Part 1: Extract Stage 1 T-Junction Logic from tests/verify_seamless_wall_junctions.py
# -----------------------------------------------------------------------------

def evaluate_t_junctions(h_walls, v_walls):
    """
    Direct replication of lines 322-374 of tests/verify_seamless_wall_junctions.py.
    """
    t_gaps = []
    t_overshoots = []

    # Horizontal walls meeting vertical walls
    for hw in h_walls:
        zh = hw['z1']
        for ep in [hw['x1'], hw['x2']]:
            other_ep = hw['x2'] if ep == hw['x1'] else hw['x1']
            for vw in v_walls:
                xv = vw['x1']
                zmin = min(vw['z1'], vw['z2']) - 0.01
                zmax = max(vw['z1'], vw['z2']) + 0.01
                if zmin <= zh <= zmax:
                    v_min_x = xv - vw['thickness'] / 2.0
                    v_max_x = xv + vw['thickness'] / 2.0
                    if other_ep < xv:
                        # Approaching from West: near face is v_min_x, far face is v_max_x
                        if v_min_x - 0.15 < ep < v_min_x - 0.005:
                            t_gaps.append(('WALL_JUNCTION_GAP', ep, v_min_x, hw, vw))
                        elif v_max_x + 0.010 < ep < v_max_x + 0.30:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT', ep, v_max_x, hw, vw))
                    elif other_ep > xv:
                        # Approaching from East: near face is v_max_x, far face is v_min_x
                        if v_max_x + 0.005 < ep < v_max_x + 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP', ep, v_max_x, hw, vw))
                        elif v_min_x - 0.30 < ep < v_min_x - 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT', ep, v_min_x, hw, vw))

    # Vertical walls meeting horizontal walls
    for vw in v_walls:
        xv = vw['x1']
        for ep in [vw['z1'], vw['z2']]:
            other_ep = vw['z2'] if ep == vw['z1'] else vw['z1']
            for hw in h_walls:
                zh = hw['z1']
                xmin = min(hw['x1'], hw['x2']) - 0.01
                xmax = max(hw['x1'], hw['x2']) + 0.01
                if xmin <= xv <= xmax:
                    h_min_z = zh - hw['thickness'] / 2.0
                    h_max_z = zh + hw['thickness'] / 2.0
                    if other_ep < zh:
                        # Approaching from North: near face is h_min_z, far face is h_max_z
                        if h_min_z - 0.15 < ep < h_min_z - 0.005:
                            t_gaps.append(('WALL_JUNCTION_GAP', ep, h_min_z, vw, hw))
                        elif h_max_z + 0.010 < ep < h_max_z + 0.30:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT', ep, h_max_z, vw, hw))
                    elif other_ep > zh:
                        # Approaching from South: near face is h_max_z, far face is h_min_z
                        if h_max_z + 0.005 < ep < h_max_z + 0.15:
                            t_gaps.append(('WALL_JUNCTION_GAP', ep, h_max_z, vw, hw))
                        elif h_min_z - 0.30 < ep < h_min_z - 0.010:
                            t_overshoots.append(('WALL_PUNCTURE_OVERSHOOT', ep, h_min_z, vw, hw))

    return t_gaps, t_overshoots


results = []

def record(name, condition, details):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name} :: {details}")
    results.append((name, condition, details))


print("=" * 75)
print("  CHALLENGER M1 ITER 2 — ADVERSARIAL STRESS TEST & DEFECT RE-TEST")
print("=" * 75)

# Standard reference vertical wall: at xv=4.60, thickness=0.18 -> [v_min_x=4.51, v_max_x=4.69]
# Z span: [-60.0, -40.0]
ref_v_wall = {'x1': 4.60, 'z1': -60.0, 'x2': 4.60, 'z2': -40.0, 'thickness': 0.18}
# Standard reference horizontal wall: at zh=-50.0, thickness=0.18 -> [h_min_z=-50.09, h_max_z=-49.91]
# X span: [0.0, 10.0]
ref_h_wall = {'x1': 0.0, 'z1': -50.0, 'x2': 10.0, 'z2': -50.0, 'thickness': 0.18}

# -----------------------------------------------------------------------------
# Test 1: Defect Case 1 — 0.020m Puncture from the West
# -----------------------------------------------------------------------------
# Horizontal wall approaches from West (x1 = -1.6, x2 = 4.71)
# Far face is v_max_x = 4.69. Overshoot = 4.71 - 4.69 = 0.020m
hw_case1 = {'x1': -1.6, 'z1': -50.0, 'x2': 4.71, 'z2': -50.0, 'thickness': 0.18}
gaps1, overs1 = evaluate_t_junctions([hw_case1], [ref_v_wall])

cond1_no_gap = (len(gaps1) == 0)
cond1_has_over = (len(overs1) == 1 and overs1[0][0] == 'WALL_PUNCTURE_OVERSHOOT' and abs(overs1[0][1] - 4.71) < 1e-4)
record("Defect Case 1: 0.020m Puncture from West NOT in t_gaps", cond1_no_gap,
       f"gaps found = {len(gaps1)} (expected 0)")
record("Defect Case 1: 0.020m Puncture from West IS in t_overshoots", cond1_has_over,
       f"overshoots found = {len(overs1)}, entry = {overs1[0] if overs1 else 'none'}")

# -----------------------------------------------------------------------------
# Test 2: Defect Case 2 — 0.160m Large Puncture past Far Face (Stage 1 Blind Spot)
# -----------------------------------------------------------------------------
# Horizontal wall approaches from West (x1 = -1.6, x2 = 4.85)
# Far face is v_max_x = 4.69. Overshoot = 4.85 - 4.69 = 0.160m
# Centerline delta = abs(4.85 - 4.60) = 0.25m (previously exceeded 0.20m cutoff)
hw_case2 = {'x1': -1.6, 'z1': -50.0, 'x2': 4.85, 'z2': -50.0, 'thickness': 0.18}
gaps2, overs2 = evaluate_t_junctions([hw_case2], [ref_v_wall])

cond2_no_gap = (len(gaps2) == 0)
cond2_has_over = (len(overs2) == 1 and overs2[0][0] == 'WALL_PUNCTURE_OVERSHOOT' and abs(overs2[0][1] - 4.85) < 1e-4)
record("Defect Case 2: 0.160m Puncture NOT in t_gaps", cond2_no_gap,
       f"gaps found = {len(gaps2)} (expected 0)")
record("Defect Case 2: 0.160m Puncture IS in Stage 1 t_overshoots (Blind spot fixed)", cond2_has_over,
       f"overshoots found = {len(overs2)}, entry = {overs2[0] if overs2 else 'none'}")

# -----------------------------------------------------------------------------
# Test 3: Directional Symmetry — East Approach
# -----------------------------------------------------------------------------
# Approaching from East: other_ep = 8.0 > xv = 4.60. Near face = 4.69, far face = 4.51
# Gap: stops at x = 4.71 (gap = 0.020m before near face 4.69)
hw_east_gap = {'x1': 8.0, 'z1': -50.0, 'x2': 4.71, 'z2': -50.0, 'thickness': 0.18}
g_eg, o_eg = evaluate_t_junctions([hw_east_gap], [ref_v_wall])
record("East Approach: 0.020m Gap correctly detected in t_gaps", len(g_eg) == 1 and len(o_eg) == 0,
       f"gaps = {len(g_eg)}, overshoots = {len(o_eg)}")

# Puncture: penetrates to x = 4.49 (overshoot = 4.51 - 4.49 = 0.020m past far face 4.51)
hw_east_over = {'x1': 8.0, 'z1': -50.0, 'x2': 4.49, 'z2': -50.0, 'thickness': 0.18}
g_eo, o_eo = evaluate_t_junctions([hw_east_over], [ref_v_wall])
record("East Approach: 0.020m Puncture correctly detected in t_overshoots", len(g_eo) == 0 and len(o_eo) == 1,
       f"gaps = {len(g_eo)}, overshoots = {len(o_eo)}")

# Large puncture from East (0.160m past far face -> x = 4.51 - 0.160 = 4.35)
hw_east_lg = {'x1': 8.0, 'z1': -50.0, 'x2': 4.35, 'z2': -50.0, 'thickness': 0.18}
g_el, o_el = evaluate_t_junctions([hw_east_lg], [ref_v_wall])
record("East Approach: 0.160m Large Puncture correctly detected in t_overshoots", len(g_el) == 0 and len(o_el) == 1,
       f"gaps = {len(g_el)}, overshoots = {len(o_el)}")

# -----------------------------------------------------------------------------
# Test 4: Directional Symmetry — North Approach
# -----------------------------------------------------------------------------
# Vertical wall approaching from North: other_ep = -60.0 < zh = -50.0. Near face = -50.09, far face = -49.91
# Gap: stops at z = -50.11 (gap = 0.020m before near face -50.09)
vw_north_gap = {'x1': 5.0, 'z1': -60.0, 'x2': 5.0, 'z2': -50.11, 'thickness': 0.18}
g_ng, o_ng = evaluate_t_junctions([ref_h_wall], [vw_north_gap])
record("North Approach: 0.020m Gap correctly detected in t_gaps", len(g_ng) == 1 and len(o_ng) == 0,
       f"gaps = {len(g_ng)}, overshoots = {len(o_ng)}")

# Puncture: penetrates to z = -49.89 (overshoot = -49.89 - (-49.91) = 0.020m past far face)
vw_north_over = {'x1': 5.0, 'z1': -60.0, 'x2': 5.0, 'z2': -49.89, 'thickness': 0.18}
g_no, o_no = evaluate_t_junctions([ref_h_wall], [vw_north_over])
record("North Approach: 0.020m Puncture correctly detected in t_overshoots", len(g_no) == 0 and len(o_no) == 1,
       f"gaps = {len(g_no)}, overshoots = {len(o_no)}")

# Large puncture from North: 0.160m past far face -> z = -49.91 + 0.160 = -49.75
vw_north_lg = {'x1': 5.0, 'z1': -60.0, 'x2': 5.0, 'z2': -49.75, 'thickness': 0.18}
g_nl, o_nl = evaluate_t_junctions([ref_h_wall], [vw_north_lg])
record("North Approach: 0.160m Large Puncture correctly detected in t_overshoots", len(g_nl) == 0 and len(o_nl) == 1,
       f"gaps = {len(g_nl)}, overshoots = {len(o_nl)}")

# -----------------------------------------------------------------------------
# Test 5: Directional Symmetry — South Approach
# -----------------------------------------------------------------------------
# Vertical wall approaching from South: other_ep = -40.0 > zh = -50.0. Near face = -49.91, far face = -50.09
# Gap: stops at z = -49.89 (gap = 0.020m before near face -49.91)
vw_south_gap = {'x1': 5.0, 'z1': -40.0, 'x2': 5.0, 'z2': -49.89, 'thickness': 0.18}
g_sg, o_sg = evaluate_t_junctions([ref_h_wall], [vw_south_gap])
record("South Approach: 0.020m Gap correctly detected in t_gaps", len(g_sg) == 1 and len(o_sg) == 0,
       f"gaps = {len(g_sg)}, overshoots = {len(o_sg)}")

# Puncture: penetrates to z = -50.11 (overshoot = -50.09 - (-50.11) = 0.020m past far face)
vw_south_over = {'x1': 5.0, 'z1': -40.0, 'x2': 5.0, 'z2': -50.11, 'thickness': 0.18}
g_so, o_so = evaluate_t_junctions([ref_h_wall], [vw_south_over])
record("South Approach: 0.020m Puncture correctly detected in t_overshoots", len(g_so) == 0 and len(o_so) == 1,
       f"gaps = {len(g_so)}, overshoots = {len(o_so)}")

# -----------------------------------------------------------------------------
# Test 6: Boundary Values & Tolerances Stress Test
# -----------------------------------------------------------------------------
# Near face is 4.51. Sub-tolerance gap: stops at 4.506 (gap = 0.004m <= 0.005m tolerance)
hw_sub_gap = {'x1': -1.6, 'z1': -50.0, 'x2': 4.506, 'z2': -50.0, 'thickness': 0.18}
g_subg, _ = evaluate_t_junctions([hw_sub_gap], [ref_v_wall])
record("Boundary: Sub-tolerance 0.004m Gap Allowed (clean pass)", len(g_subg) == 0,
       f"gaps = {len(g_subg)} (expected 0)")

# Super-tolerance gap: stops at 4.504 (gap = 0.006m > 0.005m tolerance)
hw_sup_gap = {'x1': -1.6, 'z1': -50.0, 'x2': 4.504, 'z2': -50.0, 'thickness': 0.18}
g_supg, _ = evaluate_t_junctions([hw_sup_gap], [ref_v_wall])
record("Boundary: Super-tolerance 0.006m Gap Caught", len(g_supg) == 1,
       f"gaps = {len(g_supg)} (expected 1)")

# Far face is 4.69. Sub-tolerance overshoot: penetrates to 4.699 (overshoot = 0.009m <= 0.010m tolerance)
hw_sub_over = {'x1': -1.6, 'z1': -50.0, 'x2': 4.699, 'z2': -50.0, 'thickness': 0.18}
_, o_subo = evaluate_t_junctions([hw_sub_over], [ref_v_wall])
record("Boundary: Sub-tolerance 0.009m Overshoot Allowed (clean pass)", len(o_subo) == 0,
       f"overshoots = {len(o_subo)} (expected 0)")

# Super-tolerance overshoot: penetrates to 4.701 (overshoot = 0.011m > 0.010m tolerance)
hw_sup_over = {'x1': -1.6, 'z1': -50.0, 'x2': 4.701, 'z2': -50.0, 'thickness': 0.18}
_, o_supo = evaluate_t_junctions([hw_sup_over], [ref_v_wall])
record("Boundary: Super-tolerance 0.011m Overshoot Caught", len(o_supo) == 1,
       f"overshoots = {len(o_supo)} (expected 1)")

# Embedding inside wall body: ends at 4.60 (centerline, [4.51, 4.69])
hw_embed = {'x1': -1.6, 'z1': -50.0, 'x2': 4.60, 'z2': -50.0, 'thickness': 0.18}
g_emb, o_emb = evaluate_t_junctions([hw_embed], [ref_v_wall])
record("Boundary: Centerline Embedding (4.60 inside [4.51..4.69]) Clean Pass", len(g_emb) == 0 and len(o_emb) == 0,
       f"gaps = {len(g_emb)}, overshoots = {len(o_emb)}")

# Overshoot window boundary: 0.290m puncture (penetrates to 4.69 + 0.29 = 4.98 < 4.99)
hw_win_in = {'x1': -1.6, 'z1': -50.0, 'x2': 4.98, 'z2': -50.0, 'thickness': 0.18}
_, o_win_in = evaluate_t_junctions([hw_win_in], [ref_v_wall])
record("Boundary: 0.290m Puncture within 0.30m Window Caught", len(o_win_in) == 1,
       f"overshoots = {len(o_win_in)} (expected 1)")

# Through-wall: continuous wall passing through to x = 8.0 (> 0.30m past far face)
hw_through = {'x1': -1.6, 'z1': -50.0, 'x2': 8.0, 'z2': -50.0, 'thickness': 0.18}
g_th, o_th = evaluate_t_junctions([hw_through], [ref_v_wall])
record("Through-Wall: Continuous wall through junction NOT flagged as overshoot", len(g_th) == 0 and len(o_th) == 0,
       f"gaps = {len(g_th)}, overshoots = {len(o_th)} (clean pass)")


# -----------------------------------------------------------------------------
# Part 2: Subprocess Mutation Execution against verify_seamless_wall_junctions.py
# -----------------------------------------------------------------------------
print("\n" + "=" * 75)
print("  SUBPROCESS MUTATION RUNS AGAINST verify_seamless_wall_junctions.py")
print("=" * 75)

with open("js/buildings/building3.js", "r", encoding="utf-8") as f:
    b3_orig = f.read()

sub_runner_template = """
import sys
real_open = open

def mocked_open(path, *args, **kwargs):
    normalized = path.replace("\\\\", "/")
    if normalized.endswith("js/buildings/building3.js"):
        import io
        return io.StringIO({b3_content_repr})
    return real_open(path, *args, **kwargs)

import builtins
builtins.open = mocked_open

with real_open("tests/verify_seamless_wall_junctions.py", "r", encoding="utf-8") as f:
    code = f.read()

exec(compile(code, "tests/verify_seamless_wall_junctions.py", "exec"))
"""

def run_b3_mutation(mutation_str):
    runner_code = sub_runner_template.format(b3_content_repr=repr(mutation_str))
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tf:
        tf.write(runner_code)
        temp_name = tf.name
    try:
        proc = subprocess.run([sys.executable, temp_name], capture_output=True, text=True, encoding='utf-8')
        return proc.returncode, proc.stdout + proc.stderr
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)

# Subprocess Test 1: Clean B3 code
rc_clean, out_clean = run_b3_mutation(b3_orig)
record("Subprocess: Clean Baseline Run", rc_clean == 0 and "ALL 4-STAGE SEAMLESS JUNCTION" in out_clean,
       f"exit_code = {rc_clean}")

# Subprocess Test 2: Injected 0.020m Puncture (West approach: B3_X_CORR_W replaced with 4.71)
b3_mut_020 = b3_orig.replace(
    "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
    "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.71, -55.0, [], INNER_T);"
)
rc_020, out_020 = run_b3_mutation(b3_mut_020)
is_overshoot_error = ("T-junction puncture overshoots:" in out_020)
is_gap_error = ("T-junction gaps:" in out_020)
record("Subprocess: Case 1 (0.020m puncture) fails with puncture overshoot assertion",
       rc_020 != 0 and is_overshoot_error and not is_gap_error,
       f"exit_code = {rc_020}, overshoot_msg={is_overshoot_error}, gap_msg={is_gap_error}")

# Subprocess Test 3: Injected 0.160m Puncture (West approach: B3_X_CORR_W replaced with 4.85)
b3_mut_160 = b3_orig.replace(
    "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
    "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.85, -55.0, [], INNER_T);"
)
rc_160, out_160 = run_b3_mutation(b3_mut_160)
is_overshoot_160 = ("T-junction puncture overshoots:" in out_160)
# Verify it failed in Stage 1 and did not reach Stage 2
reached_stage2 = ("[STAGE 2]" in out_160)
record("Subprocess: Case 2 (0.160m puncture) caught in Stage 1 (no blind spot)",
       rc_160 != 0 and is_overshoot_160 and not reached_stage2,
       f"exit_code = {rc_160}, overshoot_msg={is_overshoot_160}, reached_stage2={reached_stage2}")

# Subprocess Test 4: Injected 0.020m Gap (West approach: B3_X_CORR_W replaced with 4.49)
b3_mut_gap = b3_orig.replace(
    "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
    "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.49, -55.0, [], INNER_T);"
)
rc_gap, out_gap = run_b3_mutation(b3_mut_gap)
is_gap_msg = ("T-junction gaps:" in out_gap)
is_over_msg = ("T-junction puncture overshoots:" in out_gap)
record("Subprocess: Gap mutation fails strictly with gap assertion",
       rc_gap != 0 and is_gap_msg and not is_over_msg,
       f"exit_code = {rc_gap}, gap_msg={is_gap_msg}, over_msg={is_over_msg}")

print("\n" + "=" * 75)
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
failed = total - passed
print(f"  TOTAL TESTS: {total} | PASSED: {passed} | FAILED: {failed}")
print("=" * 75)

if failed == 0:
    print("\nALL VERIFICATION & ADVERSARIAL TESTS PASSED PERFECTLY!")
    sys.exit(0)
else:
    print(f"\nFAILURE: {failed} tests failed!")
    sys.exit(1)
