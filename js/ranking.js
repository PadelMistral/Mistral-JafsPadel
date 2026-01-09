import { db, auth } from './firebase-config.js';
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { authGuard, initSharedUI, renderAvatarShared } from './ui-core.js';

authGuard();
initSharedUI('RANKING');

// --- STATE ---
let players = [];
let currentUser = null;
let allUsersMap = {};

// --- INIT ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        initRanking();
    } else {
        window.location.href = 'index.html';
    }
});

async function initRanking() {
    try {
        showLoadingState();
        
        const usersSnap = await getDocs(collection(db, "usuarios"));
        allUsersMap = {};
        players = usersSnap.docs.map(doc => {
            const d = doc.data();
            const p = {
                id: doc.id,
                ...d,
                nombre: d.nombreUsuario || d.nombre || 'Jugador',
                nivel: parseFloat(d.nivel || 2.0),
                puntosRanking: parseFloat(d.puntosRankingTotal || d.puntosRanking || 0),
                partidosJugados: parseInt(d.partidosJugados || 0),
                victorias: parseInt(d.victorias || 0),
                derrotas: parseInt(d.derrotas || 0),
                rachaActual: parseInt(d.rachaActual || 0)
            };
            allUsersMap[p.id] = p;
            return p;
        });

        console.log(`Loaded ${players.length} players for ranking.`);
        renderRanking();
        
    } catch (e) {
        console.error("Init Error:", e);
        showErrorState();
    }
}

// --- RENDERING ---
function renderRanking() {
    const listContainer = document.getElementById('ranking-list');
    const podiumContainer = document.getElementById('ranking-podium');
    if (!listContainer) return;

    // Filter valid and sort
    const validPlayers = players.filter(p => !isNaN(p.puntosRanking));
    validPlayers.sort((a, b) => b.puntosRanking - a.puntosRanking);
    
    // 1. Render Podium (Top 3)
    if (podiumContainer) {
        const top3 = validPlayers.slice(0, 3);
        renderPodium(top3, podiumContainer);
    }

    // 2. Render List (Exclude Top 3)
    listContainer.innerHTML = '';
    
    const listPlayers = validPlayers.slice(3);
    
    listPlayers.forEach((u, index) => {
        const rank = index + 4;
        const isMe = currentUser && u.id === currentUser.uid;
        const pts = Math.round(u.puntosRanking);
        
        let rowClass = `league-row animate-up ${isMe ? 'me' : ''}`;
        if (rank <= 10) rowClass += ' rank-top10';

        const row = document.createElement('div');
        row.className = rowClass;
        row.style.animationDelay = `${index * 0.03}s`;
        row.onclick = () => window.openUserModal(u.id);
        
        const avatarHtml = renderAvatarShared(u.id, u, 'sm');
        
        row.innerHTML = `
            <div class="lr-rank">${rank}</div>
            <div class="lr-player">
                <div class="lr-avatar-outer">${avatarHtml}</div>
                <div class="lr-info">
                    <span class="lr-name">${u.nombreUsuario || u.nombre || 'Jugador'}</span>
                    <div class="lr-stats-row flex align-center gap-2">
                         <span class="stat-pill racha ${u.rachaActual >= 0 ? 'hot' : 'cold'}">
                            ${u.rachaActual >= 0 ? '<i class="fas fa-fire"></i> ' + u.rachaActual : '<i class="fas fa-snowflake"></i> ' + Math.abs(u.rachaActual)}
                         </span>
                         <span class="stat-pill lvl">LVL ${u.nivel?.toFixed(2) || '2.00'}</span>
                    </div>
                </div>
            </div>
            <div class="lr-pts">${pts}</div>
        `;

        listContainer.appendChild(row);
    });
}

