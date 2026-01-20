import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { authGuard } from "./ui-core.js";

authGuard();

// --- STATE ---
let players = [];
let allMatches = [];
let currentUser = null;
let allUsersMap = {};
let equiposMap = {};

// --- ELO & LEVEL FORMULAS ---
function calcularPuntosPorVictoria(nivel) {
  return 30 - 13.5 * (nivel - 2.0);
}

function calcularPuntosParaSubir(nivel) {
  const t = (nivel - 2.0) / (4.0 - 2.0);
  const factor = 0.2 + (2.0 - 0.2) * Math.pow(t, 2);
  return calcularPuntosPorVictoria(nivel) * factor;
}

function calcularPuntosIniciales(nivel) {
  if (nivel <= 2.0) return 4.0;
  let puntos = 4.0;
  for (let n = 2.0; n < nivel; n += 0.01) {
    puntos += calcularPuntosParaSubir(n);
  }
  return puntos;
}

function calcularPuntosElo({
  jugador,
  rivales,
  companero,
  resultado,
  margen,
  experiencia,
  rachaActual = 0
}) {
  const factorProgresivo = 1 - ((jugador.nivel - 2.0) / 2.0) * 0.7;
  const baseBruta = resultado === "Victoria" ? 12.0 : -11.0;
  const base =
    resultado === "Victoria"
      ? Math.max(3, baseBruta * factorProgresivo)
      : Math.min(-3, baseBruta * (2 - factorProgresivo));

  const nivelRival =
    rivales.reduce((acc, r) => acc + (r.nivel || 2), 0) / rivales.length;
  const diferenciaNivel = nivelRival - jugador.nivel;
  
  // Underdog Bonus: Winning against higher level gives more, losing gives less penalty
  const factorDificultadRival = diferenciaNivel * 22.5 * factorProgresivo;

  let factorCompanero = 0;
  if (companero) {
    // If your partner is much better than you, you earn slightly less (carried)
    const diffCompanero = (companero.nivel || 2) - jugador.nivel;
    factorCompanero = -diffCompanero * 4.5 * factorProgresivo;
  }

  let factorMargen = 1.0;
  if (resultado === "Victoria") {
    if (margen >= 3) factorMargen = 1.9;
    else if (margen === 2) factorMargen = 1.5;
    else if (margen === 1) factorMargen = 1.15;
  } else {
    if (margen >= 3) factorMargen = 0.4;
    else if (margen === 2) factorMargen = 0.65;
    else if (margen === 1) factorMargen = 0.9;
  }

  const factorExperiencia = Math.min(1.5, 1 + experiencia * 0.01);
  
  // Winning Streak Bonus (only for victories)
  let bonoRacha = 0;
  if (resultado === "Victoria" && rachaActual >= 2) {
      bonoRacha = Math.min(15, rachaActual * 3.5); 
  }

  let points =
    (base + factorDificultadRival + factorCompanero) *
    factorMargen *
    factorExperiencia;
    
  if (resultado === "Victoria") points += bonoRacha;

  return {
    total: parseFloat(points.toFixed(2)),
    desglose: {
      "Base Partido": parseFloat(base.toFixed(1)),
      "Dificultad Rival": parseFloat(factorDificultadRival.toFixed(1)),
      "Balance Equipo": parseFloat(factorCompanero.toFixed(1)),
      "Racha Pro": parseFloat(bonoRacha.toFixed(1)),
      "Experiencia": parseFloat(((factorExperiencia - 1) * 10).toFixed(1)),
      "Bonus Sets": parseFloat(((factorMargen - 1) * 15).toFixed(1))
    },
  };
}

// --- INIT ---
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    initRanking();
  } else {
    window.location.href = "index.html";
  }
});

