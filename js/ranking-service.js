import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { createNotification } from './notifications-service.js';

// --- ELO FORMULA (The "Spectacular" one) ---

export function calcularPuntosElo({ jugador, rivales, companero, resultado, margen, experiencia, racha }) {
    const factorProgresivo = 1 - ((jugador.nivel - 2.0) / 2.0) * 0.7;
    const baseBruta = resultado === 'Victoria' ? 12.0 : -11.0;
    const base = resultado === 'Victoria' 
        ? Math.max(3, baseBruta * factorProgresivo) 
        : Math.min(-3, baseBruta * (2 - factorProgresivo));

    const nivelRival = rivales.reduce((acc, r) => acc + (r.nivel || 2), 0) / rivales.length;
    const diferenciaNivel = nivelRival - jugador.nivel;
    const factorDificultadRival = diferenciaNivel * 22.5 * factorProgresivo;

    let factorCompanero = 0;
    if (companero) {
        const diffCompanero = (companero.nivel || 2) - jugador.nivel;
        factorCompanero = -diffCompanero * 4.5 * factorProgresivo;
    }

    let factorMargen = 1.0;
    if (resultado === 'Victoria') {
        if (margen >= 3) factorMargen = 1.9;
        else if (margen === 2) factorMargen = 1.5;
        else if (margen === 1) factorMargen = 1.15;
    } else {
        if (margen >= 3) factorMargen = 0.4;
        else if (margen === 2) factorMargen = 0.65;
        else if (margen === 1) factorMargen = 0.9;
    }

    const factorExperiencia = Math.min(1.5, 1 + (experiencia * 0.01));
    
    let bonoRacha = 0;
    if (resultado === 'Victoria' && racha >= 2) {
        bonoRacha = Math.min(15, racha * 3.5);
    }

    let points = (base + factorDificultadRival + factorCompanero) * factorMargen * factorExperiencia;
    
    if (resultado === 'Victoria') points += bonoRacha;
    
    return parseFloat(points.toFixed(2));
}

/**
 * Updates a user's points and level in Firestore based on a match result.
 */
export async function updatePlayerPoints(uid, matchData, isWin, resultStr) {
    if (!uid || uid.startsWith('GUEST_')) return;

    try {
        const userRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const currentNivel = parseFloat(userData.nivel || 2.0);
        const currentPoints = parseFloat(userData.puntosRankingTotal || 0);
        const pj = parseInt(userData.partidosJugados || 0);

        // Get rivals and partner levels (simplified for now or passed from caller)
        // For now, let's assume we pass the necessary data
        const { rivales, companero, margen } = matchData;

        const puntosGanados = calcularPuntosElo({
            jugador: { nivel: currentNivel },
            rivales: rivales,
            companero: companero,
            resultado: isWin ? 'Victoria' : 'Derrota',
            margen: margen,
            experiencia: pj,
            racha: 0
        });

        const newPoints = currentPoints + puntosGanados;
        
        // Basic Level Up Logic (if points exceed thresholds)
        // This should probably be more sophisticated, but for now:
        let newNivel = currentNivel;
        // Example: Every 500 points = +0.05 level? (Just placeholder logic)
        // Usually level is manual or based on a specific curve.
        
        await updateDoc(userRef, {
            puntosRankingTotal: newPoints,
            partidosJugados: increment(1),
            victorias: isWin ? increment(1) : increment(0),
            derrotas: isWin ? increment(0) : increment(1)
        });

        console.log(`Updated points for ${uid}: ${puntosGanados}`);
        return puntosGanados;
    } catch (e) {
        console.error("Error updating player points:", e);
    }
}

/**
 * High-level function to process a match result and update all participants.
 */
