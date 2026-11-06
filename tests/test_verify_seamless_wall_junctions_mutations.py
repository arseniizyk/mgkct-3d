"""
tests/test_verify_seamless_wall_junctions_mutations.py
======================================================
Adversarial Mutation Tester for tests/verify_seamless_wall_junctions.py.
Demonstrates which injected flaws are caught and surfaces the blind spots.
"""

import sys
import subprocess
import tempfile
import os

sys.stdout.reconfigure(encoding='utf-8')

with open("js/buildings/building3.js", "r", encoding="utf-8") as f:
    b3_orig = f.read()

with open("js/helpers.js", "r", encoding="utf-8") as f:
    helpers_orig = f.read()

with open("js/buildings/building1.js", "r", encoding="utf-8") as f:
    b1_orig = f.read()

test_cases = [
    {
        "name": "Mutation 1: Collinear 0.05m Jog in Building 3",
        "target_file": "js/buildings/building3.js",
        "mutation": b3_orig.replace(
            "addWallLine(targetGroup, B3_X_CORR_W, -55.0, B3_X_CORR_W, -39.6",
            "addWallLine(targetGroup, 4.65, -55.0, 4.65, -39.6"
        ),
        "expect_failure": True,
        "expected_substring": "Detected 1 collinear wall jogs"
    },
    {
        "name": "Mutation 2: T-Junction 0.02m Gap in Building 3",
        "target_file": "js/buildings/building3.js",
        "mutation": b3_orig.replace(
            "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
            "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.49, -55.0, [], INNER_T);"
        ),
        "expect_failure": True,
        "expected_substring": "T-junction gaps"
    },
    {
        "name": "Mutation 3: T-Junction Puncture Overshoot 0.020m in Building 3 (Misclassification Bug)",
        "target_file": "js/buildings/building3.js",
        "mutation": b3_orig.replace(
            "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
            "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.71, -55.0, [], INNER_T);"
        ),
        "expect_failure": True,
        # Due to bug in verify_seamless_wall_junctions.py lines 339-340, it is misclassified as a gap:
        "expected_substring": "T-junction gaps"
    },
    {
        "name": "Mutation 4: T-Junction Large Puncture Overshoot 0.160m (Stage 1 bypass, Stage 2 catches)",
        "target_file": "js/buildings/building3.js",
        "mutation": b3_orig.replace(
            "addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);",
            "addWallLine(targetGroup, B3_X_WEST, -55.0, 4.85, -55.0, [], INNER_T);"
        ),
        # Stage 1 misses this due to abs(ep - xv) < 0.20, BUT Stage 2 catches it as internal seams:
        "expect_failure": True,
        "expected_substring": "Found 4 seams inside wall junctions!"
    },
    {
        "name": "Mutation 5: Missing createResolvedWallEdgesGeometry in helpers.js",
        "target_file": "js/helpers.js",
        "mutation": helpers_orig.replace(
            "function createResolvedWallEdgesGeometry",
            "function disabled_createResolvedWallEdgesGeometry"
        ),
        "expect_failure": True,
        "expected_substring": "createResolvedWallEdgesGeometry must be defined in helpers.js!"
    },
    {
        "name": "Mutation 6: Slab Gap at Z = -4.0 in Building 1",
        "target_file": "js/buildings/building1.js",
        "mutation": b1_orig.replace(
            "addFloorRect(targetGroup, 8.6, -4.0, 16.0, 3.8, true);",
            "addFloorRect(targetGroup, 8.6, -3.95, 16.0, 3.8, true);"
        ),
        "expect_failure": True,
        "expected_substring": "LK-1 slab in common structure must start at Z=-4.0"
    }
]

runner_script_template = """
import sys
real_open = open

def mocked_open(path, *args, **kwargs):
    normalized = path.replace("\\\\", "/")
    if normalized.endswith("{target_suffix}"):
        import io
        return io.StringIO({mutated_content_repr})
    return real_open(path, *args, **kwargs)

import builtins
builtins.open = mocked_open

with real_open("tests/verify_seamless_wall_junctions.py", "r", encoding="utf-8") as f:
    code = f.read()

exec(compile(code, "tests/verify_seamless_wall_junctions.py", "exec"))
"""

print("=" * 70)
print("  EMPIRICAL MUTATION ANALYSIS OF tests/verify_seamless_wall_junctions.py")
print("=" * 70)

for tc in test_cases:
    suffix = tc["target_file"]
    runner_code = runner_script_template.format(
        target_suffix=suffix,
        mutated_content_repr=repr(tc["mutation"])
    )
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tf:
        tf.write(runner_code)
        temp_path = tf.name

    try:
        proc = subprocess.run([sys.executable, temp_path], capture_output=True, text=True, encoding='utf-8')
        output = proc.stdout + proc.stderr
        has_sub = tc["expected_substring"] in output
        
        if tc["expect_failure"]:
            passed = (proc.returncode != 0) and has_sub
        else:
            # Blind spot demonstration: passes when it shouldn't
            passed = (proc.returncode == 0) and has_sub
            
        status = "CONFIRMED" if passed else "UNEXPECTED"
        print(f"[{status}] {tc['name']}")
        if not passed:
            print(f"  Returncode: {proc.returncode}")
            print(f"  Output snippet: {output[:300]}")
        else:
            print(f"  -> Observed: {tc['expected_substring']} (returncode={proc.returncode})")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

print("\n" + "=" * 70)
print("Adversarial mutation analysis complete.")
print("=" * 70)
