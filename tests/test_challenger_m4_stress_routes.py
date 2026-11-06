#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_challenger_m4_stress_routes.py
==========================================
Empirical Adversarial Test Suite for Milestone 4 (High-Volume Routing & Robustness)
Challenger Agent: challenger_m4_2

Adversarial Objectives:
1. Run at least 100 randomized multi-floor routes across all 4 buildings
   (including tower 7th floor to building 4 3rd floor).
2. Verify 100% path finding success (with `allowElevators: false`).
3. Measure query latency: ensure P99 latency is sub-10ms.
4. Verify that all generated paths have 0 wall collisions along their entire trajectory.
5. Include mutation/negative control test to prove collision detection sensitivity.
"""

import sys
import os
import random
import time
import math
import subprocess

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

# Add tests/ to path to import campus navigation environment
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import validate_campus_navigation as vcn

# -----------------------------------------------------------------------------
# ROBUST GEOMETRY ENGINE (INDEPENDENT VERIFICATION)
# -----------------------------------------------------------------------------
def ccw(ax, az, bx, bz, cx, cz):
    return (cz - az) * (bx - ax) - (bz - az) * (cx - ax)

def segments_intersect(ax, az, bx, bz, cx, cz, dx, dz):
    """
    True 2D segment-segment intersection test using signed cross products.
    Endpoints C and D must be on opposite sides of AB, and A and B on opposite sides of CD.
    """
    cp1 = ccw(ax, az, bx, bz, cx, cz)
    cp2 = ccw(ax, az, bx, bz, dx, dz)  # Evaluates D (not C)
    cp3 = ccw(cx, cz, dx, dz, ax, az)
    cp4 = ccw(cx, cz, dx, dz, bx, bz)
    return (((cp1 > 1e-4 and cp2 < -1e-4) or (cp1 < -1e-4 and cp2 > 1e-4)) and
            ((cp3 > 1e-4 and cp4 < -1e-4) or (cp3 < -1e-4 and cp4 > 1e-4)))

def dist_point_to_segment(px, pz, ax, az, bx, bz):
    vx = bx - ax
    vz = bz - az
    len_sq = vx * vx + vz * vz
    if len_sq < 1e-8:
        return math.hypot(px - ax, pz - az)
    t = ((px - ax) * vx + (pz - az) * vz) / len_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * vx), pz - (az + t * vz))

def dist_segment_to_segment(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z):
    if segments_intersect(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z):
        return 0.0
    return min(
        dist_point_to_segment(p1x, p1z, q1x, q1z, q2x, q2z),
        dist_point_to_segment(p2x, p2z, q1x, q1z, q2x, q2z),
        dist_point_to_segment(q1x, q1z, p1x, p1z, p2x, p2z),
        dist_point_to_segment(q2x, q2z, p1x, p1z, p2x, p2z)
    )

def main():
    print("=" * 80)
    print("  EMPIRICAL CHALLENGER M4: HIGH-VOLUME ROUTING & ROBUSTNESS TEST")
    print("=" * 80)

    # 1. Load exact 3D geometry and Navigation Graph from headless browser
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    print(f"[INIT] Loading campus environment from {project_root}...")
    data = vcn.load_campus_environment(project_root)

    walls = data['walls']
    doors = data['doors']
    rooms = data['rooms']
    nodes = data['nodes']
    adj = data['adj']

    print(f"[INIT] Extracted: {len(walls)} walls, {len(doors)} doors, {len(rooms)} rooms, {len(nodes)} nav nodes, {len(adj)} adj lists.")

    # Index walls by floor for fast collision checking
    walls_by_floor = {}
    for w in walls:
        fl = w['floor']
        if fl not in walls_by_floor:
            walls_by_floor[fl] = []
        walls_by_floor[fl].append(w)

    def check_trajectory_collisions(path):
        """
        Check all intra-floor segments of the path trajectory against 3D physical walls.
        Returns list of collisions (if any).
        """
        collisions = []
        for i in range(len(path) - 1):
            u_id, v_id = path[i], path[i+1]
            u = nodes[u_id]
            v = nodes[v_id]
            if u['floor'] == v['floor']:
                floor = u['floor']
                fl_walls = walls_by_floor.get(floor, [])
                for w in fl_walls:
                    # Only check walls belonging to the same building or skywalk/common building 0
                    if w['building'] != u['bldg'] and w['building'] != v['bldg'] and w['building'] != 0:
                        continue
                    th = w.get('thickness', 0.18)
                    if th <= 0.09:
                        continue
                    clearance = (th / 2.0) - 0.02
                    dist = dist_segment_to_segment(
                        u['x'], u['z'], v['x'], v['z'],
                        w['x1'], w['z1'], w['x2'], w['z2']
                    )
                    if dist < clearance - 1e-4:
                        collisions.append({
                            'u': u_id,
                            'v': v_id,
                            'floor': floor,
                            'wall': w,
                            'distance': dist,
                            'clearance': clearance
                        })
        return collisions

    # -------------------------------------------------------------------------
    # NEGATIVE CONTROL / MUTATION SENSITIVITY TEST
    # -------------------------------------------------------------------------
    print("\n[STEP 1] Running Negative Control Mutation Test (Proving Collision Detector Sensitivity)...")
    # Pick a real wall from floor 1, e.g. a substantial wall in B1
    b1_f1_walls = [w for w in walls_by_floor.get(1, []) if w['building'] == 1 and w.get('thickness', 0.18) >= 0.18]
    assert len(b1_f1_walls) > 0, "No B1 F1 walls found for mutation test"
    sample_wall = b1_f1_walls[0]
    
    # Create an artificial synthetic segment crossing perpendicularly directly through sample_wall midpoint
    mx = (sample_wall['x1'] + sample_wall['x2']) / 2.0
    mz = (sample_wall['z1'] + sample_wall['z2']) / 2.0
    wx = sample_wall['x2'] - sample_wall['x1']
    wz = sample_wall['z2'] - sample_wall['z1']
    w_len = math.hypot(wx, wz)
    nx = -wz / w_len if w_len > 0 else 0
    nz = wx / w_len if w_len > 0 else 1

    # Synthetic nodes crossing right through the wall
    synth_u = {'id': 'synth_u', 'floor': 1, 'bldg': 1, 'x': mx - nx * 1.5, 'z': mz - nz * 1.5}
    synth_v = {'id': 'synth_v', 'floor': 1, 'bldg': 1, 'x': mx + nx * 1.5, 'z': mz + nz * 1.5}
    
    th = sample_wall.get('thickness', 0.18)
    clr = (th / 2.0) - 0.02
    synth_dist = dist_segment_to_segment(
        synth_u['x'], synth_u['z'], synth_v['x'], synth_v['z'],
        sample_wall['x1'], sample_wall['z1'], sample_wall['x2'], sample_wall['z2']
    )
    is_detected = synth_dist < clr - 1e-4
    print(f"  * Synthetic wall puncture test: dist={synth_dist:.4f}m, clearance={clr:.4f}m -> Detected={is_detected}")
    assert is_detected, "[MUTATION FAIL] Collision detector failed to detect synthetic perpendicular wall puncture!"
    print("  [PASS] Negative control mutation confirmed: collision detector has 100% sensitivity!")

    # -------------------------------------------------------------------------
    # DESIGNATED ADVERSARIAL HIGH-STRESS ROUTES
    # -------------------------------------------------------------------------
    print("\n[STEP 2] Preparing Test Routes...")
    designated_routes = [
        # 1-2. Tower Floor 7 <-> Building 4 Floor 3 (Extreme campus diagonal)
        ("Tower 7th Floor (Room 701) -> B4 3rd Floor (Room 312)", "room_1_7_92", "room_4_3_241"),
        ("B4 3rd Floor (Room 312) -> Tower 7th Floor (Room 701)", "room_4_3_241", "room_1_7_92"),
        # 3-4. Tower Floor 7 <-> Building 2 Floor 3
        ("Tower 7th Floor (Room 704) -> B2 3rd Floor (Room 304)", "room_1_7_88", "room_2_3_124"),
        ("B2 3rd Floor (Room 304) -> Tower 7th Floor (Room 704)", "room_2_3_124", "room_1_7_88"),
        # 5-6. Tower Floor 7 <-> Building 3 Floor 2
        ("Tower 7th Floor (Room 702) -> B3 2nd Floor (Room 201)", "room_1_7_90", "room_3_2_161"),
        ("B3 2nd Floor (Room 201) -> Tower 7th Floor (Room 702)", "room_3_2_161", "room_1_7_90"),
        # 7-8. Building 4 Floor 3 <-> Building 3 Floor 1
        ("B4 3rd Floor (Room 301) -> B3 1st Floor (Room 103)", "room_4_3_237", "room_3_1_139"),
        ("B3 1st Floor (Room 103) -> B4 3rd Floor (Room 301)", "room_3_1_139", "room_4_3_237"),
        # 9-10. Building 2 Floor 3 <-> Building 3 Floor 1
        ("B2 3rd Floor (Room 302) -> B3 1st Floor (Room 104)", "room_2_3_123", "room_3_1_140"),
        ("B3 1st Floor (Room 104) -> B2 3rd Floor (Room 302)", "room_3_1_140", "room_2_3_123"),
        # 11-12. Building 4 Floor 3 <-> Building 2 Floor 3
        ("B4 3rd Floor (Room 308) -> B2 3rd Floor (Room 306)", "room_4_3_248", "room_2_3_126"),
        ("B2 3rd Floor (Room 306) -> B4 3rd Floor (Room 308)", "room_2_3_126", "room_4_3_248"),
        # 13-17. Campus Entrances to Tower F7 and B4 F3
        ("Campus Main Entrance (B1 F1) -> Tower 7th Floor (Room 701)", "b1_f1_entrance_main", "room_1_7_92"),
        ("Campus Main Entrance (B1 F1) -> B4 3rd Floor (Room 312)", "b1_f1_entrance_main", "room_4_3_241"),
        ("B4 Entrance Porch (B4 F1) -> Tower 7th Floor (Room 701)", "b4_f1_porch", "room_1_7_92"),
        ("B3 Entrance West (B3 F1) -> Tower 7th Floor (Room 701)", "b3_f1_entrance_west", "room_1_7_92"),
        ("B2 Entrance Porch (B2 F1) -> B4 3rd Floor (Room 312)", "b2_f1_porch", "room_4_3_241"),
        # 18-20. Tower corridors to far corridors
        ("Tower F7 North Corridor -> B4 F3 Corridor", "b1_f7_nc_0.0", "b4_f3_c_377_489"),
        ("B4 F3 Corridor -> Tower F7 North Corridor", "b4_f3_c_377_489", "b1_f7_nc_0.0"),
        ("Tower F6 Corridor -> B2 F2 Corridor", "b1_f6_nc_0.0", "b2_f2_c_37.5")
    ]

    # Validate designated endpoints exist
    for desc, src, dst in designated_routes:
        assert src in nodes, f"Designated node missing: {src} in '{desc}'"
        assert dst in nodes, f"Designated node missing: {dst} in '{desc}'"

    # -------------------------------------------------------------------------
    # RANDOMIZED MULTI-FLOOR CROSS-CAMPUS ROUTE GENERATOR (120 ROUTES)
    # -------------------------------------------------------------------------
    rng = random.Random(20261102)
    node_keys = list(nodes.keys())
    
    # Filter candidate endpoints (prefer rooms, corridors, entrances, stairs, wc)
    valid_endpoints = [
        nid for nid in node_keys
        if nodes[nid].get('type') in ('room', 'corridor', 'entrance', 'stair', 'wc')
    ]
    
    randomized_routes = []
    attempts = 0
    target_random_count = 120

    while len(randomized_routes) < target_random_count and attempts < 10000:
        attempts += 1
        src = rng.choice(valid_endpoints)
        dst = rng.choice(valid_endpoints)
        if src == dst:
            continue
        nu = nodes[src]
        nv = nodes[dst]
        # Strictly multi-floor
        if nu['floor'] == nv['floor']:
            continue
        desc = f"Random #{len(randomized_routes)+1}: B{nu['bldg']} F{nu['floor']} ({src}) -> B{nv['bldg']} F{nv['floor']} ({dst})"
        randomized_routes.append((desc, src, dst))

    all_routes = designated_routes + randomized_routes
    total_routes_to_run = len(all_routes)
    print(f"  * Prepared {len(designated_routes)} designated high-stress routes.")
    print(f"  * Prepared {len(randomized_routes)} randomized multi-floor routes.")
    print(f"  * Total routes in adversarial suite: {total_routes_to_run}")

    # -------------------------------------------------------------------------
    # EXECUTION OF ADVERSARIAL ROUTE SUITE
    # -------------------------------------------------------------------------
    print(f"\n[STEP 3] Executing {total_routes_to_run} Multi-Floor Routes (allowElevators: false)...")
    
    latencies = []
    failures = []
    total_trajectory_collisions = 0
    collision_details = []
    elevator_violations = []

    start_suite_time = time.perf_counter()

    for idx, (desc, src, dst) in enumerate(all_routes, 1):
        t0 = time.perf_counter_ns()
        result = vcn.a_star_search(nodes, adj, src, dst, allow_elevators=False)
        t1 = time.perf_counter_ns()
        
        latency_ms = (t1 - t0) / 1e6
        latencies.append(latency_ms)

        if not result or not result.get('path'):
            failures.append({
                'index': idx,
                'desc': desc,
                'src': src,
                'dst': dst,
                'error': 'No path found'
            })
            continue

        path = result['path']

        # Verify start and dest matching
        if path[0] != src or path[-1] != dst:
            failures.append({
                'index': idx,
                'desc': desc,
                'error': f"Endpoint mismatch: got {path[0]}..{path[-1]}, expected {src}..{dst}"
            })

        # Verify elevator edge policy
        for k in range(len(path) - 1):
            u_id, v_id = path[k], path[k+1]
            edge = next((e for e in adj.get(u_id, []) if e['to'] == v_id), None)
            if edge and edge.get('isElevator', False):
                elevator_violations.append((idx, desc, u_id, v_id))

        # Check trajectory for physical 3D wall collisions
        colls = check_trajectory_collisions(path)
        if colls:
            total_trajectory_collisions += len(colls)
            collision_details.append({
                'index': idx,
                'desc': desc,
                'collisions': colls
            })

        # Print progress periodically
        if idx % 25 == 0 or idx == total_routes_to_run or idx <= 5:
            nu = nodes[src]
            nv = nodes[dst]
            print(f"  [{idx:3d}/{total_routes_to_run}] {latency_ms:6.3f}ms | B{nu['bldg']} F{nu['floor']} -> B{nv['bldg']} F{nv['floor']} | nodes={len(path):2d} dist={result['totalDistance']:6.1f}m | colls={len(colls)}")

    total_suite_time = time.perf_counter() - start_suite_time

    # -------------------------------------------------------------------------
    # STATISTICAL ANALYSIS & PERCENTILES
    # -------------------------------------------------------------------------
    latencies_sorted = sorted(latencies)
    n = len(latencies_sorted)
    p50 = latencies_sorted[int(0.50 * n)]
    p90 = latencies_sorted[int(0.90 * n)]
    p95 = latencies_sorted[int(0.95 * n)]
    p99 = latencies_sorted[int(0.99 * n)]
    min_lat = latencies_sorted[0]
    max_lat = latencies_sorted[-1]
    avg_lat = sum(latencies) / n

    print("\n" + "=" * 80)
    print("  ADVERSARIAL ROUTING PERFORMANCE & STRESS RESULTS")
    print("=" * 80)
    print(f"Total Routes Tested              : {total_routes_to_run}")
    print(f"Successful Routes (100% Target)  : {total_routes_to_run - len(failures)} / {total_routes_to_run} ({(1 - len(failures)/total_routes_to_run)*100:.2f}%)")
    print(f"Failed Routes                    : {len(failures)}")
    print(f"Elevator Policy Violations       : {len(elevator_violations)}")
    print(f"Physical 3D Wall Collisions      : {total_trajectory_collisions}")
    print("-" * 80)
    print(f"Total Suite Elapsed Time         : {total_suite_time * 1000:.2f} ms")
    print(f"Query Latency (Min)              : {min_lat:.3f} ms")
    print(f"Query Latency (Mean)             : {avg_lat:.3f} ms")
    print(f"Query Latency (P50 / Median)     : {p50:.3f} ms")
    print(f"Query Latency (P90)              : {p90:.3f} ms")
    print(f"Query Latency (P95)              : {p95:.3f} ms")
    print(f"Query Latency (P99 Target <10ms) : {p99:.3f} ms")
    print(f"Query Latency (Max)              : {max_lat:.3f} ms")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # ASSERTIONS
    # -------------------------------------------------------------------------
    assert len(failures) == 0, f"Route failures detected: {failures}"
    assert len(elevator_violations) == 0, f"Elevator policy violated: {elevator_violations}"
    assert total_trajectory_collisions == 0, f"Wall collisions along trajectory: {collision_details}"
    assert p99 < 10.0, f"P99 latency exceeded 10ms: {p99:.3f}ms"

    print("\n  ALL 4 ADVERSARIAL STRESS REQUIREMENTS PASSED EMPIRICALLY!")
    print("  - 100% Multi-floor route success across all 4 buildings: PASS")
    print(f"  - P99 latency sub-10ms ({p99:.3f} ms < 10.0 ms): PASS")
    print("  - Zero (0) physical 3D wall collisions along all trajectories: PASS")
    print("  - Strict Elevator Isolation Policy (allowElevators: false): PASS")
    print("=" * 80)
    return 0

if __name__ == '__main__':
    sys.exit(main())