async function initRanking() {
  try {
    showLoadingState();

    // 1. Load all users - USE STORED DATA FROM FIRESTORE
    const usersSnap = await getDocs(collection(db, "usuarios"));
    allUsersMap = {};
    players = usersSnap.docs.map((doc) => {
      const d = doc.data();
      const p = {
        id: doc.id,
        nombre: d.nombreUsuario || d.nombre || "Jugador",
        foto: d.fotoPerfil || null,
        // READ FROM FIRESTORE (what ranking-service.js saved)
        nivel: parseFloat(d.nivel || 2.0),
        puntosRanking: parseFloat(d.puntosRankingTotal || d.puntosRanking || 0),
        partidosJugados: parseInt(d.partidosJugados || 0),
        victorias: parseInt(d.victorias || 0),
        derrotas: parseInt(d.derrotas || 0),
        rachaActual: parseInt(d.rachaActual || 0),
        mejorRacha: parseInt(d.mejorRacha || 0),
        historial: [],
      };
      allUsersMap[p.id] = p;
      return p;
    });

    // 2. Load Equipos
    const equiposSnap = await getDocs(collection(db, "equipos"));
    equiposSnap.docs.forEach((doc) => {
      equiposMap[doc.id] = doc.data();
    });

    // 3. Load ALL Matches from calendario
    const calendarioSnap = await getDocs(collection(db, "calendario"));
    allMatches = [];
    for (const jornadaDoc of calendarioSnap.docs) {
      const partidosSnap = await getDocs(
        collection(db, `calendario/${jornadaDoc.id}/partidos`),
      );
      partidosSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.resultado && data.equipoLocal && data.equipoVisitante) {
          allMatches.push({
            id: doc.id,
            ...data,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
            tipo: data.tipo || "liga",
            isTeam: true,
          });
        }
      });
    }

    // 4. Load individual matches
    const amSnap = await getDocs(collection(db, "partidosAmistosos"));
    const reSnap = await getDocs(collection(db, "partidosReto"));

    [...amSnap.docs, ...reSnap.docs].forEach((d) => {
      const data = d.data();
      if (data.estado === "jugado" && data.jugadores && data.resultado) {
        allMatches.push({
          id: d.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          tipo: data.tipo || "amistoso",
          isIndividual: true,
        });
      }
    });

    // Sort by date
    allMatches.sort((a, b) => a.fecha - b.fecha);

    console.log(
      `Loaded ${players.length} players and ${allMatches.length} matches`,
    );

    // Process matches chronologically
    processMatchesChronologically();
    renderRanking();
  } catch (e) {
    console.error("Init Error:", e);
    showErrorState();
  }
}

function processMatchesChronologically() {
  // ONLY BUILD HISTORIAL - DON'T RECALCULATE STATS (they're already in Firestore)
  allMatches.forEach((match, idx) => {
    try {
      if (match.isIndividual) {
        buildIndividualMatchHistory(match);
      } else if (match.isTeam) {
        processTeamMatch(match);
      }
    } catch (e) {
      console.error(`Error processing match ${idx}:`, e);
    }
  });
}

function buildIndividualMatchHistory(match) {
  const ids = match.jugadores;
  if (!ids || ids.length < 4) return;

  const resStr = match.resultado.sets || "";
  const parts = resStr.split(" ");
  let setsLocal = 0,
    setsVisit = 0;
  parts.forEach((p) => {
    const scores = p.split("-").map(Number);
    if (scores[0] > scores[1]) setsLocal++;
    else if (scores[1] > scores[0]) setsVisit++;
  });

  const winners = setsLocal > setsVisit ? [ids[0], ids[1]] : [ids[2], ids[3]];
  const scoreDiff = Math.abs(setsLocal - setsVisit);

  ids.forEach((uid, idx) => {
    const p = allUsersMap[uid];
    if (!p || uid.startsWith("GUEST_")) return;

    const isWin = winners.includes(uid);
    const teamIdx = idx < 2 ? 0 : 1;
    const myTeam = teamIdx === 0 ? [ids[0], ids[1]] : [ids[2], ids[3]];
    const opponents = teamIdx === 0 ? [ids[2], ids[3]] : [ids[0], ids[1]];

    const partnerId = myTeam.find((id) => id !== uid);
    const partner = allUsersMap[partnerId] || {
      nivel: 2.0,
      nombre: "Invitado",
    };
    const rivalObjs = opponents.map(
      (id) => allUsersMap[id] || { nivel: 2.0, nombre: "Invitado" },
    );

    // Calculate ELO for display only (don't update stats)
    const eloResult = calcularPuntosElo({
      jugador: { nivel: p.nivel },
      rivales: rivalObjs,
      companero: partner,
      resultado: isWin ? "Victoria" : "Derrota",
      margen: scoreDiff,
      experiencia: p.partidosJugados,
      rachaActual: p.rachaActual || 0
    });

    // ONLY save to historial - DON'T update stats
    p.historial.push({
      fecha: match.fecha,
      rivales: rivalObjs.map((r) => r.nombre).join(" & "),
      companero: partner.nombre,
      resultado: isWin ? "Victoria" : "Derrota",
      score: resStr,
      tipo: match.tipo,
      puntosGanados: eloResult.total,
      desglose: eloResult.desglose,
      nivelCambio: "same", // We don't recalculate, just show
    });
  });
}