function renderPodium(top3, container) {
    container.innerHTML = '';
    const displayIndices = [1, 0, 2]; 
    
    displayIndices.forEach(idx => {
        const p = top3[idx];
        if (!p) return;
        
        const rank = idx + 1;
        const item = document.createElement('div');
        item.className = `podium-item rank-${rank} animate-up`;
        item.style.animationDelay = `${idx * 0.1}s`;
        item.onclick = () => window.openUserModal(p.id);

        item.innerHTML = `
            <div class="podium-avatar-wrap">
                <div class="podium-avatar">
                    ${renderAvatarShared(p.id, p, rank === 1 ? 'lg' : 'md')}
                </div>
                <div class="podium-rank-badge">${rank}</div>
            </div>
            <div class="podium-name">${p.nombreUsuario || p.nombre}</div>
            <div class="podium-pts">${Math.round(p.puntosRanking)} ELO</div>
        `;
        container.appendChild(item);
    });
}

// --- MODAL & HISTORY ---
window.openUserModal = async (uid) => {
    const p = allUsersMap[uid];
    if (!p) return;

    const modal = document.getElementById('user-details-modal');
    const summary = document.getElementById('modal-user-summary');
    const historyList = document.getElementById('modal-history-list');

    const photo = p.fotoPerfil || p.fotoURL;
    const initials = (p.nombreUsuario || p.nombre || 'U').substring(0, 2).toUpperCase();
    const imgHtml = photo 
        ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` 
        : initials;

    const puntosActuales = p.puntosRanking || 0;
    const nivelActual = p.nivel || 2.0;
    const threshActual = calcularPuntosIniciales(Math.floor(nivelActual * 100) / 100);
    const threshNext = calcularPuntosIniciales((Math.floor(nivelActual * 100) / 100) + 0.01);
    const progress = Math.max(0, Math.min(100, ((puntosActuales - threshActual) / (threshNext - threshActual)) * 100));

    summary.innerHTML = `
        <div class="flex-column align-center">
            <div class="p-avatar-shared lg mb-3" style="background:${photo ? '#000' : getUserColor(p.id)}; border: 2px solid var(--primary);">
                ${imgHtml}
            </div>
            <h3 class="font-rajdhani font-bold text-xl mb-1">${p.nombreUsuario || p.nombre}</h3>
            <div class="flex-center gap-3 mb-3">
                <span class="badge" style="background:rgba(255,107,53,0.1); color:var(--primary)">${p.partidosJugados || 0} PARTIDOS</span>
                <span class="badge" style="background:rgba(0,195,255,0.1); color:var(--accent)">LVL ${p.nivel?.toFixed(2) || '2.00'}</span>
            </div>
            <div class="w-100 p-2 glass-light rounded-xl">
                <div class="flex-between text-2xs mb-1 px-1">
                    <span>PROGRESO NIVEL</span>
                    <span>${progress.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                </div>
            </div>
        </div>
    `;

    historyList.innerHTML = '<div class="p-5 text-center"><div class="loader-ring"></div></div>';
    modal.classList.add('active');

    try {
        const collections = ['partidosAmistosos', 'partidosReto'];
        const matches = [];
        for (const col of collections) {
            const qMatches = query(collection(db, col), where("jugadores", "array-contains", uid), where("estado", "==", "jugado"), limit(10));
            const snap = await getDocs(qMatches);
            snap.forEach(d => matches.push({ id: d.id, ...d.data(), type: col.includes('Reto') ? 'RETO' : 'AMISTOSO' }));
        }
        
        matches.sort((a,b) => (b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha)) - (a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha)));
        
        if(matches.length === 0) {
            historyList.innerHTML = '<div class="p-5 text-center opacity-50">Sin partidos registrados.</div>';
        } else {
            historyList.innerHTML = matches.map((m, i) => generateHistoryItemDetail(m, i, uid)).join('');
        }
    } catch(e) {
        console.error(e);
        historyList.innerHTML = '<div class="p-5 text-center text-danger">Error al cargar historial.</div>';
    }
};

function generateHistoryItemDetail(match, i, uid) {
    const ids = match.jugadores;
    const date = match.fecha?.toDate ? match.fecha.toDate() : new Date(match.fecha);
    const resStr = match.resultado?.sets || "0-0";
    
    const myPos = ids.indexOf(uid);
    const isTeam1 = myPos < 2;
    const scores = resStr.split(' ')[0].split('-').map(Number);
    const isWin = isTeam1 ? scores[0] > scores[1] : scores[1] > scores[0];
    
    const partnerId = isTeam1 ? ids[myPos === 0 ? 1 : 0] : ids[myPos === 2 ? 3 : 2];
    const rivalsIds = isTeam1 ? [ids[2], ids[3]] : [ids[0], ids[1]];
    
    const partnerName = allUsersMap[partnerId]?.nombreUsuario || allUsersMap[partnerId]?.nombre || 'PAREJA';
    const rivalsNames = rivalsIds.map(rid => allUsersMap[rid]?.nombreUsuario || allUsersMap[rid]?.nombre || 'RIVAL').join(' & ');

    const detail = match.puntosDetalle?.[uid];
    const ptsTotal = detail?.total || 0;
    const resultColor = isWin ? 'var(--success)' : 'var(--danger)';
    
    let levelChangeIcon = 'fa-equals text-muted';
    if (detail) {
        if (detail.nivelPost > detail.nivelPrev) levelChangeIcon = 'fa-angles-up text-success';
        else if (detail.nivelPost < detail.nivelPrev) levelChangeIcon = 'fa-angles-down text-danger';
    }

    return `
        <div class="glass-light p-3 mb-2 mx-3 rounded-xl animate-up" style="animation-delay:${i*0.05}s; border-left:4px solid ${resultColor}">
            <div class="flex-between mb-2">
                <span class="text-2xs font-bold opacity-50 tracking-wider">${match.type} • ${date.toLocaleDateString('es-ES', {day:'2-digit', month:'short'})}</span>
                <span class="font-rajdhani font-bold" style="color:${ptsTotal >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${ptsTotal >= 0 ? '+' : ''}${ptsTotal.toFixed(1)} PTS
                </span>
            </div>
            
            <div class="flex-between align-center mb-2">
                <div class="flex-column" style="max-width:65%">
                    <span class="text-xs font-bold truncate d-block">${rivalsNames}</span>
                    <span class="text-2xs opacity-50">Con: ${partnerName}</span>
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold font-rajdhani">${resStr}</div>
                    <div style="font-size:0.6rem">
                        <i class="fas ${levelChangeIcon}"></i>
                        <span class="ms-1 opacity-50">${detail ? detail.nivelPost.toFixed(2) : ''}</span>
                    </div>
                </div>
            </div>

            ${detail ? `
                <div class="glass-strong p-2 rounded-lg mt-2" style="font-size:0.65rem; border:1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.1);">
                    <div class="flex-between opacity-70 mb-1">
                        <span>Base & Dificultad</span>
                        <span class="font-bold">${((detail.base || 0) + (detail.rival || 0)).toFixed(1)}</span>
                    </div>
                    <div class="flex-between opacity-70 mb-1">
                        <span>Bono Compañero</span>
                        <span class="font-bold">${(detail.companero || 0).toFixed(1)}</span>
                    </div>
                    <div class="flex-between opacity-70">
                        <span>Multiplicador (Racha/Exp)</span>
                        <span class="font-bold">x${(detail.multiplicador || 1).toFixed(2)}</span>
                    </div>
                </div>
            ` : `<div class="text-center opacity-30 mt-1" style="font-size:0.6rem; font-style: italic;">Desglose no disponible para partidas antiguas</div>`}
        </div>
    `;
}

window.closeUserModal = () => document.getElementById('user-details-modal').classList.remove('active');

// --- UTILS ---
function getUserColor(uid) {
    if (!uid) return '#FF6B35';
    const colors = ['#FF6B35', '#00C3FF', '#8A2BE2', '#00FA9A', '#FF007F', '#FFD700', '#FF4500', '#1E90FF'];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function showLoadingState() {
     const list = document.getElementById('ranking-list');
     if(list) list.innerHTML = '<div class="loader-ring-container py-5"><div class="loader-ring"></div></div>';
}

function showErrorState() {
     const list = document.getElementById('ranking-list');
     if(list) list.innerHTML = '<div class="p-4 text-center text-danger">Error cargando datos.</div>';
}

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