// ============================================================================
// СБОРЩИК ПОЛНОГО НАВИГАЦИОННОГО ГРАФА КОЛЛЕДЖА (buildCollegeNavGraph)
// Сначала регистрируются все узлы всех корпусов (1..5 и территория),
// затем добавляются все внутриэтажные, межэтажные и межкорпусные рёбра.
// ============================================================================

function buildCollegeNavGraph() {
    const g = new NavigationGraph();

    // 1. УЗЛЫ ПУТЕЙ (ПО КОРПУСАМ И ЭТАЖАМ)
    addNavNodesBldg1F1(g);
    addNavNodesBldg1F2(g);
    addNavNodesBldg1F3(g);
    addNavNodesBldg1F4(g);
    addNavNodesBldg1F5(g);
    addNavNodesBldg1F6(g);
    addNavNodesBldg1F7AndOutdoor(g);
    addNavNodesBldg2F1(g);
    addNavNodesBldg2F2(g);
    addNavNodesBldg2F3(g);
    addNavNodesBldg3F1(g);
    addNavNodesBldg3F2(g);
    addNavNodesBldg4F1(g);
    addNavNodesBldg4F2F3(g);

    // 2. РЁБРА (СВЯЗИ)
    addNavEdgesBldg1F1(g);
    addNavEdgesBldg1F2(g);
    addNavEdgesBldg1F3(g);
    addNavEdgesBldg1F4(g);
    addNavEdgesBldg1F5(g);
    addNavEdgesBldg1F6(g);
    addNavEdgesBldg1F7AndOutdoor(g);
    addNavEdgesBldg2F1(g);
    addNavEdgesBldg2F2(g);
    addNavEdgesBldg2F3(g);
    addNavEdgesBldg3F1(g);
    addNavEdgesBldg3F2(g);
    addNavEdgesBldg4F1(g);
    addNavEdgesBldg4F2F3(g);

    return g;
}
window.buildCollegeNavGraph = buildCollegeNavGraph;