function processTeamMatch(match) {
  // Similar logic but for team matches
  const equipoLocal = equiposMap[match.equipoLocal];
  const equipoVisitante = equiposMap[match.equipoVisitante];

  if (!equipoLocal || !equipoVisitante) return;
  if (!equipoLocal.jugadores || !equipoVisitante.jugadores) return;

  const jugadoresLocal = equipoLocal.jugadores
    .map((jid) => allUsersMap[jid])
    .filter(Boolean);
  const jugadoresVisitante = equipoVisitante.jugadores
    .map((jid) => allUsersMap[jid])
    .filter(Boolean);

  if (jugadoresLocal.length < 2 || jugadoresVisitante.length < 2) return;

  let setsLocal = 0, setsVisitante = 0;
  if (match.resultado) {
      Object.values(match.resultado).forEach((set) => {
        const p1 = parseInt(set.puntos1 || 0);
        const p2 = parseInt(set.puntos2 || 0);
        if (p1 === 0 && p2 === 0) return;
        if (p1 > p2) setsLocal++;
        else if (p2 > p1) setsVisitante++;
      });
  }

  const team1Wins = setsLocal > setsVisitante;
  const scoreStr = `${setsLocal}-${setsVisitante}`;
  const scoreDiff = Math.abs(setsLocal - setsVisitante);

  [...jugadoresLocal, ...jugadoresVisitante].forEach((player, idx) => {
    if (!player) return;

    const win = (idx < 2 && team1Wins) || (idx >= 2 && !team1Wins);
    const teamIdx = idx < 2 ? 0 : 1;
    const myTeam = teamIdx === 0 ? jugadoresLocal : jugadoresVisitante;
    const rivals = teamIdx === 0 ? jugadoresVisitante : jugadoresLocal;
    const companero = myTeam.find((j, i) =>
      idx < 2 ? i !== idx : i !== (idx - 2),
    );

    const nivelAntes = player.nivel;
    const puntosAntes = player.puntosRanking;

    const eloResult = calcularPuntosElo({
      jugador: { nivel: player.nivel },
      rivales: rivals,
      companero: companero,
      resultado: win ? "Victoria" : "Derrota",
      margen: scoreDiff,
      experiencia: player.partidosJugados,
    });

    player.partidosJugados++;
    if (win) {
      player.victorias++;
      player.rachaActual = Math.max(0, player.rachaActual) + 1;
    } else {
      player.derrotas++;
      player.rachaActual = Math.min(0, player.rachaActual) - 1;
    }
    player.mejorRacha = Math.max(player.mejorRacha, player.rachaActual);

    player.puntosRanking += eloResult.total;
    player.puntosRanking = Math.max(0, player.puntosRanking);

    let subioNivel = false, bajoNivel = false;
    while (player.puntosRanking >= calcularPuntosIniciales(player.nivel + 0.01) && player.nivel < 4.0) {
      player.nivel += 0.01;
      player.nivel = Math.round(player.nivel * 100) / 100;
      subioNivel = true;
    }
    while (player.puntosRanking < calcularPuntosIniciales(player.nivel) && player.nivel > 2.0) {
        player.nivel -= 0.01;
        player.nivel = Math.round(player.nivel * 100) / 100;
        bajoNivel = true;
    }

    if (!player.historial) player.historial = [];
    player.historial.push({
      fecha: match.fecha,
      rivales: rivals.map((r) => r.nombre).join(" & "),
      companero: companero ? companero.nombre : "-",
      resultado: win ? "Victoria" : "Derrota",
      score: scoreStr,
      tipo: "liga", // Team matches are league matches
      puntosGanados: eloResult.total,
      desglose: eloResult.desglose,
      nivelAntes,
      nivelDespues: player.nivel,
      puntosAntes,
      puntosDespues: player.puntosRanking,
      subioNivel,
      bajoNivel
    });
  });
}

// --- RENDERING ---
function renderRanking() {
  players.sort((a, b) => b.puntosRanking - a.puntosRanking);

  // Render compact podium (top 3)
  renderCompactPodium();

  // Render rest of players in the table
  renderRankingTable(players.slice(3));

  updateHeaderAvatar();
}

