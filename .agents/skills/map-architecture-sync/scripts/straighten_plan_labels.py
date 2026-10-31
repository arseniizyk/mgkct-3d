#!/usr/bin/env python3
"""
straighten_plan_labels.py

Безопасное автоматическое выравнивание перевёрнутых и вертикальных текстовых меток
на эталонных планах БТИ в planning_zip/ с защитой стен через OpenCV connectedComponentsWithStats.
Гарантированно НЕ затрагивает стены, перегородки, двери и лестничные марши.
"""

import os
import sys
import cv2
import numpy as np
from PIL import Image


def straighten_labels_safe(src_path, dst_path, rot_deg, y_range=None, x_range=None):
    orig_pil = Image.open(src_path).convert("RGB")
    gray = np.array(orig_pil.convert("L"))
    h, w = gray.shape

    binary = (gray < 175).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

    # 1. Маска стен и длинных линий (любой компонент шире/выше 42px или площадью > 480px)
    wall_mask = np.zeros((h, w), dtype=np.uint8)
    char_comps = []
    for i in range(1, num_labels):
        x, y, cw, ch, area = stats[i]
        if cw > 42 or ch > 42 or area > 480 or area < 6:
            if area >= 6:
                wall_mask[labels == i] = 1
        else:
            char_comps.append((i, x, y, x + cw - 1, y + ch - 1, area))

    # Расширяем маску стен на 3px, чтобы исключить символы, касающиеся стен/дверей
    wall_dilated = cv2.dilate(wall_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))

    safe_chars = []
    for (cid, x1, y1, x2, y2, _) in char_comps:
        if y_range and not (y_range[0] <= (y1 + y2) / 2 <= y_range[1]):
            continue
        if x_range and not (x_range[0] <= (x1 + x2) / 2 <= x_range[1]):
            continue
        comp_mask = (labels[y1:y2 + 1, x1:x2 + 1] == cid)
        if np.any(wall_dilated[y1:y2 + 1, x1:x2 + 1][comp_mask] > 0):
            continue
        safe_chars.append({
            "cids": [cid],
            "x1": int(x1), "y1": int(y1),
            "x2": int(x2), "y2": int(y2)
        })

    # Кластеризация соседних цифр/букв в номера кабинетов (шаг <= 12px)
    changed = True
    clusters = safe_chars
    while changed:
        changed = False
        new_clusters = []
        used = set()
        for i in range(len(clusters)):
            if i in used:
                continue
            a = dict(clusters[i])
            a["cids"] = list(a["cids"])
            for j in range(i + 1, len(clusters)):
                if j in used:
                    continue
                b = clusters[j]
                dx = max(0, max(a["x1"] - b["x2"], b["x1"] - a["x2"]))
                dy = max(0, max(a["y1"] - b["y2"], b["y1"] - a["y2"]))
                if dx <= 12 and dy <= 12:
                    nx1, ny1 = min(a["x1"], b["x1"]), min(a["y1"], b["y1"])
                    nx2, ny2 = max(a["x2"], b["x2"]), max(a["y2"], b["y2"])
                    if np.sum(wall_mask[ny1:ny2 + 1, nx1:nx2 + 1]) == 0 and (nx2 - nx1) < 150 and (ny2 - ny1) < 150:
                        a["x1"], a["y1"], a["x2"], a["y2"] = nx1, ny1, nx2, ny2
                        a["cids"].extend(b["cids"])
                        used.add(j)
                        changed = True
            new_clusters.append(a)
        clusters = new_clusters

    res_np = np.array(orig_pil)
    count = 0
    for cl in clusters:
        x1, y1, x2, y2 = cl["x1"], cl["y1"], cl["x2"], cl["y2"]
        cw, ch = x2 - x1 + 1, y2 - y1 + 1
        if cw < 8 and ch < 8:
            continue
        pad = 2
        bx1, by1 = max(0, x1 - pad), max(0, y1 - pad)
        bx2, by2 = min(w - 1, x2 + pad), min(h - 1, y2 + pad)
        if np.sum(wall_mask[by1:by2 + 1, bx1:bx2 + 1]) > 0:
            continue

        crop = Image.fromarray(res_np[by1:by2 + 1, bx1:bx2 + 1])
        rot = crop.rotate(rot_deg, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        rw, rh = rot.size
        cx, cy = (bx1 + bx2) // 2, (by1 + by2) // 2
        dx1, dy1 = max(0, cx - rw // 2), max(0, cy - rh // 2)
        dx2, dy2 = min(w, dx1 + rw), min(h, dy1 + rh)
        if np.sum(wall_mask[dy1:dy2, dx1:dx2]) > 0:
            continue

        res_np[by1:by2 + 1, bx1:bx2 + 1] = 255
        res_np[dy1:dy2, dx1:dx2] = np.array(rot)[:dy2 - dy1, :dx2 - dx1]
        count += 1

    Image.fromarray(res_np).save(dst_path, quality=98)
    print(f"[straighten_plan_labels] {dst_path}: выровнено {count} текстовых блоков ({rot_deg}°).")
    return count


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        path = sys.argv[1]
        deg = int(sys.argv[2])
        straighten_labels_safe(path, path, deg)
    else:
        print("Использование: python3 straighten_plan_labels.py <путь_к_jpg> <угол_поворота_PIL: -90 | 90 | 180>")
