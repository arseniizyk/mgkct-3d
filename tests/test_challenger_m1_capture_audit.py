import os
import sys
import glob
from PIL import Image, ImageStat

CAPTURES_DIR = os.path.join(r"c:\Users\Администратор\Desktop\map\mgkct-3d\.agents\teamwork\challenger_m1_2\captures")

def audit_captures():
    png_files = glob.glob(os.path.join(CAPTURES_DIR, "**", "*.png"), recursive=True)
    print(f"Total PNG files found: {len(png_files)}")

    results = []
    issues = []

    for path in sorted(png_files):
        rel_path = os.path.relpath(path, CAPTURES_DIR)
        file_size = os.path.getsize(path)
        
        try:
            with Image.open(path) as img:
                img.verify()
            with Image.open(path) as img:
                width, height = img.size
                stat = ImageStat.Stat(img)
                # Compute root-mean-square (RMS) variance across color channels
                variance = stat.var
                unique_colors = len(img.getcolors(maxcolors=2000000) or [])
                is_solid = (unique_colors < 20) or (max(variance) < 1.0)
                
                res = {
                    "rel_path": rel_path,
                    "width": width,
                    "height": height,
                    "file_size": file_size,
                    "channels": img.mode,
                    "unique_colors": unique_colors,
                    "variance": variance,
                    "is_solid": is_solid
                }
                results.append(res)
                
                # Check criteria
                if (width, height) != (1920, 1080):
                    issues.append(f"[DIMENSION_MISMATCH] {rel_path}: Got {width}x{height}, expected 1920x1080")
                if file_size < 100 * 1024:
                    issues.append(f"[UNDERSIZED_FILE] {rel_path}: {file_size:,} bytes (< 100KB threshold)")
                if is_solid:
                    issues.append(f"[DEGENERATE_SOLID_VIEW] {rel_path}: Only {unique_colors} unique colors, variance={variance}")
        except Exception as e:
            issues.append(f"[CORRUPTED_PNG] {rel_path}: Error {e}")

    print("\n--- AUDIT SUMMARY ---")
    for r in results:
        print(f"{r['rel_path']}: {r['width']}x{r['height']}, {r['file_size']:,} bytes, colors={r['unique_colors']}, solid={r['is_solid']}")

    print("\n--- ISSUES DETECTED ---")
    if issues:
        for iss in issues:
            print("  FAIL:", iss)
    else:
        print("  All captures passed all empirical assertions!")

    return len(issues)

if __name__ == "__main__":
    sys.exit(audit_captures())