function renderRankingTable(playersList) {
  const tbody = document.getElementById("ranking-table-body");
  if (!tbody) return;

  if (playersList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; opacity:0.5">No hay más jugadores</td></tr>';
    return;
  }

  const startRank = 4;

  tbody.innerHTML = playersList.map((p, i) => {
    const rank = startRank + i;
    const isMe = currentUser && p.id === currentUser.uid;
    const initials = getUserInitials(p.nombre);
    const color = getUserColor(p.id);
    const winrate = p.partidosJugados > 0 ? Math.round((p.victorias / p.partidosJugados) * 100) : 0;
    
    // Rank Row Styling
    let rowClass = "";
    if (rank === 4) rowClass = "rank-row-4";
    else if (rank === 5) rowClass = "rank-row-5";
    else if (rank > 5 && rank <= 15) rowClass = "rank-group-10";
    else if (rank > 15 && rank <= 25) rowClass = "rank-group-20";
    else if (rank > 25 && rank <= 35) rowClass = "rank-group-30";
    
    if (isMe) rowClass += " me"; // prioritize 'me' if needed styling overrides

    // Indicator
    let changeIcon = '<i class="fas fa-minus rank-change-same"></i>';
    if (p.rachaActual > 0) changeIcon = '<i class="fas fa-caret-up rank-change-up"></i>';
    if (p.rachaActual < 0) changeIcon = '<i class="fas fa-caret-down rank-change-down"></i>';

    // Highlight row ID for scrolling
    const rowId = isMe ? 'current-user-rank-row' : `rank-row-${p.id}`;

    return `
      <tr id="${rowId}" class="${rowClass}" onclick="openUserModal('${p.id}')">
        <td class="col-rank">
            <div style="display:flex; flex-direction:column; align-items:center;">
                <span class="rank-val">#${rank}</span>
                ${changeIcon}
            </div>
        </td>
        <td class="col-user">
          <div class="user-cell">
            <div class="user-mini-avatar" style="background:${color}">${initials}</div>
            <div class="user-name-box">
              <span class="user-name-text">${p.nombre}</span>
              <span class="user-level-tag">LVL ${p.nivel.toFixed(2)}</span>
            </div>
          </div>
        </td>
        <td class="col-stats">
          <div class="stats-cell">
            <div class="stat-row">
              <span class="stat-pill"><i class="fas fa-play"></i> ${p.partidosJugados}</span>
              <span class="stat-pill"><i class="fas fa-percent"></i> ${winrate}%</span>
            </div>
            ${p.rachaActual !== 0 ? `
              <div class="stat-row" style="color:${p.rachaActual > 0 ? 'var(--success)' : 'var(--danger)'}">
                <i class="fas ${p.rachaActual > 0 ? 'fa-fire' : 'fa-snowflake'}"></i> ${Math.abs(p.rachaActual)} RACHA
              </div>
            ` : ''}
          </div>
        </td>
        <td class="col-points">
          <div class="pts-val">${Math.round(p.puntosRanking)}</div>
        </td>
      </tr>
    `;
  }).join('');

  // Scroll to user if exists
  setTimeout(() => {
      const myRow = document.getElementById('current-user-rank-row');
      if (myRow) {
          myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          myRow.style.animation = "pulse-highlight 2s infinite";
      }
      // Compact podium highlighting logic if user is top 3?
      // Not requested but good UX.
  }, 500);
}


function renderCompactPodium() {
  const top3 = players.slice(0, 3);

  top3.forEach((p, i) => {
    const pos = i + 1;
    const initials = getUserInitials(p.nombre);
    const color = getUserColor(p.id);

    const avatarEl = document.getElementById(`c-avatar-${pos}`);
    const nameEl = document.getElementById(`c-name-${pos}`);
    const ptsEl = document.getElementById(`c-pts-${pos}`);
    const placeEl = document.getElementById(`compact-${pos}`);

    if (avatarEl) {
      avatarEl.style.background = color;
      avatarEl.innerHTML = initials;
    }
    if (nameEl) nameEl.textContent = p.nombre.split(" ")[0];
    if (ptsEl) ptsEl.textContent = Math.round(p.puntosRanking);
    if (placeEl) {
      placeEl.onclick = () => openUserModal(p.id);
    }
  });
}



