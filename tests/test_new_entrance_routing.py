import re
import heapq
import math

with open('js/navigator.js', 'r', encoding='utf-8') as f:
    text = f.read()

nodes = {}
edges = {}

node_pattern = re.compile(r'g\.addNode\(\s*["\']([^"\']+)["\']\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']*)["\']\s*\)')
edge_pattern = re.compile(r'g\.addEdge\(\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\']\s*(?:,\s*([-0-9.]+))?')

for m in node_pattern.finditer(text):
    nid, fl, bldg, x, z, ntype, lbl = m.groups()
    nodes[nid] = {'floor': int(fl), 'bldg': int(bldg), 'x': float(x), 'z': float(z), 'type': ntype, 'label': lbl}
    edges[nid] = []

for m in edge_pattern.finditer(text):
    u, v, w = m.groups()
    if u in nodes and v in nodes:
        cost = float(w) if w else math.hypot(nodes[u]['x']-nodes[v]['x'], nodes[u]['z']-nodes[v]['z']) + abs(nodes[u]['floor']-nodes[v]['floor'])*5.0
        edges[u].append((v, cost))
        edges[v].append((u, cost))

def a_star(start_id, goal_id):
    if start_id not in nodes or goal_id not in nodes:
        return None
    pq = [(0, start_id, [start_id])]
    visited = {}
    while pq:
        cost, cur, path = heapq.heappop(pq)
        if cur == goal_id:
            return path, cost
        if cur in visited and visited[cur] <= cost:
            continue
        visited[cur] = cost
        for nxt, weight in edges.get(cur, []):
            new_cost = cost + weight
            if nxt not in visited or visited[nxt] > new_cost:
                heapq.heappush(pq, (new_cost, nxt, path + [nxt]))
    return None

start = 'b3_f1_entrance_west'
targets = {
    'b1_f1_entrance_main': 'Главный вход 2 (Корпус 1)',
    'room_4_1_222': 'Столовая (К4)',
    'room_4_2_230': 'Актовый зал (К4)',
    'room_2_1_103': 'Библиотека (К2)',
    'room_1_1_0': 'Гардероб (К1)',
    'room_1_7_88': 'Каб 701 (К1 Эт 7)'
}

all_ok = True
print(f'Starting routes from new MAIN ENTRANCE: {start} ({nodes[start]["label"]})')
for tid, desc in targets.items():
    if tid not in nodes:
        print(f'  [WARN] Node {tid} not in parsed nodes, searching by label...')
        matched = [k for k, v in nodes.items() if desc.split()[0] in v['label']]
        if matched:
            tid = matched[0]
    res = a_star(start, tid)
    if res:
        path, cost = res
        print(f'  [PASS] -> {desc} ({tid}): {len(path)} nodes, path cost {cost:.1f}m')
    else:
        print(f'  [FAIL] -> {desc}: NO ROUTE FOUND!')
        all_ok = False

assert all_ok, 'Some routes failed!'
print('ALL ROUTING TESTS PASSED 100%!')
