import re, json

print("=== 1. VERIFYING INDEX.HTML CHIPS ===")
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Verify that old numeric chips are completely gone
assert 'data-query="2-102"' not in html, "Old chip 2-102 still in index.html"
assert 'data-query="1-105"' not in html, "Old chip 1-105 still in index.html"
assert 'data-query="4-104"' not in html, "Old chip 4-104 still in index.html"

# Verify all required named venue chips exist
required_chips = ['Столовая', 'Библиотека', 'Актовый зал', 'Конференц-зал', 'Учебная часть']
for chip in required_chips:
    assert f'data-query="{chip}"' in html, f"Required chip '{chip}' missing in index.html"
    print(f"  [OK] Chip found: {chip}")

# Verify flex-wrap is present to avoid window overflow
assert 'flex-wrap' in html, "flex-wrap missing from chips container!"
print("  [OK] Chips container uses flex-wrap to prevent modal window overflow")

print("\n=== 2. VERIFYING UI.JS RECENT SEARCHES IMPLEMENTATION ===")
with open('js/ui.js', 'r', encoding='utf-8') as f:
    ui = f.read()

assert 'getRecentSearches' in ui, "getRecentSearches function missing"
assert 'saveRecentSearch' in ui, "saveRecentSearch function missing"
assert 'clearRecentSearches' in ui, "clearRecentSearches function missing"
print("  [OK] Recent search interface verified in js/ui.js")

print("\n=== 3. VERIFYING CSS/STYLE.CSS ===")
with open('css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

assert '.room-search-title' in css, ".room-search-title style missing in css/style.css"
assert 'line-height: 1.35' in css, "Line height fix missing for search title"
assert '.room-search-sub' in css, ".room-search-sub style missing in css/style.css"
print("  [OK] CSS typography rules for search results verified")

print("\nALL SEARCH MODAL VERIFICATIONS PASSED 100%!")