export async function processMatchResults(matchId, type, resStr) {
    try {
        const matchRef = doc(db, type === 'reto' ? 'partidosReto' : 'partidosAmistosos', matchId);
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) return;
        const match = matchSnap.data();

        const ids = match.jugadores;
        if (ids.length < 4) return;

        // Parse sets
        const parts = resStr.split(' ');
        let setsLocal = 0, setsVisit = 0;
        parts.forEach(p => {
            const scores = p.split('-').map(Number);
            if (scores[0] > scores[1]) setsLocal++; 
            else if (scores[1] > scores[0]) setsVisit++;
        });

        const winners = setsLocal > setsVisit ? [ids[0], ids[1]] : [ids[2], ids[3]];
        const scoreDiff = Math.abs(setsLocal - setsVisit);

        // Fetch all 4 players to have their current levels
        const playerSnaps = await Promise.all(ids.map(id => getDoc(doc(db, "usuarios", id))));
        const playerMap = {};
        playerSnaps.forEach(s => {
            if (s.exists()) playerMap[s.id] = s.data();
        });

        // Update each player
        for (let i = 0; i < ids.length; i++) {
            const uid = ids[i];
            const pData = playerMap[uid];
            if (!pData || uid.startsWith('GUEST_')) continue;

            const isWin = winners.includes(uid);
            const teamIdx = i < 2 ? 0 : 1;
            const myTeam = teamIdx === 0 ? [ids[0], ids[1]] : [ids[2], ids[3]];
            const opponents = teamIdx === 0 ? [ids[2], ids[3]] : [ids[0], ids[1]];
            
            const partnerId = myTeam.find(id => id !== uid);
            const partnerData = playerMap[partnerId] || { nivel: 2.0 };
            const rivalData = opponents.map(id => playerMap[id] || { nivel: 2.0 });

            const pts = calcularPuntosElo({
                jugador: { nivel: parseFloat(pData.nivel || 2.0) },
                rivales: rivalData,
                companero: { nivel: parseFloat(partnerData.nivel || 2.0) },
                resultado: isWin ? 'Victoria' : 'Derrota',
                margen: scoreDiff,
                experiencia: parseInt(pData.partidosJugados || 0),
                racha: parseInt(pData.rachaActual || 0)
            });

            const currentTotal = parseFloat(pData.puntosRankingTotal || 4.0);
            const newTotal = Math.max(0, currentTotal + pts);

            // Re-calculate Level based on the "Spectacular" curve
            let newLevel = parseFloat(pData.nivel || 2.0);
            
            // Check if level needs to increase
            while (newTotal >= calcularPuntosIniciales(newLevel + 0.01) && newLevel < 4.0) {
                newLevel += 0.01;
                newLevel = Math.round(newLevel * 100) / 100;
            }
            // Check if level needs to decrease
            while (newTotal < calcularPuntosIniciales(newLevel) && newLevel > 2.0) {
                newLevel -= 0.01;
                newLevel = Math.round(newLevel * 100) / 100;
            }

            // Calculate new racha (streak)
            const currentRacha = parseInt(pData.rachaActual || 0);
            let newRacha = 0;
            if (isWin) {
                newRacha = currentRacha >= 0 ? currentRacha + 1 : 1;
            } else {
                newRacha = currentRacha <= 0 ? currentRacha - 1 : -1;
            }

            // Update User Doc with ALL fields
            await updateDoc(doc(db, "usuarios", uid), {
                puntosRankingTotal: newTotal,
                puntosRanking: newTotal, // Also update this for compatibility
                nivel: newLevel,
                partidosJugados: increment(1),
                victorias: isWin ? increment(1) : increment(0),
                derrotas: isWin ? increment(0) : increment(1),
                rachaActual: newRacha,
                mejorRacha: newRacha > (pData.mejorRacha || 0) ? newRacha : (pData.mejorRacha || 0),
                ultimaActualizacion: new Date()
            });

            // Notification for Points
            const ptsSign = pts >= 0 ? '+' : '';
            const msg = `Pts: ${ptsSign}${pts.toFixed(1)} | Racha: ${newRacha}`;
            await createNotification(uid, "Actualización Ranking", msg, pts >= 0 ? 'success' : 'warning', 'puntosRanking.html');

            if (newLevel > parseFloat(pData.nivel || 2.0)) {
                await createNotification(uid, "¡SUBIDA DE NIVEL!", `Ascenso a NV ${newLevel.toFixed(2)}`, 'rank_up', 'puntosRanking.html');
            }

            // If it's the current user, show spectacular toasts
            if (uid === auth.currentUser?.uid) {
                if (newLevel > parseFloat(pData.nivel || 2.0)) {
                    if (window.showToast) window.showToast('¡SUBIDA DE NIVEL!', `Has alcanzado el nivel ${newLevel.toFixed(2)}`, 'success');
                } else if (newLevel < parseFloat(pData.nivel || 2.0)) {
                    if (window.showToast) window.showToast('NIVEL AJUSTADO', `Tu nuevo nivel es ${newLevel.toFixed(2)}`, 'warning');
                }

                if (window.showToast) {
                    const diff = pts.toFixed(1);
                    window.showToast('PUNTOS ACTUALIZADOS', `${pts >= 0 ? ' Ganaste ' : ' Perdiste '}${Math.abs(diff)} puntos en el Ranking`, pts >= 0 ? 'success' : 'error');
                }
            }

            console.log(`✅ Updated ${uid}: ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} pts, Level ${newLevel.toFixed(2)}, Racha ${newRacha}`);
        }
        
        return true;
    } catch (e) {
        console.error("Error in processMatchResults:", e);
        return false;
    }
}

// Support functions for level threshold calculation
function calcularPuntosParaSubir(nivel) {
    const t = (nivel - 2.00) / (4.00 - 2.00);
    const factor = 0.20 + (2.0 - 0.20) * Math.pow(t, 2);
    return (30 - 13.5 * (nivel - 2.00)) * factor;
}

function calcularPuntosIniciales(nivel) {
    if (nivel <= 2.00) return 4.0;
    let puntos = 4.0;
    for (let n = 2.00; n < nivel; n += 0.01) {
        puntos += calcularPuntosParaSubir(n);
    }
    return puntos;
}
