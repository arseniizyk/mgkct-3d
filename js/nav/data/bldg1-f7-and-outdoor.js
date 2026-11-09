// ============================================================================
// ДАННЫЕ НАВИГАЦИОННОГО ГРАФА: Корпус 1 (Этаж 7), Гараж (Корпус 5) и Уличная территория
// ============================================================================

function addNavNodesBldg1F7AndOutdoor(g) {
        g.addNode("b1_f7_nc_door_-5.8", 7, 1, -7.9, -5.1, "door", "К1 Эт.7 Дверь север");
        g.addNode("b1_f7_nc_0.0", 7, 1, -0.3, -5.1, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_5.9", 7, 1, 5.4, -5.1, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_wc_-3.0", 7, 1, -4.0, -1.6, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_0.0", 7, 1, -4.0, -0.2, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_3.5", 7, 1, -4.0, 3.2, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_6.0", 7, 1, -4.0, 6.0, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_sc_0.0", 7, 1, 0.4, 6.0, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_1.8", 7, 1, 1.8, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_3.5", 7, 1, 3.5, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_5.6", 7, 1, 5.5, 6.0, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_9.4", 7, 1, 9.4, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_10.5", 7, 1, 10.5, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_stair_lk1", 7, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.7)");
        g.addNode("b1_f7_stair_lk2", 7, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.7)");
        g.addNode("b1_f7_elev", 7, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.7)");
        g.addNode("room_1_7_81", 7, 1, 6.2, -2.8, "room", "WC (М)");
        g.addNode("door_mid_room_1_7_81", 7, 1, 5.4, -4, "door", "Дверь WC");
        g.addNode("door_room_room_1_7_81", 7, 1, 5.4, -3.6, "door", "Вход WC");
        g.addNode("door_corr_room_1_7_81", 7, 1, 5.4, -4.4, "door", "Коридор WC");
        g.addNode("room_1_7_82", 7, 1, 5.6, 1.3, "room", "WC (Ж)");
        g.addNode("door_mid_room_1_7_82", 7, 1, 5.5, 4, "door", "Дверь WC");
        g.addNode("door_room_room_1_7_82", 7, 1, 5.5, 3.6, "door", "Вход WC");
        g.addNode("door_corr_room_1_7_82", 7, 1, 5.5, 4.4, "door", "Коридор WC");
        g.addNode("room_1_7_83", 7, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_7_83", 7, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_7_83", 7, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_1_7_83", 7, 1, 9.4, -4.2, "door", "Коридор ЛК№1");
        g.addNode("room_1_7_84", 7, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_7_84", 7, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_7_84", 7, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_7_84", 7, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_7_85", 7, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("room_1_7_86", 7, 1, -6.2, -10.2, "room", "703");
        g.addNode("door_mid_room_1_7_86", 7, 1, -2.6, -6.2, "door", "Дверь 703");
        g.addNode("door_room_room_1_7_86", 7, 1, -2.6, -6.6, "door", "Вход 703");
        g.addNode("room_1_7_87", 7, 1, -0.3, -11.4, "room", "703А");
        g.addNode("door_mid_room_1_7_87", 7, 1, -0.3, -8.8, "door", "Дверь 703А");
        g.addNode("door_room_room_1_7_87", 7, 1, -0.3, -9.2, "door", "Вход 703А");
        g.addNode("door_corr_room_1_7_87", 7, 1, -0.3, -8.4, "door", "Коридор 703А");
        g.addNode("room_1_7_88", 7, 1, 10.6, -10.2, "room", "704");
        g.addNode("door_mid_room_1_7_88", 7, 1, 7.9, -6.2, "door", "Дверь 704");
        g.addNode("door_room_room_1_7_88", 7, 1, 7.9, -6.6, "door", "Вход 704");
        g.addNode("room_1_7_89", 7, 1, -9.9, -1.8, "room", "702А");
        g.addNode("door_mid_room_1_7_89", 7, 1, -5.8, -1.6, "door", "Дверь 702А");
        g.addNode("door_room_room_1_7_89", 7, 1, -6.2, -1.6, "door", "Вход 702А");
        g.addNode("door_corr_room_1_7_89", 7, 1, -5.4, -1.6, "door", "Коридор 702А");
        g.addNode("room_1_7_90", 7, 1, -9.9, 7.2, "room", "702");
        g.addNode("door_mid_room_1_7_90", 7, 1, -5.8, 3.2, "door", "Дверь 702");
        g.addNode("door_room_room_1_7_90", 7, 1, -6.2, 3.2, "door", "Вход 702");
        g.addNode("door_corr_room_1_7_90", 7, 1, -5.4, 3.2, "door", "Коридор 702");
        g.addNode("room_1_7_91", 7, 1, -3.7, 10.8, "room", "701А");
        g.addNode("door_mid_room_1_7_91", 7, 1, -4, 7.2, "door", "Дверь 701А");
        g.addNode("door_room_room_1_7_91", 7, 1, -4, 7.6, "door", "Вход 701А");
        g.addNode("door_corr_room_1_7_91", 7, 1, -4, 6.8, "door", "Коридор 701А");
        g.addNode("room_1_7_92", 7, 1, 3.5, 10.8, "room", "701");
        g.addNode("door_mid_room_1_7_92", 7, 1, 0.4, 7.2, "door", "Дверь 701");
        g.addNode("door_room_room_1_7_92", 7, 1, 0.4, 7.6, "door", "Вход 701");
        g.addNode("door_corr_room_1_7_92", 7, 1, 0.4, 6.8, "door", "Коридор 701");
        // Семантический узел северной части внутреннего проезда между К3 и К4
        g.addNode("outdoor_node_90724", 1, 0, 26.0, -24.9, "corridor", "Улица");
        g.addNode("outdoor_node_74046", 1, 0, 15.2, -28.6, "corridor", "Улица");
        g.addNode("outdoor_b4_porch_corner", 1, 0, 26, -52, "corridor", "Улица");
        g.addNode("outdoor_b4_nw_corner", 1, 0, 26.0, -62.0, "corridor", "Улица у Корпуса 4");
        g.addNode("outdoor_b4_north_porch", 1, 0, 41.65, -62.0, "entrance", "Северный служебный вход К4");
        // --- Гараж (хозяйственное строение, заезд с северного проезда) ---
        // bldg: 5 — корректный идентификатор корпуса 5 (был bldg: 0, что делало
        // узлы недостижимыми через findClosestNode при фильтрации по корпусу).
        // --- USER ADDED NODES (90-DEGREE EDIT) ---
        g.addNode('outdoor_node_55755', 1, 0, 2.5, 9.8, 'outdoor', 'Внутренний двор');
        g.addNode('outdoor_node_98875', 1, 0, 42.7, -19.6, 'outdoor', 'Внутренний двор');
        // --- USER ADDED NODES (OUTDOOR EDIT) ---
        g.addNode('outdoor_node_64777', 1, 0, 43.8, -19.6, 'outdoor', 'Внутренний двор');
        // --- USER ADDED NODES (FLOOR 7 EDIT) ---
        g.addNode('outdoor_node_60784', 7, 1, -4.0, 1.4, 'corridor', 'Внутренний двор');
        g.addNode('outdoor_node_90644', 7, 1, -4.0, -5.1, 'corridor', 'Внутренний двор');
        g.addNode('outdoor_node_67714', 7, 1, -2.6, -5.1, 'corridor', 'Внутренний двор');
        g.addNode('outdoor_node_51373', 7, 1, 7.9, -5.1, 'corridor', 'Внутренний двор');
        g.addNode('outdoor_node_21500', 7, 1, 9.4, -5.1, 'corridor', 'Внутренний двор');
}

function addNavEdgesBldg1F7AndOutdoor(g) {
        g.addEdge("b1_f7_nc_0.0", "door_corr_room_1_7_87", 2.6);
        g.addEdge("b1_f7_nc_5.9", "door_corr_room_1_7_81", 1.5);
        g.addEdge("b1_f7_wc_-3.0", "b1_f7_wc_0.0", 3);
        g.addEdge("b1_f7_wc_-3.0", "door_corr_room_1_7_89", 2.8);
        g.addEdge("b1_f7_wc_3.5", "b1_f7_wc_6.0", 2.5);
        g.addEdge("b1_f7_wc_3.5", "door_corr_room_1_7_90", 2.4);
        g.addEdge("b1_f7_wc_6.0", "b1_f7_sc_0.0", 3);
        g.addEdge("b1_f7_wc_6.0", "door_corr_room_1_7_91", 1.3);
        g.addEdge("b1_f7_sc_0.0", "b1_f7_sc_1.8", 1.8);
        g.addEdge("b1_f7_sc_0.0", "door_corr_room_1_7_92", 0.9);
        g.addEdge("b1_f7_sc_1.8", "b1_f7_sc_3.5", 1.7);
        g.addEdge("b1_f7_sc_3.5", "b1_f7_sc_5.6", 2.1);
        g.addEdge("b1_f7_sc_5.6", "b1_f7_sc_9.4", 3.8);
        g.addEdge("b1_f7_sc_5.6", "door_corr_room_1_7_82", 1.6);
        g.addEdge("b1_f7_sc_9.4", "b1_f7_sc_10.5", 1.1);
        g.addEdge("b1_f7_sc_9.4", "b1_f7_stair_lk2", 4.1);
        g.addEdge("b1_f7_sc_9.4", "door_corr_room_1_7_84", 1.8);
        g.addEdge("room_1_7_81", "door_room_room_1_7_81", 1.1);
        g.addEdge("door_mid_room_1_7_81", "door_room_room_1_7_81", 0.4);
        g.addEdge("door_mid_room_1_7_81", "door_corr_room_1_7_81", 0.4);
        g.addEdge("room_1_7_82", "door_room_room_1_7_82", 2.3);
        g.addEdge("door_mid_room_1_7_82", "door_room_room_1_7_82", 0.4);
        g.addEdge("door_mid_room_1_7_82", "door_corr_room_1_7_82", 0.4);
        g.addEdge("room_1_7_83", "door_room_room_1_7_83", 1.5);
        g.addEdge("door_mid_room_1_7_83", "door_room_room_1_7_83", 0.4);
        g.addEdge("door_mid_room_1_7_83", "door_corr_room_1_7_83", 0.4);
        g.addEdge("room_1_7_84", "door_room_room_1_7_84", 1.5);
        g.addEdge("door_mid_room_1_7_84", "door_room_room_1_7_84", 0.4);
        g.addEdge("door_mid_room_1_7_84", "door_corr_room_1_7_84", 0.4);
        g.addEdge("room_1_7_86", "door_room_room_1_7_86", 5.1);
        g.addEdge("door_mid_room_1_7_86", "door_room_room_1_7_86", 0.4);
        g.addEdge("room_1_7_87", "door_room_room_1_7_87", 2.2);
        g.addEdge("door_mid_room_1_7_87", "door_room_room_1_7_87", 0.4);
        g.addEdge("door_mid_room_1_7_87", "door_corr_room_1_7_87", 0.4);
        g.addEdge("room_1_7_88", "door_room_room_1_7_88", 4.5);
        g.addEdge("door_mid_room_1_7_88", "door_room_room_1_7_88", 0.4);
        g.addEdge("room_1_7_89", "door_room_room_1_7_89", 3.7);
        g.addEdge("door_mid_room_1_7_89", "door_room_room_1_7_89", 0.4);
        g.addEdge("door_mid_room_1_7_89", "door_corr_room_1_7_89", 0.4);
        g.addEdge("room_1_7_90", "door_room_room_1_7_90", 5.4);
        g.addEdge("door_mid_room_1_7_90", "door_room_room_1_7_90", 0.4);
        g.addEdge("door_mid_room_1_7_90", "door_corr_room_1_7_90", 0.4);
        g.addEdge("room_1_7_91", "door_room_room_1_7_91", 3.2);
        g.addEdge("door_mid_room_1_7_91", "door_room_room_1_7_91", 0.4);
        g.addEdge("door_mid_room_1_7_91", "door_corr_room_1_7_91", 0.4);
        g.addEdge("room_1_7_92", "door_room_room_1_7_92", 4.5);
        g.addEdge("door_mid_room_1_7_92", "door_room_room_1_7_92", 0.4);
        g.addEdge("door_mid_room_1_7_92", "door_corr_room_1_7_92", 0.4);
        g.addEdge("outdoor_node_90724", "outdoor_node_74046", 11);
        g.addEdge("outdoor_b4_porch_corner", "outdoor_b4_nw_corner", 10.0);
        g.addEdge("outdoor_b4_nw_corner", "outdoor_b4_north_porch", 15.6);
        g.addEdge("outdoor_b4_north_porch", "b4_f1_north_service_door", 1.6);
        g.addEdge('outdoor_b4_porch_corner', 'outdoor_node_90724');
        g.addEdge('outdoor_node_55755', 'outdoor_node_20007');
        g.addEdge('outdoor_node_90724', 'outdoor_node_98875');
        g.addEdge('outdoor_node_74046', 'outdoor_b4_porch_corner');
        g.addEdge('outdoor_node_55755', 'b1_f1_sc_1.8');
        // --- USER ADDED EDGES (OUTDOOR EDIT) ---
        g.addEdge('outdoor_node_98875', 'outdoor_node_64777');
        g.addEdge('outdoor_node_64777', 'custom_b4_f1_c_438_-321_ent');
        // --- USER ADDED EDGES (FLOOR 7 EDIT) ---
        g.addEdge('b1_f7_elev', 'outdoor_node_60784');
        g.addEdge('b1_f7_wc_3.5', 'outdoor_node_60784');
        g.addEdge('outdoor_node_60784', 'b1_f7_wc_0.0');
        g.addEdge('b1_f7_wc_-3.0', 'outdoor_node_90644');
        g.addEdge('outdoor_node_90644', 'outdoor_node_67714');
        g.addEdge('b1_f7_nc_door_-5.8', 'outdoor_node_90644');
        g.addEdge('outdoor_node_67714', 'door_mid_room_1_7_86');
        g.addEdge('outdoor_node_67714', 'b1_f7_nc_0.0');
        g.addEdge('b1_f7_nc_0.0', 'b1_f7_nc_5.9');
        g.addEdge('b1_f7_nc_5.9', 'outdoor_node_51373');
        g.addEdge('outdoor_node_51373', 'outdoor_node_21500');
        g.addEdge('outdoor_node_51373', 'door_mid_room_1_7_88');
        g.addEdge('outdoor_node_21500', 'door_corr_room_1_7_83');
        g.addEdge('outdoor_node_21500', 'b1_f7_stair_lk1');
        g.addEdge("room_1_7_85", "b1_f7_elev", 0.2);
        g.addEdge("room_1_7_85", "outdoor_node_60784", 1.4);
}
