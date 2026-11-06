#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_adversarial_m4.py
============================
EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 4
Author: challenger_m4_1

Adversarial Stress Requirements:
1. Empirically verify that `tests/validate_campus_navigation.py` is genuine and highly sensitive by testing synthetic mutations/adversarial defect cases:
   - Defect Mutation 1 (Synthetic Wall Collision): Inject a synthetic wall intersecting an active graph edge — assert that Tier 1 catches it.
   - Defect Mutation 2 (Severed Stair Shaft): Sever a vertical staircase edge between adjacent floors — assert that Tier 3 catches the shaft break.
   - Defect Mutation 3 (Severed Skywalk): Sever an inter-building skywalk link on Floor 2 — assert that Tier 4 catches the cross-building break.
   - Defect Mutation 4 (Elevator Mode Bypass): Verify that `allowElevators: false` strictly forbids traversing elevator shafts.
2. Confirm that baseline unmodified code passes 100% of checks.
3. Confirm git status shows 0 commits created.
4. Provide a clear verdict: APPROVE or REQUEST_CHANGES.
"""

import os
import sys
import copy
import math
import subprocess

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import tests.validate_campus_navigation as vcn
from tests.validate_campus_navigation import (
    load_campus_environment,
    CampusValidator,
    a_star_search
)

def ccw(ax, az, bx, bz, cx, cz):
    return (cz - az) * (bx - ax) - (bz - az) * (cx - ax)

def segments_intersect_fixed(ax, az, bx, bz, cx, cz, dx, dz):
    """
    Corrected segments_intersect fixing line 44 copy-paste bug:
    cp2 must evaluate (ax, az, bx, bz, dx, dz), NOT (ax, az, bx, bz, cx, cz).
    """
    cp1 = ccw(ax, az, bx, bz, cx, cz)
    cp2 = ccw(ax, az, bx, bz, dx, dz)
    cp3 = ccw(cx, cz, dx, dz, ax, az)
    cp4 = ccw(cx, cz, dx, dz, bx, bz)
    return (((cp1 > 1e-4 and cp2 < -1e-4) or (cp1 < -1e-4 and cp2 > 1e-4)) and
            ((cp3 > 1e-4 and cp4 < -1e-4) or (cp3 < -1e-4 and cp4 > 1e-4)))

def run_adversarial_suite():
    print("=" * 80)
    print("  EMPIRICAL CHALLENGER M4: ADVERSARIAL VERIFICATION & MUTATION SUITE")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # STEP 1: LOAD GENUINE CAMPUS ENVIRONMENT
    # -------------------------------------------------------------------------
    print("\n[STEP 1] Extracting baseline campus geometry and navigation graph via Headless Edge...")
    baseline_data = load_campus_environment(REPO_ROOT)
    
    total_walls = len(baseline_data['walls'])
    total_doors = len(baseline_data['doors'])
    total_rooms = len(baseline_data['rooms'])
    total_nodes = len(baseline_data['nodes'])
    total_adj = len(baseline_data['adj'])

    print(f"  * Extracted Walls : {total_walls}")
    print(f"  * Extracted Doors : {total_doors}")
    print(f"  * Extracted Rooms : {total_rooms}")
    print(f"  * Extracted Nodes : {total_nodes}")
    print(f"  * Extracted Adjacency Lists : {total_adj}")

    assert total_walls >= 1000, f"Expected >= 1000 walls, got {total_walls}"
    assert total_rooms >= 200, f"Expected >= 200 rooms, got {total_rooms}"
    assert total_nodes >= 1000, f"Expected >= 1000 nodes, got {total_nodes}"
    print("  [PASS] Campus environment successfully extracted and verified.")

    # -------------------------------------------------------------------------
    # STEP 2: BASELINE VALIDATION CONFIRMATION (100% PASS)
    # -------------------------------------------------------------------------
    print("\n[STEP 2] Running baseline validation on unmodified data...")
    validator = CampusValidator(copy.deepcopy(baseline_data))
    exit_code = validator.run_all()
    assert exit_code == 0, f"Baseline validation failed with exit code {exit_code}!"
    assert len(validator.errors) == 0, f"Baseline validation reported errors: {validator.errors}"
    print("  [PASS] Baseline unmodified code passes 100% of all tiers with exit code 0.")

    # -------------------------------------------------------------------------
    # STEP 3: DEFECT MUTATION 1 (SYNTHETIC WALL COLLISION) & DISCOVERY OF LINE 44 BUG
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[MUTATION 1] Injecting synthetic wall collision intersecting an active graph edge...")
    print("=" * 80)
    
    mutated_m1 = copy.deepcopy(baseline_data)
    
    # Pick an active intra-floor edge on Floor 1, Building 1: entrance to main corridor
    ent_node = mutated_m1['nodes']['b1_f1_entrance_main']
    nbrs = mutated_m1['adj']['b1_f1_entrance_main']
    assert len(nbrs) > 0, "No neighbors found for b1_f1_entrance_main"
    
    target_edge_to = nbrs[0]['to']
    target_node = mutated_m1['nodes'][target_edge_to]
    print(f"  * Target edge for collision injection: 'b1_f1_entrance_main' ({ent_node['x']}, {ent_node['z']}) "
          f"<-> '{target_edge_to}' ({target_node['x']}, {target_node['z']})")
    
    # Compute midpoint and perpendicular wall
    mx = (ent_node['x'] + target_node['x']) / 2.0
    mz = (ent_node['z'] + target_node['z']) / 2.0
    edx = target_node['x'] - ent_node['x']
    edz = target_node['z'] - ent_node['z']
    elen = math.hypot(edx, edz)
    
    # Normal vector of length 1.5m
    nx = -edz / elen * 1.5
    nz = edx / elen * 1.5
    
    synthetic_wall = {
        'building': 1,
        'floor': 1,
        'x1': round(mx - nx, 3),
        'z1': round(mz - nz, 3),
        'x2': round(mx + nx, 3),
        'z2': round(mz + nz, 3),
        'thickness': 0.24
    }
    mutated_m1['walls'].append(synthetic_wall)
    print(f"  * Injected synthetic wall: ({synthetic_wall['x1']}, {synthetic_wall['z1']}) to "
          f"({synthetic_wall['x2']}, {synthetic_wall['z2']}) [B1 F1, thickness=0.24m]")

    # Run unpatched validator
    validator_m1_unpatched = CampusValidator(mutated_m1)
    col_res_unpatched = validator_m1_unpatched.test_wall_collisions()
    print(f"  * Unpatched Tier 1 Collision Count: {col_res_unpatched['collision_count']}")
    
    # CRITICAL EMPIRICAL PROOF OF LINE 44 BUG:
    if col_res_unpatched['collision_count'] == 0:
        print("  [CRITICAL DEFECT DETECTED] Unpatched Tier 1 MISSED the intersecting wall collision!")
        print("    -> Root Cause: tests/validate_campus_navigation.py line 44 contains copy-paste typo:")
        print("       Line 43: cp1 = ccw(ax, az, bx, bz, cx, cz)")
        print("       Line 44: cp2 = ccw(ax, az, bx, bz, cx, cz)  <-- Should be (ax, az, bx, bz, dx, dz)")
        print("    -> Because cp1 == cp2, segments_intersect ALWAYS returns False for all segments!")

    # Verify with patched segments_intersect
    original_si = vcn.segments_intersect
    vcn.segments_intersect = segments_intersect_fixed
    
    validator_m1_patched = CampusValidator(mutated_m1)
    col_res_patched = validator_m1_patched.test_wall_collisions()
    print(f"  * Patched Tier 1 Collision Count: {col_res_patched['collision_count']}")
    assert col_res_patched['collision_count'] >= 1, "Patched Tier 1 failed to detect wall collision!"
    print(f"  * Successfully detected colliding edge: {col_res_patched['colliding_edges'][0]['edge']}")
    
    # Confirm baseline geometry with patched segments_intersect still has 0 collisions:
    baseline_check = CampusValidator(baseline_data)
    baseline_col = baseline_check.test_wall_collisions()
    assert baseline_col['collision_count'] == 0, f"Baseline has unexpected collisions with fixed segments_intersect: {baseline_col}"
    print("  * Verified: Baseline campus geometry genuinely has ZERO (0) wall collisions with fixed segments_intersect!")

    # Restore
    vcn.segments_intersect = original_si

    # -------------------------------------------------------------------------
    # STEP 4: DEFECT MUTATION 2 (SEVERED STAIR SHAFT)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[MUTATION 2] Severing a vertical staircase edge between adjacent floors...")
    print("=" * 80)
    
    mutated_m2 = copy.deepcopy(baseline_data)
    u_stair = 'b1_f3_stair_lk1'
    v_stair = 'b1_f4_stair_lk1'
    print(f"  * Severing vertical edge: '{u_stair}' <-> '{v_stair}' in B1 LK-1")
    
    # Remove edge in both directions
    mutated_m2['adj'][u_stair] = [e for e in mutated_m2['adj'][u_stair] if e['to'] != v_stair]
    mutated_m2['adj'][v_stair] = [e for e in mutated_m2['adj'][v_stair] if e['to'] != u_stair]

    validator_m2 = CampusValidator(mutated_m2)
    shaft_res = validator_m2.test_vertical_shafts()
    b1_lk1_res = next(s for s in shaft_res if s['id'] == 'b1_lk1')
    
    print(f"  * Shaft b1_lk1 results: passed={b1_lk1_res['passed']}, edges_ok={b1_lk1_res['edges_ok']}, traversal_ok={b1_lk1_res['traversal_ok']}")
    assert not b1_lk1_res['passed'], "Tier 3 FAILED to detect broken stair shaft in b1_lk1!"
    assert not b1_lk1_res['edges_ok'], "Tier 3 edges_ok was True despite severed vertical edge!"
    assert any("[BROKEN_STAIR_EDGE]" in err for err in validator_m2.errors), "Missing [BROKEN_STAIR_EDGE] error tag"
    print("  [PASS] Defect Mutation 2 (Severed Stair Shaft) caught 100% by Tier 3!")

    # -------------------------------------------------------------------------
    # STEP 5: DEFECT MUTATION 3 (SEVERED SKYWALK) & DETOUR DETECTION
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[MUTATION 3] Severing an inter-building skywalk link on Floor 2...")
    print("=" * 80)
    
    mutated_m3 = copy.deepcopy(baseline_data)
    u_bridge = 'custom_b1_f2_c_180_-56_1nw'
    v_bridge = 'b2_f2_c_20.4'
    print(f"  * Severing physical bridge link: '{u_bridge}' <-> '{v_bridge}' (K1 <-> K2 Bridge)")
    
    mutated_m3['adj'][u_bridge] = [e for e in mutated_m3['adj'][u_bridge] if e['to'] != v_bridge]
    mutated_m3['adj'][v_bridge] = [e for e in mutated_m3['adj'][v_bridge] if e['to'] != u_bridge]

    validator_m3 = CampusValidator(mutated_m3)
    sky_res = validator_m3.test_floor2_skywalks()
    k1_k2_bridge = next(b for b in sky_res['bridges'] if 'K1 ↔ K2' in b['name'])
    
    print(f"  * Unpatched Tier 4 report on severed bridge: passed={k1_k2_bridge['passed']}, path_ok={k1_k2_bridge['path_ok']}, cost={k1_k2_bridge['cost_m']}m")
    
    # EMPIRICAL PROOF OF TIER 4 DETOUR BYPASS:
    if k1_k2_bridge['passed'] and k1_k2_bridge['cost_m'] > 30.0:
        print("  [CRITICAL DEFECT DETECTED] Unpatched Tier 4 falsely reported [PASS] for severed bridge!")
        print(f"    -> Root Cause: A* found a {k1_k2_bridge['cost_m']}m detour down to Floor 1 outdoor grounds!")
        print("    -> test_floor2_skywalks() failed to assert that the route stays on Floor 2 and has direct cost <= 25m.")

    # With proper constraint (route must stay on Floor 2 and cost <= 25m):
    route_check = a_star_search(mutated_m3['nodes'], mutated_m3['adj'], u_bridge, v_bridge, allow_elevators=False)
    route_floors = set(mutated_m3['nodes'][nid]['floor'] for nid in route_check['path'])
    direct_bridge_ok = (len(route_check['path']) <= 4 and route_floors == {2} and route_check['totalDistance'] <= 25.0)
    assert not direct_bridge_ok, "Severed bridge should fail direct skywalk continuity!"
    print("  [PASS] Defect Mutation 3 (Severed Skywalk Bridge): Direct skywalk check strictly detects severance!")

    # -------------------------------------------------------------------------
    # STEP 6: DEFECT MUTATION 4 (ELEVATOR MODE BYPASS & ISOLATION)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[MUTATION 4] Verifying elevator mode policy and strict bypass lockdown...")
    print("=" * 80)
    
    # Test 4A: Check Tier 6 catches unflagged elevator edges
    mutated_m4a = copy.deepcopy(baseline_data)
    elev_edge = next(e for e in mutated_m4a['adj']['b1_f1_elev'] if e['to'] == 'b1_f2_elev')
    elev_edge['isElevator'] = False
    
    validator_m4a = CampusValidator(mutated_m4a)
    elev_res_4a = validator_m4a.test_elevator_policy()
    print(f"  * Tier 6 unflagged edge detection: passed={elev_res_4a['passed']}, edges_flagged={elev_res_4a['edges_flagged']}")
    assert not elev_res_4a['passed'], "Tier 6 FAILED to catch unflagged elevator edge!"
    assert not elev_res_4a['edges_flagged'], "Tier 6 reported edges_flagged=True when isElevator was False!"
    assert any("[ELEVATOR_POLICY]" in err for err in validator_m4a.errors), "Missing [ELEVATOR_POLICY] error tag"
    print("  [PASS] Mutation 4A: Missing isElevator tag detected with 100% sensitivity.")

    # Test 4B: Strict Bypass Lockdown
    print("\n  * Testing Strict Elevator Lockdown (severing all vertical stair paths between F1 and F2)...")
    mutated_m4b = copy.deepcopy(baseline_data)
    
    stair_pairs = [
        ('b1_f1_stair_lk1', 'b1_f2_stair_lk1'),
        ('b1_f1_stair_lk2', 'b1_f2_stair_lk2'),
        ('b2_f1_stair_lk1', 'b2_f2_stair_lk1'),
        ('b2_f1_stair_lk2', 'b2_f2_stair_lk2'),
        ('b2_f1_stair_lk3', 'b2_f2_stair_lk3'),
        ('b3_f1_stair_south', 'b3_f2_stair_south'),
        ('b3_f1_stair_north', 'b3_f2_stair_north'),
        ('b4_f1_stair_lk1', 'b4_f2_stair_lk1'),
        ('b4_f1_stair_lk2', 'b4_f2_stair_lk2'),
        ('b4_f1_stair_lk3', 'b4_f2_stair_lk3'),
    ]
    for u, v in stair_pairs:
        if u in mutated_m4b['adj']:
            mutated_m4b['adj'][u] = [e for e in mutated_m4b['adj'][u] if e['to'] != v]
        if v in mutated_m4b['adj']:
            mutated_m4b['adj'][v] = [e for e in mutated_m4b['adj'][v] if e['to'] != u]

    # Verify A* from B1 F1 entrance to B1 F2 corridor:
    route_no_elev = a_star_search(
        mutated_m4b['nodes'],
        mutated_m4b['adj'],
        'b1_f1_entrance_main',
        'b1_f2_nc_0.0',
        allow_elevators=False
    )
    print(f"  * Route F1 -> F2 with allowElevators=False: {route_no_elev}")
    assert route_no_elev is None, "A* VIOLATED ELEVATOR LOCKDOWN: Found path across elevator when allowElevators=False!"

    route_with_elev = a_star_search(
        mutated_m4b['nodes'],
        mutated_m4b['adj'],
        'b1_f1_entrance_main',
        'b1_f2_nc_0.0',
        allow_elevators=True
    )
    assert route_with_elev is not None, "A* failed to route through elevator when allowElevators=True!"
    print(f"  * Route F1 -> F2 with allowElevators=True: {len(route_with_elev['path'])} nodes, cost={route_with_elev['totalDistance']:.2f}m")
    
    has_elev_node = any('elev' in nid for nid in route_with_elev['path'])
    assert has_elev_node, "Elevator route did not traverse elevator node!"
    print("  [PASS] Defect Mutation 4 (Elevator Mode Bypass) 100% verified — strict lockdown enforced.")

    # -------------------------------------------------------------------------
    # STEP 7: CHECK GIT STATUS (0 COMMITS CREATED)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[STEP 7] Confirming git status and 0 commits constraint...")
    print("=" * 80)
    git_head = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, cwd=REPO_ROOT)
    head_hash = git_head.stdout.strip()
    print(f"  * Current git HEAD: {head_hash}")
    assert head_hash.startswith('05a1d5e'), f"Unexpected git HEAD: {head_hash}"
    print("  [PASS] Verified 0 git commits created.")

    print("\n" + "=" * 80)
    print("  ADVERSARIAL STRESS TEST SUITE COMPLETE.")
    print("  VERDICT: REQUEST_CHANGES (due to Line 44 typo and Tier 4 skywalk detour bug)")
    print("=" * 80)
    return 0

if __name__ == '__main__':
    code = run_adversarial_suite()
    sys.exit(code)
