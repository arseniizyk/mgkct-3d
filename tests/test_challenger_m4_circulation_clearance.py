#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_challenger_m4_circulation_clearance.py
=================================================
Empirical Adversarial Test Suite for Milestone 4 Pedestrian Circulation & Throat Clearance.
Author: challenger_m4_nav (critic, specialist)

Objectives:
1. Empirically verify that pedestrian circulation through the student forecourt and promenade
   (from Building 1 main entrance to bus stop, Building 2, and along the promenade)
   has zero obstacle collisions.
2. Verify that all pedestrian circulation corridors maintain continuous throat clearance >= 2.0m.
3. Compute exact analytical 2D clearance profiles and bottlenecks along:
   - Corridor 1: Building 1 Main Entrance -> Bus Stop Platform Western Apron
   - Corridor 2: Building 1 Main Entrance -> Bus Stop Platform Eastern Apron
   - Corridor 3: Building 1 Main Entrance -> Building 2 Approach Walkway
   - Corridor 4: Forecourt Plaza 1 -> South Promenade Connection
   - Corridor 5: South Promenade Main Continuous Spine (East-West)
   - Corridor 6: South Promenade Eastern Bike Station Bypass (South & North Chutes)
   - Corridor 7: Forecourt Western Plaza -> Stele Gateway Thoroughfare
4. Include negative control / mutation test: inject a synthetic obstacle in the circulation corridor
   to prove 100% defect sensitivity of the clearance verification engine.
