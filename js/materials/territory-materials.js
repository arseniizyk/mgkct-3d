// ============================================================================
// МАТЕРИАЛЫ ТЕРРИТОРИИ, РАСТИТЕЛЬНОСТИ, ДОРОГ И АСИНХРОННАЯ ЗАГРУЗКА ТАБЛИЧЕК
// ============================================================================
Object.assign(MATERIALS, {
    spruceTrunk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2c1a12 : 0x382419,
        roughness: 0.88,
        metalness: 0.02
    }),
    spruceNeedle: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x183a1d : 0x184223,
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    spruceNeedleDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x0f2613 : 0x102e18,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    hedgeFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e3a24 : 0x275e2c,
        roughness: 0.65,
        metalness: 0.02,
        side: THREE.DoubleSide
    }),
    soilMulch: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1f140e : 0x2a1d17,
        roughness: 0.95,
        metalness: 0.0
    }),
    shrubFoliageDeciduous: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1b4022 : 0x2d5a27,
        roughness: 0.75,
        metalness: 0.02,
        side: THREE.DoubleSide
    }),
    shrubFoliageConifer: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x132e22 : 0x234e3f,
        roughness: 0.85,
        metalness: 0.01,
        side: THREE.DoubleSide
    }),
    flowerBlossomWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.5,
        emissive: 0xffffff,
        emissiveIntensity: 0.12
    }),
    flowerBlossomGold: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.5,
        emissive: 0xd97706,
        emissiveIntensity: 0.15
    }),
    treeTrunk: new THREE.MeshStandardMaterial({
        color: 0x5b3a29,
        roughness: 0.9
    }),
    treeFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e4620 : 0x22c55e,
        roughness: 0.85,
        metalness: 0.0
    }),
    treeFoliageLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x255223 : 0x4ade80,
        roughness: 0.85,
        metalness: 0.0
    }),
    poleMetal: new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.7
    }),
    signBlue: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.4
    }),
    signRed: new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        roughness: 0.4
    }),
    signWhite: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x7c8ca1 : 0xf8fafc,
        roughness: 0.4
    }),

    // 5. Благоустройство (скамейки, урны, велопарковки, стела, плитка)
    campusBenchWood: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x9a3412 : 0xb45309,
        roughness: 0.44,
        metalness: 0.02,
        side: THREE.FrontSide
    }),
    campusBenchMetal: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.72
    }),
    campusWasteBinBody: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.34,
        metalness: 0.78
    }),
    bikeRackGalvanized: new THREE.MeshStandardMaterial({
        color: 0xdde4ec,
        roughness: 0.22,
        metalness: 0.88
    }),
    steleGranite: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1f2937 : 0x475569,
        roughness: 0.82,
        metalness: 0.06
    }),
    steleLogoPlaque: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.28,
        metalness: 0.18,
        emissive: 0x0369a1,
        emissiveIntensity: 0.30
    }),
    forecourtPaverLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2c3646 : 0xf1f5f9,
        roughness: 0.88,
        metalness: 0.03
    }),
    forecourtPaverDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x202834 : 0x64748b,
        roughness: 0.84,
        metalness: 0.05
    }),
    castIronDark: new THREE.MeshStandardMaterial({
        color: 0x1a202c,
        roughness: 0.58,
        metalness: 0.65
    }),
    reflectiveWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.15,
        metalness: 0.08,
        emissive: 0xf8fafc,
        emissiveIntensity: 0.22
    }),

    // 6. Светофоры и ограждение
    trafficHousing: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.15
    }),
    trafficRed: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficGreen: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficButtonYellow: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x967228 : 0xfacc15,
        roughness: 0.35,
        metalness: 0.05
    }),
    trafficButtonFace: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5
    }),
    trafficButtonChrome: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.85,
        roughness: 0.2
    }),
    trafficBackplate: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5,
        metalness: 0.1
    }),
    trafficPedRedMan: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.2
    }),
    trafficPedGreenMan: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.2
    }),
    trafficButtonPlate: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x967228 : 0xfacc15,
        roughness: 0.35,
        metalness: 0.05
    }),
    perimeterFence: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x0f172a : 0x1e293b,
        metalness: 0.75,
        roughness: 0.35
    })
});

// Экспорт в глобальный scope window
MATERIALS.trolleybusTimetable = MATERIALS.trolleybusTimetable1;
window.createMinimalTexture = createMinimalTexture;
window.createGlassFritTexture = createGlassFritTexture;
window.createBusTimetableTexture = createBusTimetableTexture;
window.createTrolleybusTimetableTexture = createTrolleybusTimetableTexture;
window.createTrolleybusTimetable1Texture = createTrolleybusTimetable1Texture;
window.createTrolleybusTimetable2Texture = createTrolleybusTimetable2Texture;
window.createBusStopSignTexture = createBusStopSignTexture;
window.createPedestrianSignTexture = createPedestrianSignTexture;
window.createBirchBarkTexture = createBirchBarkTexture;
window.createBirchBarkBumpMap = createBirchBarkBumpMap;
window.createLindenBarkTexture = createLindenBarkTexture;
window.createLindenFoliageTexture = createLindenFoliageTexture;
window.createSpruceBarkTexture = createSpruceBarkTexture;
window.createSpruceNeedleTexture = createSpruceNeedleTexture;
window.createHedgeFoliageTexture = createHedgeFoliageTexture;
window.createHedgeBumpTexture = createHedgeBumpTexture;
window.createSoilMulchTexture = createSoilMulchTexture;
window.createLawnTexture = createLawnTexture;
window.createCollegeSteleLogoTexture = createCollegeSteleLogoTexture;
window.createWoodPlankTexture = createWoodPlankTexture;
window.createWoodPlankBumpMap = createWoodPlankBumpMap;
window.createBrushedDarkMetalTexture = createBrushedDarkMetalTexture;
window.createBrushedMetalBumpMap = createBrushedMetalBumpMap;
window.createPaverTileTexture = createPaverTileTexture;
window.createPaverTileBumpMap = createPaverTileBumpMap;
window.createTrafficBackplateTexture = createTrafficBackplateTexture;
window.createPedestrianTrafficLensTexture = createPedestrianTrafficLensTexture;
window.createPedestrianButtonPlateTexture = createPedestrianButtonPlateTexture;
