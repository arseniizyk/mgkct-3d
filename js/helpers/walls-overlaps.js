// Сопряжение Т-образных, крестообразных и Г-образных стыков + финальный де-оверлап боксов стен и дверей
function solveWallOrthogonalIntersections(solved, wallContinuesThrough) {
    // Разделение стен по ориентации для исключения избыточных парных проверок
    const hWalls = [];
    const vWalls = [];
    for (let idx = 0; idx < solved.length; idx++) {
        if (solved[idx].isHorizontal) hWalls.push(solved[idx]);
        else vWalls.push(solved[idx]);
    }

    for (let i = 0; i < hWalls.length; i++) {
        const A = hWalls[i];
        for (let j = 0; j < vWalls.length; j++) {
            const B = vWalls[j];

            const x0 = B.fixedCoord;
                const z0 = A.fixedCoord;

                const xInA = (x0 >= A.origC1 - 0.06 && x0 <= A.origC2 + 0.06);
                const zInB = (z0 >= B.origC1 - 0.06 && z0 <= B.origC2 + 0.06);

                if (xInA && zInB) {
                    const atAStart = Math.abs(x0 - A.origC1) <= 0.06;
                    const atAEnd = Math.abs(x0 - A.origC2) <= 0.06;
                    const aContinues = !atAStart && !atAEnd || !!wallContinuesThrough(A.fixedCoord, x0, true);

                    const atBStart = Math.abs(z0 - B.origC1) <= 0.06;
                    const atBEnd = Math.abs(z0 - B.origC2) <= 0.06;
                    const bContinues = !atBStart && !atBEnd || !!wallContinuesThrough(B.fixedCoord, z0, false);

                    if (!aContinues && bContinues) {
                        // Т-образный стык: стена A упирается в проходящую стену B
                        if (atAStart) {
                            A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                            A.omitStartCap = true;
                        } else if (atAEnd) {
                            A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                            A.omitEndCap = true;
                        }
                    } else if (aContinues && !bContinues) {
                        // Т-образный стык: стена B упирается в проходящую стену A
                        if (atBStart) {
                            B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                            B.omitStartCap = true;
                        } else if (atBEnd) {
                            B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                            B.omitEndCap = true;
                        }
                    } else if (aContinues && bContinues) {
                        // Крестообразный стык или стык составных стен
                        if (atAEnd || atAStart) {
                            if (atAStart) {
                                A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                                A.omitStartCap = true;
                            } else if (atAEnd) {
                                A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                                A.omitEndCap = true;
                            }
                        } else if (atBEnd || atBStart) {
                            if (atBStart) {
                                B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                                B.omitStartCap = true;
                            } else if (atBEnd) {
                                B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                                B.omitEndCap = true;
                            }
                        }
                    } else if (!aContinues && !bContinues) {
                        // Г-образный угол: сопряжение двух сходящихся стен
                        let aIsPrimary = true;
                        const bldg2StartX = (typeof B2_X_START !== 'undefined') ? B2_X_START : 20.4;
                        if (Math.abs(B.fixedCoord - bldg2StartX) < 0.05) {
                            // На границе с Корпусом 2 (B2_X_START = 20.4) вертикальная стена приоритетна, чтобы горизонтальные стены не заходили за X = 20.28
                            aIsPrimary = false;
                        } else if (A.isExterior !== B.isExterior) {
                            aIsPrimary = A.isExterior;
                        } else if (Math.abs(A.thickness - B.thickness) > 0.01) {
                            aIsPrimary = A.thickness > B.thickness;
                        }

                        if (aIsPrimary) {
                            if (atAStart) {
                                A.c1 = Math.min(A.c1, x0 - B.thickness / 2);
                            } else {
                                A.c2 = Math.max(A.c2, x0 + B.thickness / 2);
                            }
                            if (atBStart) {
                                B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                                B.omitStartCap = true;
                            } else {
                                B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                                B.omitEndCap = true;
                            }
                        } else {
                            if (atBStart) {
                                B.c1 = Math.min(B.c1, z0 - A.thickness / 2);
                            } else {
                                B.c2 = Math.max(B.c2, z0 + A.thickness / 2);
                            }
                            if (atAStart) {
                                A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                                A.omitStartCap = true;
                            } else {
                                A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                                A.omitEndCap = true;
                            }
                        }
                    }
                }
            }
        }
}

