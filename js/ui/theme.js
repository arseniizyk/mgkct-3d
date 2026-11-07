// Вспомогательная функция escapeHtml определена в js/state.js
if (typeof escapeHtml !== 'function') {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    if (typeof window !== 'undefined' && !window.escapeHtml) {
        window.escapeHtml = escapeHtml;
    }
}

// ==========================================
// ОБРАБОТКА ПОЛЬЗОВАТЕЛЬСКОГО ИНТЕРФЕЙСА (UI)
// ИНТЕРАКТИВНАЯ КАРТА КОЛЛЕДЖА (2D / 3D)
// ==========================================

const SETTINGS_KEY = 'college_3d_map_settings_v3';

// getSystemTheme импортирован из единого источника истины в js/state.js

function setTheme(themeName, shouldSave = false) {
    if (themeName !== 'dark' && themeName !== 'light') {
        themeName = getSystemTheme();
    }
    STATE.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    if (document.body) {
        document.body.setAttribute('data-theme', themeName);
    }

    const isDark = (themeName === 'dark');

    // 3D Three.js сцена (приятный картографический фон)
    if (typeof scene !== 'undefined' && scene) {
        scene.background = new THREE.Color(isDark ? 0x171c24 : 0xeef2f6);
    }

    // 3D Three.js материалы (сбалансированная палитра для светлого и тёмного режима)
    if (typeof MATERIALS !== 'undefined') {
        if (isDark) {
            // ТЁМНАЯ ТЕМА (каноничная архитектурная палитра: нейтральный графит Material 3 + контрастные стены + сине-серые лестницы):
            if (typeof updateBuildingColors === 'function') {
                updateBuildingColors();
            } else {
                if (MATERIALS.slab) MATERIALS.slab.color.setHex(0x222833);
                if (MATERIALS.coreSlab) MATERIALS.coreSlab.color.setHex(0x1c212b);
                if (MATERIALS.wall) MATERIALS.wall.color.setHex(0x424c5c);
                if (MATERIALS.stair) MATERIALS.stair.color.setHex(0x364962);
            }
            if (MATERIALS.elevatorCar) MATERIALS.elevatorCar.color.setHex(0x334357);
            if (MATERIALS.doorThin) MATERIALS.doorThin.color.setHex(0x56657a);
            if (MATERIALS.edgeMain) MATERIALS.edgeMain.color.setHex(0x252c38);
            if (MATERIALS.edgeDoor) MATERIALS.edgeDoor.color.setHex(0x313c4a);
            if (MATERIALS.roof) MATERIALS.roof.color.setHex(0x212731);
            if (MATERIALS.edgeRoof) MATERIALS.edgeRoof.color.setHex(0x181d24);
            if (MATERIALS.guideLine) MATERIALS.guideLine.color.setHex(0x475569);
            if (MATERIALS.minimalRoadSurface) MATERIALS.minimalRoadSurface.color.setHex(0x1d2430);
            if (MATERIALS.roadContourLine) MATERIALS.roadContourLine.color.setHex(0x94a3b8);
            if (MATERIALS.roadCenterLine) MATERIALS.roadCenterLine.color.setHex(0x475569);
            // Прилегающая территория в тёмной теме
            if (MATERIALS.asphaltRoad) MATERIALS.asphaltRoad.color.setHex(0x171d28);
            if (MATERIALS.asphaltDriveway) MATERIALS.asphaltDriveway.color.setHex(0x1d2430);
            if (MATERIALS.curb) MATERIALS.curb.color.setHex(0x3b4758);
            if (MATERIALS.sidewalk) MATERIALS.sidewalk.color.setHex(0x262f3d);
            if (MATERIALS.lawn) MATERIALS.lawn.color.setHex(0x1f3624);
            if (MATERIALS.roadMarkingWhite) MATERIALS.roadMarkingWhite.color.setHex(0x7c8ca1);
            if (MATERIALS.roadMarkingYellow) MATERIALS.roadMarkingYellow.color.setHex(0x967228);
            if (MATERIALS.signWhite) MATERIALS.signWhite.color.setHex(0x7c8ca1);
            if (MATERIALS.trafficButtonYellow) MATERIALS.trafficButtonYellow.color.setHex(0x967228);
            if (MATERIALS.trafficButtonPlate) MATERIALS.trafficButtonPlate.color.setHex(0x967228);
            if (MATERIALS.shelterFrame) MATERIALS.shelterFrame.color.setHex(0x475569);
            if (MATERIALS.shelterFrameStainless) MATERIALS.shelterFrameStainless.color.setHex(0x475569);
            if (MATERIALS.shelterGlass) MATERIALS.shelterGlass.color.setHex(0x334459);
            if (MATERIALS.shelterRoof) MATERIALS.shelterRoof.color.setHex(0x384960);
            if (MATERIALS.shelterRoofGlass) MATERIALS.shelterRoofGlass.color.setHex(0x384960);
            if (MATERIALS.shelterBench) MATERIALS.shelterBench.color.setHex(0x853f18);
            if (MATERIALS.shelterBenchWood) MATERIALS.shelterBenchWood.color.setHex(0x853f18);
            if (MATERIALS.stainlessSteel) MATERIALS.stainlessSteel.color.setHex(0x4b5c73);
            if (MATERIALS.busTimetable) MATERIALS.busTimetable.color.setHex(0x7c8ca1);
            if (MATERIALS.trolleybusTimetable1) MATERIALS.trolleybusTimetable1.color.setHex(0x7c8ca1);
            if (MATERIALS.trolleybusTimetable2) MATERIALS.trolleybusTimetable2.color.setHex(0x7c8ca1);
            if (MATERIALS.treeFoliage) MATERIALS.treeFoliage.color.setHex(0x1e4620);
            if (MATERIALS.treeFoliageLight) MATERIALS.treeFoliageLight.color.setHex(0x255223);
            if (MATERIALS.birchBark) MATERIALS.birchBark.color.setHex(0x94a3b8);
            if (MATERIALS.birchFoliage) MATERIALS.birchFoliage.color.setHex(0x1e4620);
            if (MATERIALS.birchFoliageLight) MATERIALS.birchFoliageLight.color.setHex(0x255223);
            if (MATERIALS.lindenTrunk) MATERIALS.lindenTrunk.color.setHex(0x2c221a);
            if (MATERIALS.lindenFoliage) MATERIALS.lindenFoliage.color.setHex(0x224a1f);
            if (MATERIALS.lindenFoliageDark) MATERIALS.lindenFoliageDark.color.setHex(0x163415);
            if (MATERIALS.spruceTrunk) MATERIALS.spruceTrunk.color.setHex(0x2c1a12);
            if (MATERIALS.spruceNeedle) MATERIALS.spruceNeedle.color.setHex(0x183a1d);
            if (MATERIALS.spruceNeedleDark) MATERIALS.spruceNeedleDark.color.setHex(0x0f2613);
            if (MATERIALS.hedgeFoliage) MATERIALS.hedgeFoliage.color.setHex(0x1e3a24);
            if (MATERIALS.shrubFoliageDeciduous) MATERIALS.shrubFoliageDeciduous.color.setHex(0x1b4022);
            if (MATERIALS.shrubFoliageConifer) MATERIALS.shrubFoliageConifer.color.setHex(0x132e22);
            if (MATERIALS.soilMulch) MATERIALS.soilMulch.color.setHex(0x1f140e);
            if (MATERIALS.steleGranite) MATERIALS.steleGranite.color.setHex(0x242f3f);
            if (MATERIALS.forecourtPaverLight) MATERIALS.forecourtPaverLight.color.setHex(0x2c3646);
            if (MATERIALS.forecourtPaverDark) MATERIALS.forecourtPaverDark.color.setHex(0x202834);
            if (MATERIALS.campusBenchWood) MATERIALS.campusBenchWood.color.setHex(0x9a3412);
        } else {
            // Светлая тема:
            if (typeof updateBuildingColors === 'function') {
                updateBuildingColors();
            }
            if (MATERIALS.elevatorCar) MATERIALS.elevatorCar.color.setHex(0xcbd5e1);
            if (MATERIALS.doorThin) MATERIALS.doorThin.color.setHex(0x94a3b8);
            if (MATERIALS.edgeMain) MATERIALS.edgeMain.color.setHex(0x475569);
            if (MATERIALS.edgeDoor) MATERIALS.edgeDoor.color.setHex(0x64748b);
            if (MATERIALS.roof) MATERIALS.roof.color.setHex(0x94a3b8);
            if (MATERIALS.edgeRoof) MATERIALS.edgeRoof.color.setHex(0x475569);
            if (MATERIALS.guideLine) MATERIALS.guideLine.color.setHex(0x94a3b8);
            if (MATERIALS.minimalRoadSurface) MATERIALS.minimalRoadSurface.color.setHex(0xc8d1dc);
            if (MATERIALS.roadContourLine) MATERIALS.roadContourLine.color.setHex(0x334155);
            if (MATERIALS.roadCenterLine) MATERIALS.roadCenterLine.color.setHex(0x94a3b8);
            // Прилегающая территория в светлой теме
            if (MATERIALS.asphaltRoad) MATERIALS.asphaltRoad.color.setHex(0x334155);
            if (MATERIALS.asphaltDriveway) MATERIALS.asphaltDriveway.color.setHex(0x475569);
            if (MATERIALS.curb) MATERIALS.curb.color.setHex(0x64748b);
            if (MATERIALS.sidewalk) MATERIALS.sidewalk.color.setHex(0x94a3b8);
            if (MATERIALS.lawn) MATERIALS.lawn.color.setHex(0x387a3e);
            if (MATERIALS.roadMarkingWhite) MATERIALS.roadMarkingWhite.color.setHex(0xf8fafc);
            if (MATERIALS.roadMarkingYellow) MATERIALS.roadMarkingYellow.color.setHex(0xf59e0b);
            if (MATERIALS.signWhite) MATERIALS.signWhite.color.setHex(0xf8fafc);
            if (MATERIALS.trafficButtonYellow) MATERIALS.trafficButtonYellow.color.setHex(0xfacc15);
            if (MATERIALS.trafficButtonPlate) MATERIALS.trafficButtonPlate.color.setHex(0xfacc15);
            if (MATERIALS.shelterFrame) MATERIALS.shelterFrame.color.setHex(0xd4dce4);
            if (MATERIALS.shelterFrameStainless) MATERIALS.shelterFrameStainless.color.setHex(0xd4dce4);
            if (MATERIALS.shelterGlass) MATERIALS.shelterGlass.color.setHex(0xd8e8f0);
            if (MATERIALS.shelterRoof) MATERIALS.shelterRoof.color.setHex(0xd4e2ec);
            if (MATERIALS.shelterRoofGlass) MATERIALS.shelterRoofGlass.color.setHex(0xd4e2ec);
            if (MATERIALS.shelterBench) MATERIALS.shelterBench.color.setHex(0xb45309);
            if (MATERIALS.shelterBenchWood) MATERIALS.shelterBenchWood.color.setHex(0xb45309);
            if (MATERIALS.stainlessSteel) MATERIALS.stainlessSteel.color.setHex(0xdde4ec);
            if (MATERIALS.busTimetable) MATERIALS.busTimetable.color.setHex(0xffffff);
            if (MATERIALS.trolleybusTimetable1) MATERIALS.trolleybusTimetable1.color.setHex(0xffffff);
            if (MATERIALS.trolleybusTimetable2) MATERIALS.trolleybusTimetable2.color.setHex(0xffffff);
            if (MATERIALS.treeFoliage) MATERIALS.treeFoliage.color.setHex(0x22c55e);
            if (MATERIALS.treeFoliageLight) MATERIALS.treeFoliageLight.color.setHex(0x4ade80);
            if (MATERIALS.birchBark) MATERIALS.birchBark.color.setHex(0xf8fafc);
            if (MATERIALS.birchFoliage) MATERIALS.birchFoliage.color.setHex(0x529432);
            if (MATERIALS.birchFoliageLight) MATERIALS.birchFoliageLight.color.setHex(0x72b036);
            if (MATERIALS.lindenTrunk) MATERIALS.lindenTrunk.color.setHex(0x473322);
            if (MATERIALS.lindenFoliage) MATERIALS.lindenFoliage.color.setHex(0x2e6f2b);
            if (MATERIALS.lindenFoliageDark) MATERIALS.lindenFoliageDark.color.setHex(0x21521f);
            if (MATERIALS.spruceTrunk) MATERIALS.spruceTrunk.color.setHex(0x382419);
            if (MATERIALS.spruceNeedle) MATERIALS.spruceNeedle.color.setHex(0x184223);
            if (MATERIALS.spruceNeedleDark) MATERIALS.spruceNeedleDark.color.setHex(0x102e18);
            if (MATERIALS.hedgeFoliage) MATERIALS.hedgeFoliage.color.setHex(0x275e2c);
            if (MATERIALS.shrubFoliageDeciduous) MATERIALS.shrubFoliageDeciduous.color.setHex(0x2d5a27);
            if (MATERIALS.shrubFoliageConifer) MATERIALS.shrubFoliageConifer.color.setHex(0x234e3f);
            if (MATERIALS.soilMulch) MATERIALS.soilMulch.color.setHex(0x2a1d17);
            if (MATERIALS.steleGranite) MATERIALS.steleGranite.color.setHex(0x475569);
            if (MATERIALS.forecourtPaverLight) MATERIALS.forecourtPaverLight.color.setHex(0xf1f5f9);
            if (MATERIALS.forecourtPaverDark) MATERIALS.forecourtPaverDark.color.setHex(0x64748b);
            if (MATERIALS.campusBenchWood) MATERIALS.campusBenchWood.color.setHex(0xb45309);
        }
    }

    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', !isDark);
        moonIcon.classList.toggle('hidden', isDark);
    }

    if (shouldSave) {
        try {
            localStorage.setItem('mgkct_theme', themeName);
        } catch (_) {}
        if (typeof saveSettings === 'function') {
            saveSettings();
        }
    }

    if (typeof requestRender === 'function') {
        requestRender(30);
    }
}

// Автоматическое динамическое переключение темы при смене системной темы на телефоне / ПК
// (применяется только если пользователь явно не выбрал тему вручную)
if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
        let hasUserTheme = false;
        try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
        if (!hasUserTheme) {
            setTheme(e.matches ? 'dark' : 'light', false);
        }
    };
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSystemThemeChange);
    }

    // Проверка актуальной темы при возврате во вкладку / разблокировке телефона (только если нет ручного выбора)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            let hasUserTheme = false;
            try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
            if (!hasUserTheme) {
                setTheme(getSystemTheme(), false);
            }
        }
    });
    window.addEventListener('focus', () => {
        let hasUserTheme = false;
        try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
        if (!hasUserTheme) {
            setTheme(getSystemTheme(), false);
        }
    });
}
window.setTheme = setTheme;
