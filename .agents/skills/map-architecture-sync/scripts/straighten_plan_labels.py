#!/usr/bin/env python3
"""
straighten_plan_labels.py

Скрипт для автоматического выравнивания перевёрнутого и вертикального текста
на эталонных планах БТИ в planning_zip/.
Находит изолированные текстовые метки номеров кабинетов, которые нарисованы вертикально,
поворачивает их на 90 градусов по часовой стрелке, делая строго горизонтальными,
и центрирует обратно на их исходном месте.
"""

import os
import sys
from PIL import Image

def process_image(img_path):
    print(f"Обработка: {img_path}")
    orig_img = Image.open(img_path).convert("RGB")
    gray = orig_img.convert("L")
    w, h = gray.size
    pixels = gray.load()

    # Поиск тёмных пикселей (< 140)
    visited = set()
    components = []

    for y in range(h):
        for x in range(w):
            if pixels[x, y] < 140 and (x, y) not in visited:
                comp = []
                queue = [(x, y)]
                visited.add((x, y))
                min_x, max_x = x, x
                min_y, max_y = y, y

                while queue:
                    cx, cy = queue.pop()
                    comp.append((cx, cy))
                    if cx < min_x: min_x = cx
                    if cx > max_x: max_x = cx
                    if cy < min_y: min_y = cy
                    if cy > max_y: max_y = cy

                    # 8-связность
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited and pixels[nx, ny] < 140:
                            visited.add((nx, ny))
                            queue.append((nx, ny))

                cw = max_x - min_x + 1
                ch = max_y - min_y + 1

                # Фильтруем стены: исключаем компоненты, которые длиннее 350px или содержат > 3000 пикселей
                if cw < 300 and ch < 300 and len(comp) < 3000:
                    components.append({
                        "min_x": min_x, "min_y": min_y,
                        "max_x": max_x, "max_y": max_y,
                        "pixels": comp
                    })

    # Объединяем соседние символы в текстовые блоки (кластеризация по расстоянию < 20px)
    clusters = []
    for c in components:
        merged = False
        for cl in clusters:
            dx = max(0, max(cl["min_x"] - c["max_x"], c["min_x"] - cl["max_x"]))
            dy = max(0, max(cl["min_y"] - c["max_y"], c["min_y"] - cl["max_y"]))
            if dx < 20 and dy < 20:
                cl["min_x"] = min(cl["min_x"], c["min_x"])
                cl["max_x"] = max(cl["max_x"], c["max_x"])
                cl["min_y"] = min(cl["min_y"], c["min_y"])
                cl["max_y"] = max(cl["max_y"], c["max_y"])
                cl["pixels"].extend(c["pixels"])
                merged = True
                break
        if not merged:
            clusters.append(dict(c))

    # Повторный проход слияния
    changed = True
    while changed:
        changed = False
        new_clusters = []
        skip = set()
        for i in range(len(clusters)):
            if i in skip:
                continue
            base = clusters[i]
            for j in range(i + 1, len(clusters)):
                if j in skip:
                    continue
                other = clusters[j]
                dx = max(0, max(base["min_x"] - other["max_x"], other["min_x"] - base["max_x"]))
                dy = max(0, max(base["min_y"] - other["max_y"], other["min_y"] - base["max_y"]))
                if dx < 20 and dy < 20:
                    base["min_x"] = min(base["min_x"], other["min_x"])
                    base["max_x"] = max(base["max_x"], other["max_x"])
                    base["min_y"] = min(base["min_y"], other["min_y"])
                    base["max_y"] = max(base["max_y"], other["max_y"])
                    base["pixels"].extend(other["pixels"])
                    skip.add(j)
                    changed = True
            new_clusters.append(base)
        clusters = new_clusters

    # Находим вертикальные текстовые метки
    vertical_labels = []
    for cl in clusters:
        cw = cl["max_x"] - cl["min_x"] + 1
        ch = cl["max_y"] - cl["min_y"] + 1
        
        # Проверяем лифты или двери
        is_square = abs(cw - ch) < 8 and cw > 25
        if is_square:
            continue

        # Вертикальный текст: высота больше ширины
        if ch > cw * 1.15 and ch >= 20 and cw <= 80:
            vertical_labels.append(cl)

    if not vertical_labels:
        print(f"  В {img_path} перевёрнутых вертикальных меток не обнаружено.")
        return False

    print(f"  Найдено вертикальных меток: {len(vertical_labels)}")
    result_img = orig_img.copy()

    for idx, lbl in enumerate(vertical_labels):
        x1, y1 = lbl["min_x"], lbl["min_y"]
        x2, y2 = lbl["max_x"], lbl["max_y"]
        pad = 2
        crop_box = (max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad + 1), min(h, y2 + pad + 1))
        
        # Вырезаем вертикальную метку
        crop = orig_img.crop(crop_box)
        
        # Поворачиваем на 90 градусов по часовой стрелке (в PIL это rotate(-90))
        rot = crop.rotate(-90, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        
        # Стираем старое вертикальное место (заливаем белым цветом с запасом 1px)
        for py in range(crop_box[1], crop_box[3]):
            for px in range(crop_box[0], crop_box[2]):
                result_img.putpixel((px, py), (255, 255, 255))

        # Центрируем повернутую метку в той же точке
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        rw, rh = rot.size
        dest_x = max(0, cx - rw // 2)
        dest_y = max(0, cy - rh // 2)

        result_img.paste(rot, (dest_x, dest_y))
        print(f"    Повёрнута метка #{idx+1}: [{x1}..{x2}, {y1}..{y2}] -> новая ориентация в ({dest_x}, {dest_y})")

    # Сохраняем обновленный файл
    result_img.save(img_path, quality=98)
    print(f"  Файл успешно обновлен: {img_path}")
    return True

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "planning_zip"
    if os.path.isfile(target):
        process_image(target)
    elif os.path.isdir(target):
        for root, dirs, files in os.walk(target):
            for f in sorted(files):
                if f.endswith(".jpg"):
                    process_image(os.path.join(root, f))