"""

import os
import sys
import math
import copy

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

# -----------------------------------------------------------------------------
# 2D GEOMETRY UTILITIES
# -----------------------------------------------------------------------------
def dist_point_to_box(px, pz, min_x, max_x, min_z, max_z):
    dx = max(0.0, max(min_x - px, px - max_x))
    dz = max(0.0, max(min_z - pz, pz - max_z))
    return math.hypot(dx, dz)

def segment_intersects_box(ax, az, bx, bz, min_x, max_x, min_z, max_z):
    # Liang-Barsky line clipping against AABB
    dx = bx - ax
    dz = bz - az
    p = [-dx, dx, -dz, dz]
    q = [ax - min_x, max_x - ax, az - min_z, max_z - az]
    u1 = 0.0
    u2 = 1.0
    for i in range(4):
        if abs(p[i]) < 1e-9:
            if q[i] < 0:
                return False
        else:
            t = q[i] / p[i]
            if p[i] < 0:
                if t > u2:
                    return False
                if t > u1:
                    u1 = t
            else:
                if t < u1:
                    return False
                if t < u2:
                    u2 = t
    return u1 <= u2

# -----------------------------------------------------------------------------
# OBSTACLE & AMENITY REGISTRY (EXACT BOUNDING BOXES FROM js/territory.js)
# -----------------------------------------------------------------------------
def get_territory_obstacles():
    """
    Returns exact 2D footprint bounding boxes for all territory amenities,
    furniture, structures, and building obstacles.
    """
    obstacles = []

    # 1. Ergonomic Benches (6 total)
    # Bench dimensions: length = 2.10m, depth = 0.70m
    bench_positions = [
        {"name": "Promenade Bench 1", "x": 24.0, "z": 17.8, "w": 2.10, "d": 0.70},
        {"name": "Promenade Bench 2", "x": 36.0, "z": 17.8, "w": 2.10, "d": 0.70},
        {"name": "Promenade Bench 3", "x": 48.0, "z": 17.8, "w": 2.10, "d": 0.70},
        {"name": "Promenade Bench 4", "x": 60.0, "z": 17.8, "w": 2.10, "d": 0.70},
        {"name": "Forecourt Bench 1", "x": -18.0, "z": 16.5, "w": 2.10, "d": 0.70},
        {"name": "Forecourt Bench 2", "x": -12.0, "z": 16.5, "w": 2.10, "d": 0.70},
    ]
    for b in bench_positions:
        obstacles.append({
            "name": b["name"],
            "type": "bench",
            "type_cat": "amenity",
            "min_x": b["x"] - b["w"] / 2,
            "max_x": b["x"] + b["w"] / 2,
            "min_z": b["z"] - b["d"] / 2,
            "max_z": b["z"] + b["d"] / 2,
            "cx": b["x"],
            "cz": b["z"]
        })

    # 2. Park Waste Bins (7 total)
    # Bin diameter = 0.42m (radius = 0.21m)
    bin_positions = [
        {"name": "Promenade Bin 1", "x": 26.2, "z": 17.8, "r": 0.21},
        {"name": "Promenade Bin 2", "x": 38.2, "z": 17.8, "r": 0.21},
        {"name": "Promenade Bin 3", "x": 50.2, "z": 17.8, "r": 0.21},
        {"name": "Promenade Bin 4", "x": 62.2, "z": 17.8, "r": 0.21},
        {"name": "Forecourt Bin 1", "x": -10.2, "z": 16.5, "r": 0.21},
        {"name": "Forecourt Bin 2", "x": -11.8, "z": 20.5, "r": 0.21},
        {"name": "Descent Bin", "x": 16.8, "z": 13.5, "r": 0.21},
    ]
    for bn in bin_positions:
        obstacles.append({
            "name": bn["name"],
            "type": "waste_bin",
            "type_cat": "amenity",
            "min_x": bn["x"] - bn["r"],
            "max_x": bn["x"] + bn["r"],
            "min_z": bn["z"] - bn["r"],
            "max_z": bn["z"] + bn["r"],
            "cx": bn["x"],
            "cz": bn["z"]
        })

    # 3. Bicycle Parking Stations (2 stations)
    # 5 Sheffield hoops: width = 3.50m, depth = 1.00m
    bike_stations = [
        {"name": "Primary Bike Station (West)", "x": -14.0, "z": 20.5, "w": 3.50, "d": 1.00},
        {"name": "Secondary Bike Station (East)", "x": 66.0, "z": 21.0, "w": 3.50, "d": 1.00},
    ]
    for bk in bike_stations:
        obstacles.append({
            "name": bk["name"],
            "type": "bike_station",
            "type_cat": "amenity",
            "min_x": bk["x"] - bk["w"] / 2,
            "max_x": bk["x"] + bk["w"] / 2,
            "min_z": bk["z"] - bk["d"] / 2,
            "max_z": bk["z"] + bk["d"] / 2,
            "cx": bk["x"],
            "cz": bk["z"]
        })

    # 4. Entrance Monument / Stele
    # Monolithic Granite Plinth: 2.80m x 1.40m
    obstacles.append({
        "name": "Entrance Stele",
        "type": "monument",
        "type_cat": "amenity",
        "min_x": -5.0 - 1.40,
        "max_x": -5.0 + 1.40,
        "min_z": 18.5 - 0.70,
        "max_z": 18.5 + 0.70,
        "cx": -5.0,
        "cz": 18.5
    })

    # 5. Bus Stop Shelter Structure
    # Shelter glass & frame canopy: width = 7.80m, depth = 2.20m, centered at (12.0, 23.4)
    # Rear glass wall at Z = 22.45, side glass at X = 8.25 and 15.75
    obstacles.append({
        "name": "Bus Stop Shelter Structure",
        "type": "shelter",
        "type_cat": "structure",
        "min_x": 12.0 - 7.80 / 2,
        "max_x": 12.0 + 7.80 / 2,
        "min_z": 23.4 - 2.20 / 2,
        "max_z": 23.4 + 2.20 / 2,
        "cx": 12.0,
        "cz": 23.4
    })

    # 6. Building 1 South Facade
    obstacles.append({
        "name": "Building 1 South Facade (West Wing)",
        "type": "building_wall",
        "type_cat": "building",
        "min_x": -24.0,
        "max_x": 9.0,
        "min_z": -8.0,
        "max_z": 8.0,
        "cx": -7.5,
        "cz": 0.0
    })
    obstacles.append({
        "name": "Building 1 South Facade (East Wing)",
        "type": "building_wall",
        "type_cat": "building",
        "min_x": 12.0,
        "max_x": 24.0,
        "min_z": -8.0,
        "max_z": 8.0,
        "cx": 18.0,
        "cz": 0.0
    })

    # 7. Building 2 South Facade
    obstacles.append({
        "name": "Building 2 South Facade",
        "type": "building_wall",
        "type_cat": "building",
        "min_x": 16.5,
        "max_x": 72.0,
        "min_z": -16.6,
        "max_z": 3.5,
        "cx": 44.25,
        "cz": -6.55
    })

    # 8. Building 2 Botanical Lawn (Curb: X in [20.4..68.0], Z in [3.5..17.0])
    obstacles.append({
        "name": "Building 2 Botanical Lawn",
        "type": "lawn_curb",
        "type_cat": "landscaping",
        "min_x": 20.4,
        "max_x": 68.0,
        "min_z": 3.5,
        "max_z": 17.0,
        "cx": 44.2,
        "cz": 10.25
    })

    # 9. Promenade South Curb (Boundary at Z = 24.50)
    obstacles.append({
        "name": "Promenade South Curb / Road Boundary",
        "type": "curb_boundary",
        "type_cat": "boundary",
        "min_x": -24.0,
        "max_x": 72.0,
        "min_z": 24.50,
        "max_z": 30.00,
        "cx": 24.0,
        "cz": 27.25
    })

    return obstacles

# -----------------------------------------------------------------------------
# REALISTIC PEDESTRIAN CIRCULATION CORRIDORS
# -----------------------------------------------------------------------------
CIRCULATION_CORRIDORS = [
    {
        "id": "corridor_1_west_apron",
        "name": "Corridor 1: B1 Entrance -> Bus Stop Platform (West Apron Approach)",
        "p1": (10.5, 10.4),  # b1_f1_entrance_main porch
        "p2": (5.0, 21.6),   # Western wide boarding platform apron (west of shelter)
        "req_throat_m": 2.0,
        "description": "Direct student path from college main entrance to western bus stop boarding zone."
    },
    {
        "id": "corridor_2_east_apron",
        "name": "Corridor 2: B1 Entrance -> Bus Stop Platform (East Apron Approach)",
        "p1": (10.5, 10.4),  # b1_f1_entrance_main porch
        "p2": (18.5, 21.6),  # Eastern boarding platform apron (east of shelter)
        "req_throat_m": 2.0,
        "description": "Student path from college main entrance to eastern bus stop boarding zone."
    },
    {
        "id": "corridor_3_b2_walkway",
        "name": "Corridor 3: B1 Entrance -> Building 2 Approach Walkway",
        "p1": (10.5, 10.4),  # b1_f1_entrance_main porch
        "p2": (18.5, 10.4),  # Eastbound walkway passing south of B1 into B2 zone
        "req_throat_m": 2.0,
        "description": "Pedestrian artery between Building 1 entrance and Building 2 grounds."
    },
    {
        "id": "corridor_4_forecourt_promenade",
        "name": "Corridor 4: Forecourt Plaza 1 -> South Promenade Gateway",
        "p1": (0.0, 16.0),   # Forecourt central gathering plaza
        "p2": (22.0, 20.0),  # Promenade entrance threshold
        "req_throat_m": 2.0,
        "description": "Wide plaza transition into the southern pedestrian promenade."
    },
    {
        "id": "corridor_5_promenade_spine",
        "name": "Corridor 5: South Promenade Main Continuous Spine (West -> Mid)",
        "p1": (22.0, 21.0),  # Promenade west end
        "p2": (60.0, 21.0),  # Promenade center-east (in front of Benches 1-4)
        "req_throat_m": 2.0,
        "description": "Main 38-meter unobstructed pedestrian promenade artery south of benches."
    },
    {
        "id": "corridor_6_bike_bypass_south",
        "name": "Corridor 6: Promenade East End -> Bike Station South Bypass",
        "p1": (60.0, 22.8),  # South bypass entry
        "p2": (70.0, 22.8),  # South bypass exit near eastern bollards
        "req_throat_m": 2.0,
        "description": "Southern clear pedestrian passage around Secondary Bike Station (Z=21.0)."
    },
    {
        "id": "corridor_7_plaza_stele_bypass",
        "name": "Corridor 7: Western Forecourt -> Plaza Core (South of Stele)",
        "p1": (-15.0, 22.0), # Southwest forecourt
        "p2": (2.0, 22.0),   # South plaza core (completely south of Stele & Benches)
        "req_throat_m": 2.0,
        "description": "Southern plaza thoroughfare bypassing the commemorative entrance stele."
    }
]

# -----------------------------------------------------------------------------
# ADVERSARIAL VERIFICATION HARNESS
# -----------------------------------------------------------------------------
def evaluate_corridor_clearance(corridor, obstacles):
    """
    Evaluates physical obstacle collisions and calculates continuous throat clearance
    along the pedestrian corridor segment.
    """
    p1x, p1z = corridor["p1"]
    p2x, p2z = corridor["p2"]
    corridor_len = math.hypot(p2x - p1x, p2z - p1z)

    collisions = []
    min_dist_to_obstacle = float('inf')
    closest_obstacle = None

    # Step-by-step sweep along the corridor segment (every 0.20m)
    num_steps = max(10, int(corridor_len / 0.20))
    step_samples = []

    for s in range(num_steps + 1):
        t = s / num_steps
        sx = p1x + t * (p2x - p1x)
        sz = p1z + t * (p2z - p1z)
        
        # Check distance to all obstacles from this point
        pt_min_dist = float('inf')
        pt_closest = None
        for obs in obstacles:
            d = dist_point_to_box(sx, sz, obs["min_x"], obs["max_x"], obs["min_z"], obs["max_z"])
            if d < pt_min_dist:
                pt_min_dist = d
                pt_closest = obs
        step_samples.append({
            "t": t,
            "x": sx,
            "z": sz,
            "dist": pt_min_dist,
            "obstacle": pt_closest
        })
        if pt_min_dist < min_dist_to_obstacle:
            min_dist_to_obstacle = pt_min_dist
            closest_obstacle = pt_closest

    # Direct segment-box intersection test
    for obs in obstacles:
        if segment_intersects_box(p1x, p1z, p2x, p2z, obs["min_x"], obs["max_x"], obs["min_z"], obs["max_z"]):
            collisions.append(obs)

    # Effective throat clearance:
    # A pedestrian corridor centerline with minimum side clearance `min_dist`
    # provides a navigable throat width of at least `2 * min_dist`
    # (unobstructed clearance to the left and right).
    throat_clearance = min_dist_to_obstacle * 2.0

    return {
        "corridor_id": corridor["id"],
        "name": corridor["name"],
        "length_m": round(corridor_len, 2),
        "collisions": collisions,
        "collision_count": len(collisions),
        "min_dist_to_obstacle_m": round(min_dist_to_obstacle, 3),
        "effective_throat_m": round(throat_clearance, 3),
        "closest_obstacle": closest_obstacle["name"] if closest_obstacle else None,
        "passed": len(collisions) == 0 and throat_clearance >= corridor["req_throat_m"]
    }

def main():
    print("=" * 80)
    print("  EMPIRICAL CHALLENGER M4: PEDESTRIAN CIRCULATION & THROAT CLEARANCE")
    print("=" * 80)

    obstacles = get_territory_obstacles()
    amenity_count = sum(1 for o in obstacles if o["type_cat"] == "amenity")
    structure_count = sum(1 for o in obstacles if o["type_cat"] in ("structure", "building", "landscaping", "boundary"))
    print(f"[INIT] Loaded {len(obstacles)} territory physical boundaries ({amenity_count} M4 amenities, {structure_count} campus structures/facades/curbs).")

    # -------------------------------------------------------------------------
    # PART 1: NEGATIVE CONTROL / MUTATION SENSITIVITY TEST
    # -------------------------------------------------------------------------
    print("\n[PART 1] Running Negative Control Mutation Test (Proving Clearance Engine Sensitivity)...")
    
    # Inject a synthetic obstacle directly into Corridor 1 (blocking entrance throat)
    synth_blocker = {
        "name": "Synthetic Blocker in Entrance Throat",
        "type": "bench",
        "type_cat": "amenity",
        "min_x": 7.0,
        "max_x": 9.0,
        "min_z": 14.0,
        "max_z": 15.0,
        "cx": 8.0,
        "cz": 14.5
    }
    mutated_obstacles = copy.deepcopy(obstacles) + [synth_blocker]
    
    mutated_eval = evaluate_corridor_clearance(CIRCULATION_CORRIDORS[0], mutated_obstacles)
    print(f"  * Injected blocker at ({synth_blocker['cx']}, {synth_blocker['cz']}) into Corridor 1")
    print(f"  * Detected collisions: {mutated_eval['collision_count']}, Closest: {mutated_eval['closest_obstacle']}")
    print(f"  * Clearance Engine Result: Passed={mutated_eval['passed']}")
    assert not mutated_eval["passed"], "[MUTATION FAIL] Clearance engine failed to catch synthetic corridor obstruction!"
    assert mutated_eval["collision_count"] > 0, "[MUTATION FAIL] Direct collision was not flagged!"
    print("  [PASS] Negative control mutation confirmed: clearance verification engine has 100% sensitivity!")

    # -------------------------------------------------------------------------
    # PART 2: EVALUATION OF ALL 7 PRIMARY PEDESTRIAN CORRIDORS
    # -------------------------------------------------------------------------
    print("\n[PART 2] Evaluating Baseline Pedestrian Circulation Corridors & Throat Clearance...")
    all_corridors_passed = True
    corridor_evaluations = []

    for c in CIRCULATION_CORRIDORS:
        res = evaluate_corridor_clearance(c, obstacles)
        corridor_evaluations.append(res)
        status = "PASS" if res["passed"] else "FAIL"
        if not res["passed"]:
            all_corridors_passed = False

        print(f"\n  * {res['name']}:")
        print(f"    - Trajectory Length       : {res['length_m']} m")
        print(f"    - Direct Obstacle Impacts : {res['collision_count']}")
        print(f"    - Min Centerline Clearance: {res['min_dist_to_obstacle_m']} m (Nearest: '{res['closest_obstacle']}')")
        print(f"    - Effective Throat Width  : {res['effective_throat_m']} m (Requirement: >= {c['req_throat_m']} m)")
        print(f"    - Verdict                 : [{status}]")

    # -------------------------------------------------------------------------
    # PART 3: ARCHITECTURAL CHOKE POINT & BOTTLENECK ANALYSIS
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("[PART 3] ARCHITECTURAL BOTTLENECK & CHOKE POINT QUANTITATIVE AUDIT")
    print("=" * 80)

    # 1. B1 Entrance Throat (Distance from Main Entrance Node to Nearest Amenity)
    b1_ent_x, b1_ent_z = 10.5, 10.4
    amenity_distances = []
    for obs in obstacles:
        if obs["type_cat"] == "amenity":
            d = dist_point_to_box(b1_ent_x, b1_ent_z, obs["min_x"], obs["max_x"], obs["min_z"], obs["max_z"])
            amenity_distances.append((d, obs["name"]))
    amenity_distances.sort(key=lambda x: x[0])
    nearest_amenity_dist, nearest_amenity_name = amenity_distances[0]
    print(f"  * Choke Point 1: College Main Entrance Throat at ({b1_ent_x}, {b1_ent_z}):")
    print(f"    - Nearest amenity           : '{nearest_amenity_name}' at {nearest_amenity_dist:.2f} m")
    print(f"    - Requirement               : >= 2.00 m")
    print(f"    - Margin above requirement  : +{nearest_amenity_dist - 2.00:.2f} m (+{(nearest_amenity_dist/2.0 - 1)*100:.1f}%) [PASS]")
    assert nearest_amenity_dist >= 2.0

    # 2. B1 to B2 Pedestrian Walkway Throat (Between B1 South Wall and Descent Bin)
    # B1 wall at Z=8.0; Descent Bin at X=16.8, Z=13.5 (radius 0.21)
    b1_b2_throat = (13.5 - 0.21) - 8.0
    print(f"\n  * Choke Point 2: B1 -> B2 Outdoor Walkway Throat (between B1 South Wall and Descent Bin):")
    print(f"    - Clear Walkway Width       : {b1_b2_throat:.2f} m")
    print(f"    - Requirement               : >= 2.00 m")
    print(f"    - Margin above requirement  : +{b1_b2_throat - 2.00:.2f} m (+{(b1_b2_throat/2.0 - 1)*100:.1f}%) [PASS]")
    assert b1_b2_throat >= 2.0

    # 3. South Promenade Continuous Spine (Between Benches South Envelope and South Curb)
    # Benches south envelope: Z = 18.15m; South curb: Z = 24.50m
    promenade_clear_spine = 24.50 - 18.15
    print(f"\n  * Choke Point 3: South Promenade Continuous Pedestrian Spine (X: [20.4..64.0]):")
    print(f"    - Total Promenade Width     : 7.50 m (Z: [17.00..24.50])")
    print(f"    - Amenity Linear Envelope   : Z: [17.45..18.15] m (4 benches + 4 bins)")
    print(f"    - Continuous Unobstructed Spine: {promenade_clear_spine:.2f} m")
    print(f"    - Requirement               : >= 2.00 m")
    print(f"    - Margin above requirement  : +{promenade_clear_spine - 2.00:.2f} m (+{(promenade_clear_spine/2.0 - 1)*100:.1f}%) [PASS]")
    assert promenade_clear_spine >= 2.0

    # 4. Secondary Bike Station East Bypass Chutes (At X = 66.0, Z = 21.0)
    # Bike station envelope: X: [64.25..67.75], Z: [20.50..21.50]
    bike_south_chute = 24.50 - 21.50  # 3.00 m
    bike_north_chute = 20.50 - 18.15  # 2.35 m
    print(f"\n  * Choke Point 4: Secondary Bike Station East Bypass (X = 66.0, Z: [20.50..21.50]):")
    print(f"    - South Bypass Chute Width  : {bike_south_chute:.2f} m (Requirement: >= 2.00 m) [PASS]")
    print(f"    - North Bypass Chute Width  : {bike_north_chute:.2f} m (Requirement: >= 2.00 m) [PASS]")
    assert bike_south_chute >= 2.0
    assert bike_north_chute >= 2.0

    # 5. Forecourt Seating Enclave to Entrance Stele Throat
    # Forecourt Bin 1 max_x = -10.2 + 0.21 = -9.99; Stele min_x = -5.0 - 1.40 = -6.40
    stele_plaza_throat = (-6.40) - (-9.99)
    print(f"\n  * Choke Point 5: Forecourt Seating Enclave to Stele Pedestrian Throat:")
    print(f"    - Clear Passage Width       : {stele_plaza_throat:.2f} m")
    print(f"    - Requirement               : >= 2.00 m")
    print(f"    - Margin above requirement  : +{stele_plaza_throat - 2.00:.2f} m (+{(stele_plaza_throat/2.0 - 1)*100:.1f}%) [PASS]")
    assert stele_plaza_throat >= 2.0

    # -------------------------------------------------------------------------
    # PART 4: SUMMARY & GATES
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("  PEDESTRIAN CIRCULATION VERIFICATION SCORECARD")
    print("=" * 80)
    print(f"{'Corridor':<55} | {'Collisions':<10} | {'Throat (m)':<10} | {'Status'}")
    print("-" * 80)
    for r in corridor_evaluations:
        status_str = "PASS" if r["passed"] else "FAIL"
        print(f"{r['name'][:55]:<55} | {r['collision_count']:<10} | {r['effective_throat_m']:<10.2f} | {status_str}")
    print("=" * 80)

    assert all_corridors_passed, "One or more pedestrian circulation corridors failed throat clearance!"
    print("\n  ALL 7 PEDESTRIAN CORRIDORS SATISFY 0 COLLISIONS & >= 2.0m THROAT CLEARANCE 100% EMPIRICALLY!")
    return 0

if __name__ == '__main__':
    sys.exit(main())