// Export function to get user ranking data for other pages
export function getUserRankingData(uid) {
  if (!allUsersMap[uid]) return null;
  const player = allUsersMap[uid];
  const position = players.findIndex((p) => p.id === uid) + 1;

  return {
    posicion: position,
    nivel: player.nivel,
    puntosRanking: player.puntosRanking,
    partidosJugados: player.partidosJugados,
    victorias: player.victorias,
    derrotas: player.derrotas,
    rachaActual: player.rachaActual,
    winrate:
      player.partidosJugados > 0
        ? Math.round((player.victorias / player.partidosJugados) * 100)
        : 0,
  };
}

// Make it available globally
window.getUserRankingData = getUserRankingData;

// --- MODAL ---
window.openUserModal = (uid) => {
  const p = allUsersMap[uid];
  if (!p) return;

  const modal = document.getElementById("user-details-modal");
  const summary = document.getElementById("modal-user-summary");
  const historyList = document.getElementById("modal-history-list");

  const initials = getUserInitials(p.nombre);
  const color = getUserColor(p.id);
  const winrate =
    p.partidosJugados > 0
      ? Math.round((p.victorias / p.partidosJugados) * 100)
      : 0;

  // Calculate current level progress
  const puntosMin = calcularPuntosIniciales(p.nivel);
  const puntosMax = calcularPuntosIniciales(p.nivel + 0.01);
  const progreso =
    ((p.puntosRanking - puntosMin) / (puntosMax - puntosMin)) * 100;

  summary.innerHTML = `
        <div class="user-avatar-modal" style="background:linear-gradient(135deg, ${color}, #000); color:#fff; border:2px solid ${color}">${initials}</div>
        <div class="user-meta-modal">
            <h2 class="text-shimmer" style="font-size:1.4rem; margin-bottom:0;">${p.nombre.toUpperCase()}</h2>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px;">MIEMBRO GALÁCTICO</div>
            
            <div class="stats-grid-modal" style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; margin-bottom:10px;">
                <div class="stat-box-modal glass-strong rounded p-2 text-center border-glass">
                    <i class="fas fa-layer-group text-accent mb-1"></i>
                    <div style="font-size:1.1rem; font-weight:800; line-height:1;">${p.nivel.toFixed(2)}</div>
                    <div style="font-size:0.5rem; opacity:0.6;">NIVEL</div>
                </div>
                <div class="stat-box-modal glass-strong rounded p-2 text-center border-glass">
                    <i class="fas fa-star text-warning mb-1"></i>
                    <div style="font-size:1.1rem; font-weight:800; line-height:1;">${Math.round(p.puntosRanking)}</div>
                    <div style="font-size:0.5rem; opacity:0.6;">PUNTOS</div>
                </div>
                <div class="stat-box-modal glass-strong rounded p-2 text-center border-glass">
                    <i class="fas fa-fire ${p.rachaActual > 0 ? 'text-success' : 'text-danger'} mb-1"></i>
                    <div style="font-size:1.1rem; font-weight:800; line-height:1;">${p.rachaActual > 0 ? '+' : ''}${p.rachaActual}</div>
                    <div style="font-size:0.5rem; opacity:0.6;">RACHA</div>
                </div>
            </div>

            <div class="level-progress-container" style="width:100%;">
                <div style="display:flex; justify-content:space-between; font-size:0.6rem; margin-bottom:3px; font-weight:700;">
                    <span>LVL ${p.nivel.toFixed(2)}</span>
                    <span>LVL ${(p.nivel + 0.01).toFixed(2)}</span>
                </div>
                <div class="level-progress-bar">
                    <div class="progress-fill" style="width:${progreso}%"></div>
                </div>
                <div style="text-align:center; font-size:0.65rem; color:var(--text-muted); margin-top:5px;">
                    <i class="fas fa-bolt text-warning"></i> ${Math.round(progreso)}% PARA ASCENSO
                </div>
            </div>
        </div>
    `;

  const hist = [...p.historial].sort((a, b) => b.fecha - a.fecha);

  if (hist.length === 0) {
    historyList.innerHTML =
      '<div style="text-align:center; padding:3rem; opacity:0.5"><i class="fas fa-history" style="font-size:2rem; margin-bottom:10px;"></i><p>Sin combate registrado.</p></div>';
  } else {
    historyList.innerHTML = hist
      .map((h, i) => {
        const isWin = h.resultado === "Victoria";
        // Calculate breakdown summary or just show indicator
        return `
                <div class="history-match-card-premium ${isWin ? 'win-glow' : 'loss-dim'}" onclick="toggleBreakdown(${i})" style="cursor:pointer; position:relative; overflow:hidden;">
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="result-icon-box ${isWin ? 'bg-success-soft' : 'bg-danger-soft'}" style="width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                <i class="fas ${isWin ? 'fa-trophy' : 'fa-skull'}" style="color:${isWin ? 'var(--success)' : 'var(--danger)'}"></i>
                            </div>
                            <div>
                                <div style="font-size:0.8rem; font-weight:800; letter-spacing:0.5px; color:#fff;">${isWin ? "VICTORIA" : "DERROTA"}</div>
                                <div style="font-size:0.65rem; color:var(--text-muted); display:flex; gap:6px; align-items:center;">
                                    <span>${h.fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase()}</span>
                                    <span style="width:3px; height:3px; background:var(--text-muted); border-radius:50%;"></span>
                                    <span>${h.tipo.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                             <div class="pts-pill-mini ${h.puntosGanados >= 0 ? 'good' : 'bad'}" style="font-size:0.85rem; font-weight:800;">
                                ${h.puntosGanados >= 0 ? "+" : ""}${h.puntosGanados.toFixed(1)} <span style="font-size:0.6rem">PTS</span>
                             </div>
                        </div>
                    </div>
                    
                    <!-- Collapsible Section -->
                    <div class="breakdown-slide" id="breakdown-${i}" style="display:none; background:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.05); padding:10px 15px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.7rem;">
                             <div class="text-muted"><i class="fas fa-users"></i> VS ${h.rivales}</div>
                             <div class="text-muted"><i class="fas fa-handshake"></i> ${h.companero || '---'}</div>
                        </div>
                        <div class="stats-mini-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.65rem;">
                            ${Object.entries(h.desglose).map(([k, v]) => `
                                <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.02); padding:2px 6px; border-radius:4px;">
                                    <span style="opacity:0.6; text-transform:uppercase;">${k}</span>
                                    <span style="font-weight:700; color:${v >= 0 ? 'var(--success)' : 'var(--danger)'}">${v > 0 ? '+' : ''}${v}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="level-change-row mt-2" style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px;">
                            <div class="badge badge-outline text-2xs">SCORE: ${h.score}</div>
                            <div style="font-size:0.65rem; font-weight:700;">
                                ${(h.nivelAntes || 0).toFixed(2)} 
                                <i class="fas fa-long-arrow-alt-right opacity-50 mx-1"></i> 
                                <span style="color:${h.subioNivel ? 'var(--success)' : (h.bajoNivel ? 'var(--danger)' : '#fff')}">${(h.nivelDespues || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  modal.classList.add("active");
};

window.closeUserModal = () => {
  document.getElementById("user-details-modal").classList.remove("active");
};

window.toggleBreakdown = (i) => {
  const box = document.getElementById(`breakdown-${i}`);
  const chevron = document.getElementById(`chevron-${i}`);
  if (box.style.display === "block") {
    box.style.display = "none";
    if (chevron) chevron.style.transform = "rotate(0deg)";
  } else {
    box.style.display = "block";
    if (chevron) chevron.style.transform = "rotate(180deg)";
  }
};

// --- UTILS ---
function getUserInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function getUserColor(uid) {
  if (!uid) return "#FF6B35";
  const colors = [
    "#FF6B35",
    "#00C3FF",
    "#8A2BE2",
    "#00FA9A",
    "#FF007F",
    "#FFD700",
    "#FF4500",
    "#1E90FF",
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++)
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function updateHeaderAvatar() {
  const headerAvatar = document.getElementById("header-avatar-container");
  if (headerAvatar && currentUser) {
    const me = allUsersMap[currentUser.uid];
    if (me) {
      const ini = getUserInitials(me.nombre);
      const col = getUserColor(me.id);
      headerAvatar.innerHTML = `<div class="player-avatar" style="background:${col}; width:34px; height:34px; font-size:0.8rem">${ini}</div>`;
      headerAvatar.onclick = () => (window.location.href = "perfil.html");
    }
  }
}

function showLoadingState() {
  // Handled by tiers
}

function showErrorState() {
  const tbody = document.getElementById("ranking-tbody");
  if (tbody)
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--primary)">Error cargando datos</td></tr>';
}