function resolveWallOverlapsAndDoors(solved, solvedDoors, id) {
    let overlapChanged = true;
    let overlapPasses = 0;
    while (overlapChanged && overlapPasses < 5) {
        overlapChanged = false;
        overlapPasses++;
        const toAdd = [];
        const currentLen = solved.length;
        for (let i = 0; i < currentLen; i++) {
            const A = solved[i];
            if (A.c2 - A.c1 <= 0.01) continue;
            for (let j = 0; j < currentLen; j++) {
                if (i === j) continue;
                const B = solved[j];
                if (B.c2 - B.c1 <= 0.01) continue;
                if (A.isHorizontal && !B.isHorizontal) {
                    const ax1 = A.c1, ax2 = A.c2;
                    const az1 = A.fixedCoord - A.thickness / 2, az2 = A.fixedCoord + A.thickness / 2;
                    const bx1 = B.fixedCoord - B.thickness / 2, bx2 = B.fixedCoord + B.thickness / 2;
                    const bz1 = B.c1, bz2 = B.c2;
                    const ox = Math.min(ax2, bx2) - Math.max(ax1, bx1);
                    const oz = Math.min(az2, bz2) - Math.max(az1, bz1);
                    if (ox > 0.001 && oz > 0.001) {
                        if (Math.abs(A.c2 - B.fixedCoord) <= B.thickness + 0.05) {
                            A.c2 = Math.min(A.c2, bx1);
                            A.omitEndCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(A.c1 - B.fixedCoord) <= B.thickness + 0.05) {
                            A.c1 = Math.max(A.c1, bx2);
                            A.omitStartCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(B.c2 - A.fixedCoord) <= A.thickness + 0.05) {
                            B.c2 = Math.min(B.c2, az1);
                            B.omitEndCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(B.c1 - A.fixedCoord) <= A.thickness + 0.05) {
                            B.c1 = Math.max(B.c1, az2);
                            B.omitStartCap = true;
                            overlapChanged = true;
                        } else if (B.thickness <= A.thickness && B.c1 < az1 && B.c2 > az2) {
                            const tailC2 = B.c2;
                            const tailOmitEnd = B.omitEndCap;
                            B.c2 = az1;
                            B.omitEndCap = true;
                            toAdd.push({
                                ...B,
                                id: id++,
                                c1: az2,
                                c2: tailC2,
                                origC1: az2,
                                origC2: tailC2,
                                omitStartCap: true,
                                omitEndCap: tailOmitEnd
                            });
                            overlapChanged = true;
                        } else if (A.c1 < bx1 && A.c2 > bx2) {
                            const tailC2 = A.c2;
                            const tailOmitEnd = A.omitEndCap;
                            A.c2 = bx1;
                            A.omitEndCap = true;
                            toAdd.push({
                                ...A,
                                id: id++,
                                c1: bx2,
                                c2: tailC2,
                                origC1: bx2,
                                origC2: tailC2,
                                omitStartCap: true,
                                omitEndCap: tailOmitEnd
                            });
                            overlapChanged = true;
                        }
                    }
                }
            }
        }
        if (toAdd.length > 0) {
            for (let k = 0; k < toAdd.length; k++) {
                solved.push(toAdd[k]);
            }
        }
    }

    // Подрезка дверных полотен, примыкающих к перпендикулярным или продольным стенам
    for (let i = 0; i < solvedDoors.length; i++) {
        const D = solvedDoors[i];
        for (let j = 0; j < solved.length; j++) {
            const W = solved[j];

            // 1. Перпендикулярное пересечение двери со стеной
            if (D.isHorizontal !== W.isHorizontal) {
                const dCoord = D.fixedCoord; // координата линии двери
                const wCoord = W.fixedCoord; // координата линии стены

                const wInD = (wCoord >= D.origC1 - 0.05 && wCoord <= D.origC2 + 0.05);
                const dInW = (dCoord >= W.origC1 - 0.05 && dCoord <= W.origC2 + 0.05);

                if (wInD && dInW) {
                    if (Math.abs(wCoord - D.origC1) <= W.thickness / 2 + 0.08) {
                        D.c1 = Math.max(D.c1, wCoord + W.thickness / 2);
                    } else if (Math.abs(wCoord - D.origC2) <= W.thickness / 2 + 0.08) {
                        D.c2 = Math.min(D.c2, wCoord - W.thickness / 2);
                    }
                }
            }
            // 2. Параллельное или продольное наложение
            else if (Math.abs(D.fixedCoord - W.fixedCoord) <= (D.thickness + W.thickness) / 2 - 0.02) {
                const oStart = Math.max(D.origC1, W.origC1);
                const oEnd = Math.min(D.origC2, W.origC2);
                if (oEnd - oStart > 0.02) {
                    if (D.origC1 < oStart) {
                        D.c2 = Math.min(D.c2, oStart);
                    } else if (D.origC2 > oEnd) {
                        D.c1 = Math.max(D.c1, oEnd);
                    }
                }
            }
        }
    }

    // Исключаем микроскопические осколки стен (< 4 см), остающиеся при наложении дверных коробок
    const validWalls = solved.filter(w => (w.c2 - w.c1) > 0.04);
    const validDoors = solvedDoors.filter(d => (d.c2 - d.c1) > 0.05);
    return [...validWalls, ...validDoors];
}
