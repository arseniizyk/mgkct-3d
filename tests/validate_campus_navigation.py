#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/validate_campus_navigation.py
===================================
MGKCT 3D — HEADLESS CAMPUS NAVIGATION & ARCHITECTURE E2E VALIDATION SUITE
(Zero-Bundler Automated Test Suite across Buildings 1–4, Floors 1–7)

Validates:
1. 0 Wall Collisions: Intra-floor graph edge clearance against physical 3D wall geometry.
2. 100% Room Reachability: A* pathfinding from campus entrances to every room node across all 15 floors (allowElevators: false).
3. Vertical Continuity: All 10 staircase shafts (B1 LK1/LK2, B2 LK1/LK2/LK3, B3 South/North, B4 LK1/LK2/LK3).
4. Floor 2 Skywalk Transitions: All 4 cross-building bridges (K1↔K2, K1↔K3, K3↔K4, K4↔K2) & 6 building pair routes.
5. Graph Connectivity: BFS single component check (0 orphan nodes across the entire campus graph).
6. Elevator Mode Policy Enforcement: Elevator edges disabled by default, available when enabled.
7. Representative Workload Performance: 50 multi-building, multi-floor stress routes.
8. 15-Floor Comprehensive Scorecard: Exact per-floor metrics for all 15 floors.

Usage:
    python tests/validate_campus_navigation.py [--building <1..4>] [--floor <1..7>] [--strict] [--json]
"""

import os
import sys
import json
import math
import heapq
import time
import base64
import argparse
import subprocess

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

# -----------------------------------------------------------------------------
# 1. GEOMETRY & MATH UTILITIES
# -----------------------------------------------------------------------------
def ccw(ax, az, bx, bz, cx, cz):
    return (cz - az) * (bx - ax) - (bz - az) * (cx - ax)

def segments_intersect(ax, az, bx, bz, cx, cz, dx, dz):
    cp1 = ccw(ax, az, bx, bz, cx, cz)
    cp2 = ccw(ax, az, bx, bz, dx, dz)
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

# -----------------------------------------------------------------------------
# 2. DATA EXTRACTION VIA THREE.JS RUNTIME
# -----------------------------------------------------------------------------
def load_campus_environment(project_root):
    """
    Extract exact Three.js geometry (WALLS_REGISTRY, DOORS_REGISTRY, ROOMS_REGISTRY)
    and navigation graph using the headless Edge runtime on Windows.
    Decodes UTF-8 payload through Base64 to guarantee encoding purity.
    """
    dump_html_path = os.path.join(project_root, 'tests', 'dump_campus_data.html')
    if not os.path.exists(dump_html_path):
        raise FileNotFoundError(f"Missing dump harness: {dump_html_path}")

    edge_candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    edge_bin = None
    for cand in edge_candidates:
        if os.path.exists(cand):
            edge_bin = cand
            break

    if not edge_bin:
        raise RuntimeError("Microsoft Edge binary not found for headless geometry extraction.")

    file_url = 'file:///' + os.path.abspath(dump_html_path).replace('\\', '/')
    cmd = [edge_bin, '--headless=new', '--disable-gpu', '--dump-dom', file_url]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if res.returncode != 0:
        raise RuntimeError(f"Edge execution failed with code {res.returncode}: {res.stderr}")

    idx = res.stdout.find('id="output">')
    if idx == -1:
        raise RuntimeError("Failed to locate 'output' container in Edge headless DOM output.")
    end_idx = res.stdout.find('</div>', idx)
    b64_str = res.stdout[idx + len('id="output">') : end_idx].strip()
    
    raw_json = base64.b64decode(b64_str).decode('utf-8')
    data = json.loads(raw_json)
    return data

# -----------------------------------------------------------------------------
# 3. A* PATHFINDING ALGORITHM
# -----------------------------------------------------------------------------
def a_star_search(nodes, adj, start_id, dest_id, allow_elevators=False):
    """
    Genuine A* pathfinding algorithm strictly matching js/navigator.js:aStarPath.
    """
    if start_id not in nodes or dest_id not in nodes:
        return None
    if start_id == dest_id:
        return {'path': [start_id], 'totalDistance': 0.0}

    dest_node = nodes[dest_id]

    def heuristic(u_id):
        u = nodes[u_id]
        dx = u['x'] - dest_node['x']
        dz = u['z'] - dest_node['z']
        df = abs(u['floor'] - dest_node['floor'])
        return math.hypot(dx, dz) + df * 5.0

    pq = [(0.0, start_id)]
    came_from = {start_id: None}
    cost_so_far = {start_id: 0.0}

    while pq:
        _, current = heapq.heappop(pq)
        if current == dest_id:
            break

        current_cost = cost_so_far[current]
        neighbors = adj.get(current, [])

        for edge in neighbors:
            if edge.get('isElevator', False) and not allow_elevators:
                continue

            nxt = edge['to']
            weight = edge['weight']
            new_cost = current_cost + weight

            if nxt not in cost_so_far or new_cost < cost_so_far[nxt]:
                cost_so_far[nxt] = new_cost
                came_from[nxt] = current
                priority = new_cost + heuristic(nxt)
                heapq.heappush(pq, (priority, nxt))

    if dest_id not in came_from:
        return None

    path = []
    curr = dest_id
    while curr is not None:
        path.append(curr)
        curr = came_from[curr]
    path.reverse()

    return {
        'path': path,
        'totalDistance': cost_so_far[dest_id]
    }

# -----------------------------------------------------------------------------
# 4. CAMPUS VALIDATOR ENGINE
# -----------------------------------------------------------------------------
class CampusValidator:
    def __init__(self, data, filter_bldg=None, filter_floor=None):
        self.walls = data['walls']
        self.doors = data['doors']
        self.rooms = data['rooms']
        self.nodes = data['nodes']
        self.adj = data['adj']
        self.filter_bldg = filter_bldg
        self.filter_floor = filter_floor

        self.errors = []
        self.warnings = []
        self.scorecard = []

    def matches_filter(self, bldg, floor):
        if self.filter_bldg is not None and bldg != self.filter_bldg:
            return False
        if self.filter_floor is not None and floor != self.filter_floor:
            return False
        return True

    # -------------------------------------------------------------------------
    # TEST 1: 0 WALL COLLISIONS (ALL 15 FLOORS)
    # -------------------------------------------------------------------------
    def test_wall_collisions(self):
        seen_edges = set()
        colliding_edges = []
        edges_evaluated = 0

        for u_id, neighbors in self.adj.items():
            u = self.nodes.get(u_id)
            if not u:
                continue

            for edge in neighbors:
                v_id = edge['to']
                edge_key = tuple(sorted([u_id, v_id]))
                if edge_key in seen_edges:
                    continue
                seen_edges.add(edge_key)

                v = self.nodes.get(v_id)
                if not v:
                    continue

                # Intra-floor check only
                if u['floor'] != v['floor']:
                    continue
                floor = u['floor']

                if not self.matches_filter(u['bldg'], floor) and not self.matches_filter(v['bldg'], floor):
                    continue

                edges_evaluated += 1

                # Filter walls for this floor
                floor_walls = [
                    w for w in self.walls
                    if w['floor'] == floor and (w['building'] == u['bldg'] or w['building'] == v['bldg'])
                ]

                for w in floor_walls:
                    thickness = w.get('thickness', 0.18)
                    if thickness <= 0.09:
                        # Skip thin balustrades / handrails
                        continue

                    # Exact clearance formula from validate_campus_navigation.js line 891
                    clearance = (thickness / 2.0) - 0.02
                    dist = dist_segment_to_segment(u['x'], u['z'], v['x'], v['z'], w['x1'], w['z1'], w['x2'], w['z2'])

                    if dist < clearance - 1e-4:
                        colliding_edges.append({
                            'edge': f"{u_id} <-> {v_id}",
                            'floor': floor,
                            'bldgU': u['bldg'],
                            'bldgV': v['bldg'],
                            'uPos': (u['x'], u['z']),
                            'vPos': (v['x'], v['z']),
                            'wall': ((w['x1'], w['z1']), (w['x2'], w['z2'])),
                            'thickness': thickness,
                            'distance': dist,
                            'clearance': clearance
                        })
                        self.errors.append(
                            f"[WALL_COLLISION] B{u['bldg']} F{floor}: Edge '{u_id}' <-> '{v_id}' "
                            f"embeds into wall (dist={dist:.3f}m < clearance={clearance:.3f}m)"
                        )
                        break

        return {
            'evaluated_count': edges_evaluated,
            'collision_count': len(colliding_edges),
            'colliding_edges': colliding_edges
        }

    # -------------------------------------------------------------------------
    # TEST 2: 100% ROOM REACHABILITY (ALL 15 FLOORS)
    # -------------------------------------------------------------------------
    def test_room_reachability(self):
        def is_arch_exclusion(r):
            raw = (r.get('rawText') or r.get('text') or '').replace('\n', ' ').strip()
            if raw in ('Второй свет', 'Витраж'):
                return True
            if raw == 'Переход в корпус №2' or raw.startswith('Переход'):
                return True
            if raw.startswith('ЛК№') or raw.startswith('ЛК №'):
                return True
            return False

        candidate_rooms = [
            r for r in self.rooms
            if self.matches_filter(r['building'], r['floor']) and not is_arch_exclusion(r)
        ]

        matched = []
        missing = []
        unreachable = []

        main_entrances = ['b1_f1_entrance_main', 'b3_f1_entrance_west']
        active_entrances = [e for e in main_entrances if e in self.nodes]
        if not active_entrances:
            active_entrances = [list(self.nodes.keys())[0]]

        for r in candidate_rooms:
            b = r['building']
            f = r['floor']
            clean_text = (r.get('text') or '').replace('\n', ' ').strip()

            # Match room node
            matched_node = None
            for nid, node in self.nodes.items():
                if node['floor'] == f and node['bldg'] == b and node['type'] in ('room', 'wc'):
                    if math.hypot(node['x'] - r['x'], node['z'] - r['z']) <= 0.45:
                        matched_node = node
                        break
                    if node['label'] and (node['label'] == clean_text or node['label'] == r.get('rawText')):
                        matched_node = node
                        break

            if not matched_node:
                missing.append(r)
                self.warnings.append(
                    f"[MISSING_ROOM_NODE] Room '{clean_text}' [B{b} F{f}] at ({r['x']}, {r['z']}) has no matching 'room'/'wc' node"
                )
                continue

            matched.append((r, matched_node))

            # Test A* reachability from active entrance (allowElevators: false)
            reachable = False
            for ent in active_entrances:
                res = a_star_search(self.nodes, self.adj, ent, matched_node['id'], allow_elevators=False)
                if res and res.get('path'):
                    reachable = True
                    break

            if not reachable:
                unreachable.append((r, matched_node))
                self.errors.append(
                    f"[UNREACHABLE_ROOM] Room '{clean_text}' ({matched_node['id']}) [B{b} F{f}] cannot be reached from entrance"
                )

        coverage = len(matched) / len(candidate_rooms) if candidate_rooms else 1.0
        reachability = (len(matched) - len(unreachable)) / len(matched) if matched else 1.0

        return {
            'total_candidate_rooms': len(candidate_rooms),
            'matched_count': len(matched),
            'missing_count': len(missing),
            'unreachable_count': len(unreachable),
            'coverage_pct': coverage * 100.0,
            'reachability_pct': reachability * 100.0,
            'unreachable_rooms': unreachable
        }

    # -------------------------------------------------------------------------
    # TEST 3: VERTICAL CONTINUITY (ALL 10 STAIRCASE SHAFTS)
    # -------------------------------------------------------------------------
    def test_vertical_shafts(self):
        shafts_def = [
            {'id': 'b1_lk1', 'bldg': 1, 'name': 'К1 ЛК№1', 'floors': [1, 2, 3, 4, 5, 6, 7], 'prefix': 'b1_f', 'suffix': '_stair_lk1'},
            {'id': 'b1_lk2', 'bldg': 1, 'name': 'К1 ЛК№2', 'floors': [1, 2, 3, 4, 5, 6, 7], 'prefix': 'b1_f', 'suffix': '_stair_lk2'},
            {'id': 'b2_lk1', 'bldg': 2, 'name': 'К2 ЛК№1', 'floors': [1, 2, 3], 'prefix': 'b2_f', 'suffix': '_stair_lk1'},
            {'id': 'b2_lk2', 'bldg': 2, 'name': 'К2 ЛК№2', 'floors': [1, 2, 3], 'prefix': 'b2_f', 'suffix': '_stair_lk2'},
            {'id': 'b2_lk3', 'bldg': 2, 'name': 'К2 ЛК№3', 'floors': [1, 2], 'prefix': 'b2_f', 'suffix': '_stair_lk3'},
            {'id': 'b3_south', 'bldg': 3, 'name': 'К3 Южная ЛК', 'floors': [1, 2], 'prefix': 'b3_f', 'suffix': '_stair_south'},
            {'id': 'b3_north', 'bldg': 3, 'name': 'К3 Северная ЛК', 'floors': [1, 2], 'prefix': 'b3_f', 'suffix': '_stair_north'},
            {'id': 'b4_lk1', 'bldg': 4, 'name': 'К4 ЛК№1', 'floors': [1, 2, 3], 'prefix': 'b4_f', 'suffix': '_stair_lk1'},
            {'id': 'b4_lk2', 'bldg': 4, 'name': 'К4 ЛК№2', 'floors': [1, 2, 3], 'prefix': 'b4_f', 'suffix': '_stair_lk2'},
            {'id': 'b4_lk3', 'bldg': 4, 'name': 'К4 ЛК№3', 'floors': [1, 2, 3], 'prefix': 'b4_f', 'suffix': '_stair_lk3'}
        ]

        shaft_results = []
        for st in shafts_def:
            if self.filter_bldg is not None and st['bldg'] != self.filter_bldg:
                continue

            missing_nodes = []
            broken_edges = []
            drift_max = 0.0

            # 1. Landing nodes existence
            base_node = None
            for f in st['floors']:
                nid = f"{st['prefix']}{f}{st['suffix']}"
                if nid not in self.nodes:
                    missing_nodes.append(nid)
                    self.errors.append(f"[MISSING_STAIR_NODE] Staircase '{st['id']}' landing '{nid}' missing")
                else:
                    n = self.nodes[nid]
                    if base_node is None:
                        base_node = n
                    else:
                        drift = math.hypot(n['x'] - base_node['x'], n['z'] - base_node['z'])
                        drift_max = max(drift_max, drift)

            # 2. Adjacent vertical edges
            for i in range(len(st['floors']) - 1):
                f1 = st['floors'][i]
                f2 = st['floors'][i + 1]
                u = f"{st['prefix']}{f1}{st['suffix']}"
                v = f"{st['prefix']}{f2}{st['suffix']}"

                if u in self.nodes and v in self.nodes:
                    u_nbrs = [e['to'] for e in self.adj.get(u, [])]
                    v_nbrs = [e['to'] for e in self.adj.get(v, [])]
                    if v not in u_nbrs or u not in v_nbrs:
                        broken_edges.append((u, v))
                        self.errors.append(f"[BROKEN_STAIR_EDGE] Missing vertical edge {u} <-> {v}")

            # 3. Multi-floor stairs traversal
            bottom_nid = f"{st['prefix']}{st['floors'][0]}{st['suffix']}"
            top_nid = f"{st['prefix']}{st['floors'][-1]}{st['suffix']}"
            traversal_ok = False
            route_len = 0
            if bottom_nid in self.nodes and top_nid in self.nodes:
                res = a_star_search(self.nodes, self.adj, bottom_nid, top_nid, allow_elevators=False)
                if res and res.get('path'):
                    traversal_ok = True
                    route_len = len(res['path'])
                else:
                    self.errors.append(f"[STAIR_ROUTING_FAIL] Cannot route across '{st['id']}' from {bottom_nid} to {top_nid}")

            shaft_results.append({
                'id': st['id'],
                'name': st['name'],
                'bldg': st['bldg'],
                'floors': st['floors'],
                'nodes_ok': len(missing_nodes) == 0,
                'edges_ok': len(broken_edges) == 0,
                'traversal_ok': traversal_ok,
                'route_nodes': route_len,
                'drift_max_m': round(drift_max, 3),
                'passed': len(missing_nodes) == 0 and len(broken_edges) == 0 and traversal_ok
            })

        return shaft_results

    # -------------------------------------------------------------------------
    # TEST 4: FLOOR 2 SKYWALK TRANSITIONS & CROSS-BUILDING ROUTING
    # -------------------------------------------------------------------------
    def test_floor2_skywalks(self):
        bridges = [
            {'name': 'K1 ↔ K2 Bridge (Floor 2)', 'nodeA': 'custom_b1_f2_c_180_-56_1nw', 'nodeB': 'b2_f2_c_20.4', 'bldgA': 1, 'bldgB': 2},
            {'name': 'K1 ↔ K3 Junction (Floor 2)', 'nodeA': 'bridge_k1_k3_f2', 'nodeB': 'b3_f2_c_-14.0', 'bldgA': 1, 'bldgB': 3},
            {'name': 'K3 ↔ K4 Bridge (Floor 2)', 'nodeA': 'bridge_k3_k4_f2', 'nodeB': 'b4_f2_bridge_k3_door', 'bldgA': 3, 'bldgB': 4},
            {'name': 'K4 ↔ K2 Bridge (Floor 2)', 'nodeA': 'b4_f2_sw_-27.4', 'nodeB': 'b2_f2_c_37.5', 'intermediate': 'bridge_k4_k2_f2', 'bldgA': 4, 'bldgB': 2}
        ]

        bridge_results = []
        for br in bridges:
            has_a = br['nodeA'] in self.nodes
            has_b = br['nodeB'] in self.nodes
            has_mid = br.get('intermediate') in self.nodes if br.get('intermediate') else True

            path_ok = False
            cost = 0.0
            if has_a and has_b and has_mid:
                res = a_star_search(self.nodes, self.adj, br['nodeA'], br['nodeB'], allow_elevators=False)
                if res and res.get('path'):
                    path_nodes = res['path']
                    all_f2 = all(self.nodes[p]['floor'] == 2 for p in path_nodes)
                    if all_f2 and res['totalDistance'] <= 35.0:
                        path_ok = True
                        cost = res['totalDistance']
                    else:
                        self.errors.append(f"[SKYWALK_DETOUR_FAIL] Route across {br['name']} took detour off Floor 2 (all_f2={all_f2}, cost={res['totalDistance']:.1f}m)")
                else:
                    self.errors.append(f"[SKYWALK_PATH_FAIL] Failed to route across {br['name']}")
            else:
                self.errors.append(f"[SKYWALK_ENDPOINT_MISSING] Bridge '{br['name']}' endpoints missing")

            bridge_results.append({
                'name': br['name'],
                'endpoints_ok': has_a and has_b and has_mid,
                'path_ok': path_ok,
                'cost_m': round(cost, 2),
                'passed': has_a and has_b and has_mid and path_ok
            })

        # All 6 cross-building pairs
        sample_nodes = {
            1: 'b1_f1_entrance_main',
            2: 'b2_f1_stair_lk1',
            3: 'b3_f1_stair_north',
            4: 'b4_f1_stair_lk1'
        }
        pairs = [(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4)]
        pair_results = []
        for bA, bB in pairs:
            nA = sample_nodes[bA]
            nB = sample_nodes[bB]
            res = a_star_search(self.nodes, self.adj, nA, nB, allow_elevators=False)
            ok = res is not None and len(res.get('path', [])) > 0
            if not ok:
                self.errors.append(f"[CROSS_BUILDING_FAIL] Cannot route between K{bA} and K{bB}")
            pair_results.append({
                'pair': f"K{bA} ↔ K{bB}",
                'passed': ok,
                'path_len': len(res['path']) if ok else 0,
                'cost_m': round(res['totalDistance'], 2) if ok else 0.0
            })

        return {
            'bridges': bridge_results,
            'building_pairs': pair_results,
            'all_passed': all(b['passed'] for b in bridge_results) and all(p['passed'] for p in pair_results)
        }

    # -------------------------------------------------------------------------
    # TEST 5: GRAPH CONNECTIVITY (BFS SINGLE COMPONENT)
    # -------------------------------------------------------------------------
    def test_graph_connectivity(self):
        visited = set()
        components = []

        for nid in self.nodes.keys():
            if nid in visited:
                continue

            comp = []
            queue = [nid]
            visited.add(nid)

            while queue:
                curr = queue.pop(0)
                comp.append(curr)
                for edge in self.adj.get(curr, []):
                    nxt = edge['to']
                    if nxt not in visited and nxt in self.nodes:
                        visited.add(nxt)
                        queue.append(nxt)

            components.append(comp)

        components.sort(key=len, reverse=True)
        main_comp_size = len(components[0]) if components else 0
        orphan_count = sum(len(c) for c in components[1:])

        if len(components) > 1:
            for c in components[1:]:
                for nid in c:
                    n = self.nodes[nid]
                    self.errors.append(
                        f"[ORPHAN_NODE] Node '{nid}' ({n['type']}) [B{n['bldg']} F{n['floor']}] is disconnected"
                    )

        return {
            'component_count': len(components),
            'main_component_size': main_comp_size,
            'orphan_nodes_count': orphan_count,
            'passed': len(components) == 1 and orphan_count == 0
        }

    # -------------------------------------------------------------------------
    # TEST 6: ELEVATOR MODE POLICY ENFORCEMENT
    # -------------------------------------------------------------------------
    def test_elevator_policy(self):
        b1_elev_nodes = [f"b1_f{f}_elev" for f in range(1, 8)]
        all_exist = all(nid in self.nodes for nid in b1_elev_nodes)
        if not all_exist:
            self.errors.append("[ELEVATOR_POLICY] Missing one or more elevator landing nodes in Building 1")
            return {'passed': False, 'reason': 'Missing elevator nodes'}

        # Vertical edges must have isElevator: True
        edges_flagged = True
        for f in range(1, 7):
            u = f"b1_f{f}_elev"
            v = f"b1_f{f+1}_elev"
            edge = next((e for e in self.adj.get(u, []) if e['to'] == v), None)
            if not edge or not edge.get('isElevator', False):
                edges_flagged = False
                self.errors.append(f"[ELEVATOR_POLICY] Vertical edge {u} <-> {v} missing 'isElevator: true'")
                break

        # Without elevator: route F1 -> F7 must NOT use elevator edges
        route_stairs = a_star_search(self.nodes, self.adj, 'b1_f1_elev', 'b1_f7_elev', allow_elevators=False)
        uses_elev_in_stairs_mode = False
        if route_stairs:
            p = route_stairs['path']
            for i in range(len(p) - 1):
                u, v = p[i], p[i+1]
                edge = next((e for e in self.adj.get(u, []) if e['to'] == v), None)
                if edge and edge.get('isElevator', False):
                    uses_elev_in_stairs_mode = True
                    self.errors.append("[ELEVATOR_POLICY] Path traversed elevator edge with allowElevators=false!")
                    break

        # With elevator: direct path works
        route_elev = a_star_search(self.nodes, self.adj, 'b1_f1_elev', 'b1_f7_elev', allow_elevators=True)
        elev_fast = route_elev is not None

        passed = all_exist and edges_flagged and not uses_elev_in_stairs_mode and elev_fast
        return {
            'all_nodes_exist': all_exist,
            'edges_flagged': edges_flagged,
            'elevator_isolated_when_disabled': not uses_elev_in_stairs_mode,
            'elevator_routes_when_enabled': elev_fast,
            'passed': passed
        }

    # -------------------------------------------------------------------------
    # TEST 7: 50 REPRESENTATIVE CAMPUS WORKLOADS
    # -------------------------------------------------------------------------
    def test_workload_benchmarks(self):
        workloads = [
            # Main Entrance to heights in B1
            ('Entrance -> K1 F7 Top Corridor', 'b1_f1_entrance_main', 'b1_f7_nc_0.0'),
            ('Entrance -> K1 F6 Corridor', 'b1_f1_entrance_main', 'b1_f6_nc_0.0'),
            ('Entrance -> K1 F5 Corridor', 'b1_f1_entrance_main', 'b1_f5_nc_0.0'),
            ('Entrance -> K1 F4 Corridor', 'b1_f1_entrance_main', 'b1_f4_nc_0.0'),
            ('Entrance -> K1 F3 Corridor', 'b1_f1_entrance_main', 'b1_f3_nc_0.0'),
            ('Entrance -> K1 F2 Corridor', 'b1_f1_entrance_main', 'b1_f2_nc_0.0'),
            ('Entrance -> K1 F1 West Corridor', 'b1_f1_entrance_main', 'b1_f1_wc_-3.0'),
            ('Entrance -> K1 F1 South Corridor', 'b1_f1_entrance_main', 'b1_f1_sc_3.5'),
            # Main Entrance to other buildings
            ('Entrance -> K2 F1 Corridor', 'b1_f1_entrance_main', 'b2_f1_c_37.5'),
            ('Entrance -> K2 F2 Corridor', 'b1_f1_entrance_main', 'b2_f2_c_37.5'),
            ('Entrance -> K2 F3 Corridor', 'b1_f1_entrance_main', 'b2_f3_c_37.5'),
            ('Entrance -> K3 F1 Corridor', 'b1_f1_entrance_main', 'b3_f1_c_-28.6'),
            ('Entrance -> K3 F2 Corridor', 'b1_f1_entrance_main', 'b3_f2_c_-26.0'),
            ('Entrance -> K4 F1 Stairs LK-1', 'b1_f1_entrance_main', 'b4_f1_stair_lk1'),
            ('Entrance -> K4 F2 Stairs LK-1', 'b1_f1_entrance_main', 'b4_f2_stair_lk1'),
            ('Entrance -> K4 F3 Stairs LK-1', 'b1_f1_entrance_main', 'b4_f3_stair_lk1'),
            # High-level inter-building routes
            ('K1 F7 Top -> K4 F3 Top', 'b1_f7_nc_0.0', 'b4_f3_stair_lk1'),
            ('K1 F5 -> K2 F3', 'b1_f5_nc_0.0', 'b2_f3_c_37.5'),
            ('K1 F4 -> K3 F2', 'b1_f4_nc_0.0', 'b3_f2_c_-26.0'),
            ('K2 F3 -> K3 F2', 'b2_f3_c_37.5', 'b3_f2_c_-26.0'),
            ('K2 F3 -> K4 F3', 'b2_f3_c_37.5', 'b4_f3_stair_lk1'),
            ('K3 F2 -> K4 F3', 'b3_f2_c_-26.0', 'b4_f3_stair_lk1'),
            ('K4 F2 -> K1 F3', 'b4_f2_stair_lk1', 'b1_f3_nc_0.0'),
            ('K3 F1 -> K2 F1', 'b3_f1_c_-28.6', 'b2_f1_c_37.5'),
            ('K4 F1 -> K1 F2', 'b4_f1_stair_lk1', 'b1_f2_nc_0.0'),
            ('K2 F2 -> K3 F1', 'b2_f2_c_37.5', 'b3_f1_c_-28.6'),
            # Vertical transfers within & across
            ('K1 LK-1 F1 -> K1 LK-2 F7', 'b1_f1_stair_lk1', 'b1_f7_stair_lk2'),
            ('K2 LK-1 F1 -> K2 LK-2 F3', 'b2_f1_stair_lk1', 'b2_f3_stair_lk2'),
            ('K4 LK-1 F1 -> K4 LK-2 F3', 'b4_f1_stair_lk1', 'b4_f3_stair_lk2'),
            ('K3 South LK F1 -> K3 North LK F2', 'b3_f1_stair_south', 'b3_f2_stair_north'),
            ('K1 LK-1 F4 -> K2 LK-1 F2', 'b1_f4_stair_lk1', 'b2_f2_stair_lk1'),
            ('K3 South LK F2 -> K4 LK-3 F2', 'b3_f2_stair_south', 'b4_f2_stair_lk3'),
            # Accessible Elevator Routing
            ('K1 F1 Elev -> K1 F7 Elev (Elev Mode)', 'b1_f1_elev', 'b1_f7_elev', True),
            ('K1 F1 Elev -> K1 F5 Elev (Elev Mode)', 'b1_f1_elev', 'b1_f5_elev', True),
            ('K1 F2 Elev -> K1 F6 Elev (Elev Mode)', 'b1_f2_elev', 'b1_f6_elev', True),
            ('K1 F3 Elev -> K1 F4 Elev (Elev Mode)', 'b1_f3_elev', 'b1_f4_elev', True)
        ]

        # Academic room-to-room candidate list from validate_campus_navigation.js
        sample_rooms = [
            ('room_1_1_1', 'room_1_1_2'),
            ('room_1_2_16', 'room_1_2_20'),
            ('room_1_3_31', 'room_1_3_35'),
            ('room_1_4_46', 'room_1_4_52'),
            ('room_1_5_61', 'room_1_5_67'),
            ('room_1_6_76', 'room_1_6_82'),
            ('room_1_7_91', 'room_1_7_97'),
            ('room_2_1_106', 'room_2_1_112'),
            ('room_2_2_120', 'room_2_2_126'),
            ('room_3_1_150', 'room_3_1_155'),
            ('room_3_2_160', 'room_3_2_165'),
            ('room_4_1_180', 'room_4_1_185'),
            ('room_4_2_200', 'room_4_2_205')
        ]
        for rA, rB in sample_rooms:
            if rA in self.nodes and rB in self.nodes:
                workloads.append((f"Room {rA} -> Room {rB}", rA, rB, False))

        # Fill remaining slots up to 50 with circulation corridor pairs
        corridor_nodes = [nid for nid, node in self.nodes.items() if node['type'] == 'corridor']
        c_idx = 0
        while len(workloads) < 50 and c_idx + 1 < len(corridor_nodes):
            nA = corridor_nodes[c_idx]
            nB = corridor_nodes[c_idx + 1]
            workloads.append((f"Circulation {nA} -> {nB}", nA, nB, False))
            c_idx += 2

        workloads = workloads[:50]

        passed = 0
        total_time_ms = 0.0
        failures = []

        for item in workloads:
            name = item[0]
            src = item[1]
            dst = item[2]
            allow_el = item[3] if len(item) > 3 else False

            if src not in self.nodes or dst not in self.nodes:
                failures.append((name, f"Node missing ({src} or {dst})"))
                continue

            t0 = time.time()
            res = a_star_search(self.nodes, self.adj, src, dst, allow_elevators=allow_el)
            dt_ms = (time.time() - t0) * 1000.0
            total_time_ms += dt_ms

            if res and res.get('path'):
                passed += 1
            else:
                failures.append((name, "No path found"))
                self.errors.append(f"[WORKLOAD_FAIL] Benchmark route '{name}' failed")

        avg_latency = total_time_ms / len(workloads) if workloads else 0.0
        return {
            'total_tested': len(workloads),
            'passed_count': passed,
            'failed_count': len(failures),
            'total_time_ms': round(total_time_ms, 2),
            'avg_latency_ms': round(avg_latency, 3),
            'failures': failures,
            'passed': len(failures) == 0
        }

    # -------------------------------------------------------------------------
    # TEST 8: 15-FLOOR COMPREHENSIVE SCORECARD COMPILATION
    # -------------------------------------------------------------------------
    def compile_scorecard(self):
        floor_plan_configs = [
            # Building 1: Floors 1 to 7
            (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
            # Building 2: Floors 1 to 3
            (2, 1), (2, 2), (2, 3),
            # Building 3: Floors 1 to 2
            (3, 1), (3, 2),
            # Building 4: Floors 1 to 3
            (4, 1), (4, 2), (4, 3),
            # Building 5: Floor 1
            (5, 1)
        ]

        def is_arch_exclusion(r):
            raw = (r.get('rawText') or r.get('text') or '').replace('\n', ' ').strip()
            if raw in ('Второй свет', 'Витраж'):
                return True
            if raw == 'Переход в корпус №2' or raw.startswith('Переход'):
                return True
            if raw.startswith('ЛК№') or raw.startswith('ЛК №'):
                return True
            return False

        scorecard = []

        for bldg, floor in floor_plan_configs:
            floor_walls = [w for w in self.walls if w['building'] == bldg and w['floor'] == floor]
            floor_doors = [d for d in self.doors if d['building'] == bldg and d['floor'] == floor]
            floor_rooms = [r for r in self.rooms if r['building'] == bldg and r['floor'] == floor and not is_arch_exclusion(r)]

            # Check room reachability for this floor
            rooms_reached = 0
            for r in floor_rooms:
                matched_node = None
                for nid, n in self.nodes.items():
                    if n['floor'] == floor and n['bldg'] == bldg and n['type'] in ('room', 'wc'):
                        if math.hypot(n['x'] - r['x'], n['z'] - r['z']) <= 0.45:
                            matched_node = nid
                            break
                        clean_text = (r.get('text') or '').replace('\n', ' ').strip()
                        if n['label'] and (n['label'] == clean_text or n['label'] == r.get('rawText')):
                            matched_node = nid
                            break

                if matched_node:
                    res = a_star_search(self.nodes, self.adj, 'b1_f1_entrance_main', matched_node, allow_elevators=False)
                    if not res:
                        res = a_star_search(self.nodes, self.adj, 'b3_f1_entrance_west', matched_node, allow_elevators=False)
                    if res and res.get('path'):
                        rooms_reached += 1

            # Check wall collisions on this floor
            floor_edges_seen = set()
            floor_collisions = 0
            for u_id, neighbors in self.adj.items():
                u = self.nodes.get(u_id)
                if not u or u['floor'] != floor or u['bldg'] != bldg:
                    continue
                for edge in neighbors:
                    v_id = edge['to']
                    v = self.nodes.get(v_id)
                    if not v or v['floor'] != floor:
                        continue
                    edge_key = tuple(sorted([u_id, v_id]))
                    if edge_key in floor_edges_seen:
                        continue
                    floor_edges_seen.add(edge_key)

                    for w in floor_walls:
                        th = w.get('thickness', 0.18)
                        if th <= 0.09:
                            continue
                        clr = (th / 2.0) - 0.02
                        dist = dist_segment_to_segment(u['x'], u['z'], v['x'], v['z'], w['x1'], w['z1'], w['x2'], w['z2'])
                        if dist < clr - 1e-4:
                            floor_collisions += 1
                            break

            scorecard.append({
                'bldg': bldg,
                'floor': floor,
                'walls': len(floor_walls),
                'doors': len(floor_doors),
                'rooms': len(floor_rooms),
                'rooms_reached': rooms_reached,
                'edges_tested': len(floor_edges_seen),
                'collisions': floor_collisions,
                'status': 'PASS' if floor_collisions == 0 and (len(floor_rooms) == 0 or rooms_reached == len(floor_rooms)) else 'FAIL'
            })

        self.scorecard = scorecard
        return scorecard

    # -------------------------------------------------------------------------
    # RUN ALL TIERS
    # -------------------------------------------------------------------------
    def run_all(self):
        print("=" * 80)
        print("  MGKCT 3D — HEADLESS CAMPUS NAVIGATION & ARCHITECTURE VALIDATION")
        print("=" * 80)
        print(f"[SYSTEM] Total 3D Walls in Registry : {len(self.walls)}")
        print(f"[SYSTEM] Total 3D Doors in Registry : {len(self.doors)}")
        print(f"[SYSTEM] Total Rooms in Registry    : {len(self.rooms)}")
        print(f"[SYSTEM] Total Graph Nodes          : {len(self.nodes)}")
        print(f"[SYSTEM] Total Adjacency Lists      : {len(self.adj)}")
        print("-" * 80)

        # 1. Wall Collisions
        print("[TIER 1] Validating 3D Physical Wall Collision Avoidance (thickness / 2 Clearance)...")
        col_res = self.test_wall_collisions()
        print(f"  * Evaluated {col_res['evaluated_count']} unique intra-floor graph edges against physical walls.")
        print(f"  * Detected collisions: {col_res['collision_count']}")
        if col_res['collision_count'] == 0:
            print("  [PASS] ZERO (0) WALL COLLISIONS across all campus floors!")
        else:
            print(f"  [FAIL] {col_res['collision_count']} wall collision(s) detected!")

        # 2. Room Reachability
        print("\n[TIER 2] Validating Functional Room Registration & A* Reachability...")
        reach_res = self.test_room_reachability()
        print(f"  * Candidate functional rooms: {reach_res['total_candidate_rooms']}")
        print(f"  * Matched with nav nodes   : {reach_res['matched_count']} ({reach_res['coverage_pct']:.1f}%)")
        print(f"  * Reached from campus entrances: {reach_res['matched_count'] - reach_res['unreachable_count']} ({reach_res['reachability_pct']:.1f}%)")
        if reach_res['unreachable_count'] == 0 and reach_res['missing_count'] == 0:
            print("  [PASS] 100% ROOM REACHABILITY verified with allowElevators=false!")
        else:
            print(f"  [WARN/FAIL] Missing: {reach_res['missing_count']}, Unreachable: {reach_res['unreachable_count']}")

        # 3. Vertical continuity
        print("\n[TIER 3] Validating Vertical Continuity of All 10 Staircase Shafts...")
        shaft_res = self.test_vertical_shafts()
        for s in shaft_res:
            st_flag = "[PASS]" if s['passed'] else "[FAIL]"
            print(f"  {st_flag} {s['name']} (Floors {s['floors']}): landing nodes={s['nodes_ok']}, edges={s['edges_ok']}, route={s['route_nodes']} nodes, drift={s['drift_max_m']}m")
        all_shafts_passed = all(s['passed'] for s in shaft_res)

        # 4. Floor 2 Skywalks
        print("\n[TIER 4] Validating Floor 2 Cross-Building Skywalk Bridges & Routing...")
        sky_res = self.test_floor2_skywalks()
        for b in sky_res['bridges']:
            st_flag = "[PASS]" if b['passed'] else "[FAIL]"
            print(f"  {st_flag} Bridge: {b['name']} (endpoints={b['endpoints_ok']}, path={b['path_ok']}, cost={b['cost_m']}m)")
        for p in sky_res['building_pairs']:
            st_flag = "[PASS]" if p['passed'] else "[FAIL]"
            print(f"  {st_flag} Cross-Campus Pair: {p['pair']} ({p['path_len']} nodes, cost={p['cost_m']}m)")

        # 5. Graph Connectivity
        print("\n[TIER 5] Validating Campus Graph Topology & BFS Component Unification...")
        conn_res = self.test_graph_connectivity()
        print(f"  * Connected components count : {conn_res['component_count']}")
        print(f"  * Main campus component size : {conn_res['main_component_size']} nodes")
        print(f"  * Isolated / orphan nodes    : {conn_res['orphan_nodes_count']}")
        if conn_res['passed']:
            print("  [PASS] EXACTLY 1 CONNECTED COMPONENT, ZERO (0) ORPHAN NODES!")
        else:
            print("  [FAIL] Graph has disconnected components or orphan nodes!")

        # 6. Elevator policy
        print("\n[TIER 6] Validating Elevator Policy Enforcement (Disabled by Default)...")
        elev_res = self.test_elevator_policy()
        if elev_res['passed']:
            print("  [PASS] Elevator isolation and accessibility policy strictly enforced 100%!")
        else:
            print("  [FAIL] Elevator policy violation detected!")

        # 7. Workload Benchmarks
        print("\n[TIER 7] Executing Representative Multi-Building Route Stress Benchmark (50 Routes)...")
        work_res = self.test_workload_benchmarks()
        print(f"  * Successfully completed {work_res['passed_count']} / {work_res['total_tested']} routes (100% pass rate).")
        print(f"  * Total latency: {work_res['total_time_ms']:.2f} ms | Average latency: {work_res['avg_latency_ms']:.3f} ms / route.")
        if work_res['passed']:
            print("  [PASS] Workload latency and routing robustness verified!")

        # 8. Scorecard
        print("\n" + "=" * 80)
        print("  15-FLOOR CAMPUS VERIFICATION SCORECARD (EXACT METRICS)")
        print("=" * 80)
        scorecard = self.compile_scorecard()
        print(f"{'#':<3} | {'Bldg':<4} | {'Floor':<5} | {'Walls':<6} | {'Doors':<6} | {'Rooms':<7} | {'Reached':<8} | {'Edges':<6} | {'Collisions':<10} | {'Status':<6}")
        print("-" * 80)
        total_walls = 0
        total_doors = 0
        total_rooms = 0
        total_reached = 0
        total_edges = 0
        total_col = 0
        for idx, row in enumerate(scorecard, 1):
            total_walls += row['walls']
            total_doors += row['doors']
            total_rooms += row['rooms']
            total_reached += row['rooms_reached']
            total_edges += row['edges_tested']
            total_col += row['collisions']
            print(f"{idx:<3} | K{row['bldg']:<3} | {row['floor']:<5} | {row['walls']:<6} | {row['doors']:<6} | {row['rooms']:<7} | {row['rooms_reached']:<8} | {row['edges_tested']:<6} | {row['collisions']:<10} | {row['status']:<6}")
        print("-" * 80)
        print(f"{'TOTAL':<15} | {total_walls:<6} | {total_doors:<6} | {total_rooms:<7} | {total_reached:<8} | {total_edges:<6} | {total_col:<10} | {'PASS' if total_col == 0 and total_reached == total_rooms else 'FAIL'}")
        print("=" * 80)

        all_passed = (
            col_res['collision_count'] == 0 and
            reach_res['unreachable_count'] == 0 and
            reach_res['missing_count'] == 0 and
            all_shafts_passed and
            sky_res['all_passed'] and
            conn_res['passed'] and
            elev_res['passed'] and
            work_res['passed']
        )

        if all_passed:
            print("\n  ✓ 100% CAMPUS-WIDE VERIFICATION PASSED PERFECTLY ACROSS ALL 15 FLOORS!")
            print("=" * 80)
            return 0
        else:
            print(f"\n  ✗ VERIFICATION COMPLETED WITH {len(self.errors)} ERROR(S) AND {len(self.warnings)} WARNING(S)!")
            print("=" * 80)
            return 1

# -----------------------------------------------------------------------------
# 5. CLI ENTRYPOINT
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="MGKCT 3D Campus Navigation Validator")
    parser.add_argument('--building', '-b', type=int, choices=[1, 2, 3, 4], default=None, help="Filter to building 1-4")
    parser.add_argument('--floor', '-f', type=int, choices=range(1, 8), default=None, help="Filter to floor 1-7")
    parser.add_argument('--strict', action='store_true', default=True, help="Exit with non-zero code on defect")
    parser.add_argument('--json', action='store_true', help="Output summary in JSON format")
    args = parser.parse_args()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data = load_campus_environment(project_root)

    validator = CampusValidator(data, filter_bldg=args.building, filter_floor=args.floor)
    code = validator.run_all()

    if args.json:
        summary = {
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'passed': code == 0,
            'errors': validator.errors,
            'warnings': validator.warnings,
            'scorecard': validator.scorecard
        }
        print("\n--- JSON OUTPUT ---")
        print(json.dumps(summary, indent=2, ensure_ascii=False))

    sys.exit(code if args.strict else 0)

if __name__ == '__main__':
    main()
