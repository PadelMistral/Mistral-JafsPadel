import { authGuard, showToast } from './ui-core.js';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import {
    doc, getDoc, collection, query, getDocs,
    updateDoc, addDoc, deleteDoc, Timestamp, where, serverTimestamp,
    onSnapshot, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { processMatchResults } from './ranking-service.js';
import { createNotification } from './notifications-service.js';
import { 
    renderMatchDetailsShared, 
    executeMatchAction as executeMatchActionShared,
    showResultFormShared,
    executeSaveResultShared,
    sendChatMessageShared,
    closeChatSubscription,
    renderWeatherShared
} from './match-service.js';

// --- DEBUG ---
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error("🔥 [FATAL] Global Error Captured:", { msg, url, line: lineNo, col: columnNo, error });
    alert("Error Fatal: " + msg);
    return false;
};

// --- PROTECTION ---
console.log("🛡️ [Calendar] Invoking authGuard...");
authGuard();

// --- CONFIGURATION ---
const FRANJAS_HORARIAS = [
    { inicio: '08:00', fin: '09:30' },
    { inicio: '09:30', fin: '11:00' },
    { inicio: '11:00', fin: '12:30' },
    { inicio: '12:30', fin: '14:00' },
    { inicio: '14:30', fin: '16:00' },
    { inicio: '16:00', fin: '17:30' },
    { inicio: '17:30', fin: '19:00' },
    { inicio: '19:00', fin: '20:30' },
    { inicio: '20:30', fin: '22:00' }
];

// --- APP STATE ---
let usuarioActual = null;
let userData = null;
let fechaActual = new Date();
let partidos = [];
let allUsersMap = {};
let selectedPlayers = []; 
let currentSlotIndex = -1; 
let currentMatchEditing = null; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    console.log("🚀 [Calendar] initApp started");
    
    onAuthStateChanged(auth, async (user) => {
        console.log("👤 [Calendar] Auth State Changed. User:", user ? user.uid : "None");
        if (user) {
            usuarioActual = user;
            try {
                console.log("📡 [Calendar] Fetching user doc (usuarios/" + user.uid + ")");
                const uDoc = await getDoc(doc(db, 'usuarios', user.uid));
                if (uDoc.exists()) {
                    userData = uDoc.data();
                    console.log("✅ [Calendar] User data loaded:", userData.nombreUsuario || userData.nombre);
                    
                    try {
                        console.log("📡 [Calendar] Loading initial data (users map)...");
                        await loadInitialData();
                        console.log("✅ [Calendar] allUsersMap populated with " + Object.keys(allUsersMap).length + " users.");
                    } catch (e) {
                        console.error("⚠️ [Calendar] loadInitialData (users fetch) failed. Check your Firestore rules for 'usuarios' collection.", e);
                    }
                    
                    console.log("🎨 [Calendar] Initial rendering...");
                    renderCalendar();
                    startClock();
                } else {
                    console.error("❌ [Calendar] No user document found for UID:", user.uid);
                    window.location.href = 'index.html';
                }
            } catch (err) {
                console.error("❌ [Calendar] Fatal error in initApp:", err);
                showToast("Error de conexión", "danger");
            }
        } else {
            console.warn("⚠️ [Calendar] No user authenticated. Redirecting.");
            window.location.href = 'index.html';
        }
    });

    const btnPrev = document.getElementById('btn-semana-anterior');
    const btnNext = document.getElementById('btn-semana-siguiente');
    console.log("🔍 [Calendar] DOM Listeners check:", { btnPrev: !!btnPrev, btnNext: !!btnNext });

    btnPrev?.addEventListener('click', () => changeWeek(-1));
    btnNext?.addEventListener('click', () => changeWeek(1));
    document.getElementById('btn-cerrar-modal')?.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { 
        if (e.target.id === 'modal-partido-universal') closeModal(); 
    });
    
    document.getElementById('selector-search')?.addEventListener('input', (e) => handleSelectorSearch(e.target.value));
    
    document.getElementById('user-search-input')?.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        const cells = document.querySelectorAll('.slot-cell');
        cells.forEach(cell => {
            if (!search) { cell.style.opacity = '1'; cell.style.filter = 'none'; return; }
            const text = cell.innerText.toLowerCase();
            if (text.includes(search)) {
                cell.style.opacity = '1';
                cell.style.filter = 'brightness(1.5) saturate(1.2)';
            } else {
                cell.style.opacity = '0.3';
                cell.style.filter = 'grayscale(0.8)';
            }
        });
    });
    // Make closeSelector globally available for the inline onclick handler
    window.closeSelector = () => {
        document.getElementById('user-selector-overlay')?.classList.remove('active');
    }
}

async function loadInitialData() {
    // Only fetch if strictly necessary, or handle permissions
    try {
        const usersSnap = await getDocs(collection(db, 'usuarios'));
        usersSnap.forEach(doc => { allUsersMap[doc.id] = { id: doc.id, ...doc.data() }; });
    } catch (e) {
        throw e;
    }
}

function startClock() {
    const timeEl = document.getElementById('current-time-display');
    const dateEl = document.getElementById('current-date-display');
    
    function update() {
        const now = new Date();
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (dateEl) {
            const options = { weekday: 'long', day: 'numeric', month: 'short' };
            dateEl.textContent = now.toLocaleDateString('es-ES', options).toUpperCase();
        }
    }
    update();
    setInterval(update, 1000);
}

function changeWeek(direction) {
    fechaActual.setDate(fechaActual.getDate() + (direction * 7));
    renderCalendar();
}

// --- CALENDAR RENDERING ---
async function renderCalendar() {
    console.log("📅 [Calendar] renderCalendar triggered");
    if (!usuarioActual) {
        console.warn("🚫 [Calendar] No usuarioActual. Aborting render.");
        return;
    }
    const container = document.getElementById('semanas-calendario');
    if (!container) {
        console.error("❌ [Calendar] Container '#semanas-calendario' not found in DOM!");
        return;
    }
    
    showLoader(true);
    
    try {
        const startOfWeek = new Date(fechaActual);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0,0,0,0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        console.log("📅 [Calendar] Range calculated:", startOfWeek.toDateString(), "to", endOfWeek.toDateString());

        const rangeEl = document.getElementById('rango-semana');
        if (rangeEl) {
            rangeEl.textContent = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${endOfWeek.toLocaleDateString('es-ES', {month: 'short'}).toUpperCase()}`;
        }
        const mesEl = document.getElementById('mes-actual');
        if (mesEl) {
            mesEl.textContent = startOfWeek.toLocaleDateString('es-ES', {month: 'long', year: 'numeric'}).toUpperCase();
        }

        console.log("📡 [Calendar] Fetching matches for range...");
        await loadMatchesInRange(startOfWeek, endOfWeek);
        console.log("✅ [Calendar] Matches loaded into 'partidos' state. Count:", partidos.length);
        
        let html = `
            <div class="grid-header">
                <div class="corner-header">GMT</div>
                ${['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((name, i) => {
                    const d = new Date(startOfWeek);
                    d.setDate(startOfWeek.getDate() + i);
                    const isToday = d.toDateString() === new Date().toDateString();
                    return `<div class="day-header ${isToday ? 'today' : ''}"><span class="day-name">${name}</span><span class="day-num">${d.getDate()}</span></div>`;
                }).join('')}
            </div>
            <div class="grid-body">
        `;

        FRANJAS_HORARIAS.forEach((franja, fIdx) => {
            console.log(`⏰ [Calendar] Rendering row: ${franja.inicio}`);
            html += `<div class="time-row"><div class="time-col"><span class="time-start">${franja.inicio}</span></div>`;
            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(startOfWeek);
                currentDay.setDate(startOfWeek.getDate() + i);
                const match = findMatchInSlot(currentDay, franja.inicio);
                const slotState = getSlotState(match);
                if (match) console.log(`🎾 [Calendar] Found match at ${currentDay.toDateString()} ${franja.inicio}:`, match.id);
                html += `
                    <div class="slot-cell ${slotState}" onclick="handleCellClick('${currentDay.toISOString()}', '${franja.inicio}')">
                        ${renderSlotContent(match, slotState)}
                    </div>`;
            }
            html += `</div>`;
            if (franja.inicio === '12:30') html += `<div class="break-row"><span class="break-tag">DESCANSO</span></div>`;
        });

        container.innerHTML = html + `</div>`;
        updateBottomWeather(startOfWeek);
    } catch (error) {
        console.error("Error rendering calendar:", error);
        container.innerHTML = `<div class="error-msg p-4 text-center">Error al cargar calendario. Inténtelo de nuevo.</div>`;
    } finally {
        showLoader(false);
    }
}

async function loadMatchesInRange(start, end) {
    const collections = ['partidosAmistosos', 'partidosReto'];
    const allMatches = [];
    
    try {
        // Optimization: Fetch only matches within the date range
        // Note: Firestore requires an index for this if the collection is large, but usually single field range query works fine.
        const promises = collections.map(colName => {
             const q = query(
                 collection(db, colName),
                 where('fecha', '>=', Timestamp.fromDate(start)),
                 where('fecha', '<=', Timestamp.fromDate(end))
             );
             return getDocs(q);
        });

        const snapshots = await Promise.all(promises);
        
        snapshots.forEach((snap, idx) => {
            const colName = collections[idx];
            console.log(`🔍 [Calendar] Processing snapshot for ${colName}... Items: ${snap.size}`);
            snap.forEach(docSnap => {
                const data = docSnap.data();
                // Double check date locally just to be safe with timezone edges, though query should handle it
                const date = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
                if (date) {
                    allMatches.push({ 
                        id: docSnap.id, 
                        tipo: colName.includes('Reto') ? 'reto' : 'amistoso', 
                        ...data, 
                        fecha: date 
                    });
                }
            });
        });
        partidos = allMatches;
        console.log(`Loaded ${partidos.length} matches.`);
    } catch (err) {
        console.error("Error loading matches:", err);
        showToast("Error loading matches. Check console.", "danger");
        throw err;
    }
}

function findMatchInSlot(date, time) {
    return partidos.find(p => {
        const pDate = p.fecha.toDateString();
        const dDate = date.toDateString();
        const h = p.fecha.getHours().toString().padStart(2, '0');
        const m = p.fecha.getMinutes().toString().padStart(2, '0');
        const pTime = `${h}:${m}`;
        return pDate === dDate && pTime === time;
    });
}

function getSlotState(match) {
    if (!match) return 'free';
    const isMine = match.jugadores?.includes(usuarioActual.uid);
    if (match.estado === 'jugado') return 'occupied';
    if (match.estado === 'cerrado') return isMine ? 'mine' : 'occupied';
    return isMine ? 'mine' : 'open';
}

function renderSlotContent(match, state) {
    if (state === 'free') return `<span class="status-label"><i class="fas fa-plus opacity-30"></i></span>`;
    
    // Data setup
    const isReto = match.tipo === 'reto';
    const isPlayed = match.estado === 'jugado';
    const count = match.jugadores?.length || 0;
    const firstPlayerId = match.jugadores?.[0];
    const u = allUsersMap[firstPlayerId];
    const name = u?.nombreUsuario || u?.nombre || 'JUGADOR';
    const nameStr = (name.split(' ')[0] || '---').toUpperCase();

    // Classes
    let cardClass = 'calendar-match-card ';
    if (isPlayed) cardClass += 'cmc-finished';
    else if (isReto) cardClass += 'cmc-reto';
    else cardClass += 'cmc-amistoso';

    // Icons
    const bgIcon = isReto ? 'fa-fire' : 'fa-handshake';

    return `
    <div class="${cardClass}">
        <div class="cmc-content">
            <div class="cmc-name">${nameStr}</div>
            <div class="cmc-info">
                 <span class="cmc-badge"><i class="fas fa-users"></i> ${count}/4</span>
                 ${isReto ? '<span class="cmc-badge" style="color:#ffd54f"><i class="fas fa-bolt"></i></span>' : ''}
            </div>
        </div>
        <i class="fas ${bgIcon} cmc-bg-icon"></i>
    </div>
    `;
}

// --- MODAL & ACTIONS ---
window.handleCellClick = async (dateStr, time) => {
    currentMatchEditing = null;
    const date = new Date(dateStr);
    
    // Parse time string (HH:MM) to set hours on date object for accurate weather lookup
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);

    // --- BLOQUEO PASADO ---
    const ahora = new Date();
    if (date < ahora) {
        showToast("HORARIO NO DISPONIBLE (PASADO)", "warning");
        return;
    }

    const match = findMatchInSlot(date, time);
    const modal = document.getElementById('modal-partido-universal');
    const container = document.getElementById('modal-cuerpo');
    const title = document.getElementById('modal-titulo');

    if (title) title.textContent = match ? 'DETALLES DE PARTIDA' : 'NUEVA RESERVA';
    if (modal) modal.classList.add('active');
    
    if (!match) {
        renderCreationForm(container, date, time);
    } else {
        container.innerHTML = '<div class="p-5 text-center"><div class="loader-ring mx-auto"></div></div>';
        currentMatchEditing = match;
        await renderMatchDetailsShared(container, match, usuarioActual, userData);
        // Ensure weather is shown in details too
    }
};

function renderCreationForm(container, date, time) {
    selectedPlayers = [usuarioActual.uid, null, null, null];
    currentSlotIndex = -1;
    
    // Calculate End Time for display
    const [h, m] = time.split(':').map(Number);
    const endDate = new Date(date);
    endDate.setHours(h + 1, m + 30);
    const endTime = endDate.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});

    container.innerHTML = `
        <div class="match-setup-premium animate-fade-in">
            
            <!-- Hero Section: Weather & Time in Neon Card Style -->
            <div id="creation-weather-container"></div>
            
            <div class="in-modal-card">
                 <div class="mmc-top" style="border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:10px;">
                    <div class="mmc-date-weather">
                        <span style="font-size:0.9rem; color:#fff; font-weight:700;">${date.toLocaleDateString('es-ES', {day:'numeric', month:'short'}).toUpperCase()}</span>
                        <span class="mmc-dw-sep">|</span>
                        <span class="text-time" style="font-size:1rem">${time} - ${endTime}</span>
                    </div>
                </div>
                 <div class="text-xs text-center text-muted font-bold tracking-widest mt-2 uppercase">Configuración de Reserva</div>
            </div>

            <!-- Category Selector -->
            <input type="hidden" id="new-match-category-val" value="amistoso">
            <div class="category-toggle-container mb-4">
                <button id="cat-amistoso" class="cat-btn active amistoso" onclick="switchCategory('amistoso')">
                    <i class="fas fa-handshake"></i>
                    <span>AMISTOSO</span>
                </button>
                <button id="cat-reto" class="cat-btn reto" onclick="switchCategory('reto')">
                    <i class="fas fa-fire"></i>
                    <span>RETO</span>
                </button>
            </div>

            <div class="setup-body">
                <div id="cat-desc-box" class="glass-strong p-3 mb-4 rounded-lg text-center text-xs opacity-80 italic animate-fade-in">
                    <!-- Tech filled -->
                </div>
                
                <div class="level-restriction-box glass-strong p-3 mb-3 rounded-lg border-glass">
                    <div class="flex-between mb-2">
                        <span class="text-xs font-bold text-accent"><i class="fas fa-shield-halved"></i> NIVEL REQUERIDO</span>
                        <span class="badge" id="range-val" style="background:#333">OPEN</span>
                    </div>
                    <div class="flex-between gap-md">
                        <div class="range-input-box">
                            <span class="range-label">MÍNIMO</span>
                            <input type="number" id="min-points" class="form-input-pro text-center" value="0">
                        </div>
                        <div class="range-input-box">
                            <span class="range-label">MÁXIMO</span>
                            <input type="number" id="max-points" class="form-input-pro text-center" value="5000">
                        </div>
                    </div>
                </div>

                <div id="reto-fields" style="display:none;" class="mb-4 animate-fade-in">
                    <div class="glass-gradient-warning p-3 rounded-lg border-warning">
                        <div class="form-group mb-2">
                            <label class="range-label text-warning"><i class="fas fa-coins"></i> FAMILY POINTS (APUESTA)</label>
                            <input type="number" id="reto-fp" class="form-input-pro" value="50" style="color:#ffd54f; border-color: rgba(255,213,79,0.3)">
                        </div>
                        <div class="form-group">
                            <label class="range-label text-warning"><i class="fas fa-bullhorn"></i> PROPUESTA DE RETO</label>
                            <input type="text" id="reto-propuesta" class="form-input-pro" placeholder="Ej: Quien pierda paga la pista...">
                        </div>
                    </div>
                </div>

                <div class="vs-schema-container mt-2">
                    <div class="vs-schema-title">ALINEACIÓN</div>
                    <div class="vs-box">
                        <div class="team-box">
                            <div id="slot-0" class="player-slot filled" onclick="handleSlotClick(0)" style="border-left: 3px solid var(--primary)">
                                <span class="slot-name">${(userData?.nombreUsuario || 'YO').toUpperCase()}</span>
                                <div class="slot-remove" onclick="event.stopPropagation(); clearSlot(0)"><i class="fas fa-times"></i></div>
                            </div>
                            <div id="slot-1" class="player-slot" onclick="handleSlotClick(1)">
                                <i class="fas fa-plus opacity-50"></i>
                            </div>
                        </div>
                        <div class="vs-circle">VS</div>
                        <div class="team-box">
                            <div id="slot-2" class="player-slot" onclick="handleSlotClick(2)">
                                <i class="fas fa-plus opacity-50"></i>
                            </div>
                            <div id="slot-3" class="player-slot" onclick="handleSlotClick(3)">
                                <i class="fas fa-plus opacity-50"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <button onclick="executeCreateMatch('${date.toISOString()}', '${time}')" class="btn btn-primary w-100 mt-4 btn-lg shadow-lg">
                    CREAR PARTIDA <i class="fas fa-rocket ms-1"></i>
                </button>
            </div>
        </div>
    `;
    
    // Init Visuals
    window.switchCategory('amistoso');
    
    // Fetch Weather for this date
    const wContainer = document.getElementById('creation-weather-container');
    if(wContainer) renderWeatherShared(wContainer, date); 
}

window.switchCategory = (cat) => {
    const val = document.getElementById('new-match-category-val');
    if (!val) return;
    val.value = cat;
    
    // Update Buttons
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('cat-' + cat)?.classList.add('active');
    
    // Update Fields
    const retoFields = document.getElementById('reto-fields');
    if (retoFields) {
        if(cat === 'reto') {
            retoFields.style.display = 'block';
            setTimeout(() => retoFields.classList.add('show'), 10);
        } else {
            retoFields.style.display = 'none';
        }
    }

    // Update Description
    const descBox = document.getElementById('cat-desc-box');
    if (descBox) {
        if (cat === 'reto') {
            descBox.innerHTML = `<span class="text-warning font-bold"><i class="fas fa-trophy"></i> MODO COMPETITIVO</span><br>Los Family Points están en juego. Todos deben aceptar.`;
            descBox.style.color = '#ffd54f';
            descBox.style.background = 'rgba(255, 107, 53, 0.05)';
        } else {
            descBox.innerHTML = `<span class="text-accent font-bold"><i class="fas fa-smile"></i> MODO CASUAL</span><br>Partida abierta sin apuestas. Ideal para practicar.`;
            descBox.style.color = '#00c3ff';
            descBox.style.background = 'rgba(0, 195, 255, 0.05)';
        }
    }
};

window.executeCreateMatch = async (dateStr, time) => {
    const cat = document.getElementById('new-match-category-val').value;
    const minP = parseInt(document.getElementById('min-points').value) || 0;
    const maxP = parseInt(document.getElementById('max-points').value) || 5000;
    const fp = parseInt(document.getElementById('reto-fp')?.value || 0);
    const propuesta = document.getElementById('reto-propuesta')?.value || '';
    
    const date = new Date(dateStr);
    const invitees = selectedPlayers.filter(p => p !== usuarioActual.uid && p !== null && !p.startsWith('GUEST_'));

    const payload = {
        creador: usuarioActual.uid,
        creadorNombre: userData?.nombreUsuario || 'Jugador',
        fecha: Timestamp.fromDate(date),
        jugadores: selectedPlayers, // Keep all 4 slots (even nulls) for fixed positions
        invitacionesPendientes: invitees,
        estado: selectedPlayers.filter(p => p !== null).length === 4 ? 'cerrado' : 'abierto',
        tipo: cat,
        familyPoints: fp,
        propuesta: propuesta,
        restriccionPuntos: { min: minP, max: maxP },
        creadoEn: serverTimestamp()
    };
    
    try {
        const docRef = await addDoc(collection(db, cat === 'reto' ? 'partidosReto' : 'partidosAmistosos'), payload);
        
        // 1. Notify Invitees (Everyone except creator who is currently in the lineup)
        const participantsToNotify = invitees.filter(id => !id.startsWith('GUEST_'));
        if (participantsToNotify.length > 0) {
            createNotification(
                participantsToNotify, 
                cat === 'reto' ? "NUEVO DESAFÍO" : "¡PARTIDA RESERVADA!", 
                `${userData?.nombreUsuario || 'Un jugador'} te ha incluido en un partido el ${date.toLocaleDateString('es-ES')}`, 
                'match_invite', 
                'calendario.html'
            );
        }
        
        // 2. DISCOVERY: Notify others if slot is open
        if (payload.estado === 'abierto') {
            const usersSnap = await getDocs(query(collection(db, "usuarios"), limit(30)));
            const potentialUsers = [];
            usersSnap.forEach(u => {
                if (u.id !== usuarioActual.uid && !payload.jugadores.includes(u.id)) {
                    potentialUsers.push(u.id);
                }
            });
            if (potentialUsers.length > 0) {
                createNotification(potentialUsers, "¡PARTIDA DISPONIBLE!", `Hay un hueco libre el ${date.toLocaleDateString('es-ES')} a las ${time}. ¡Únete!`, 'info', 'calendario.html');
            }
        }

        closeModal();
        await renderCalendar();
        showToast('¡PARTIDA CREADA!', 'success');
    } catch (err) {
        console.error(err);
        showToast('ERROR AL CREAR', 'danger');
    }
};

window.openSelector = (index) => {
    currentSlotIndex = index;
    const overlay = document.getElementById('user-selector-overlay');
    const results = document.getElementById('selector-results');
    overlay.classList.add('active');
    results.innerHTML = '';

    const users = Object.values(allUsersMap).sort((a,b) => (b.puntosRankingTotal || 0) - (a.puntosRankingTotal || 0));
    
    // Add "Invitado" option
    const guestDiv = document.createElement('div');
    guestDiv.className = 'user-selection-card guest';
    guestDiv.innerHTML = `
        <div class="user-info-pro">
            <span class="user-name-pro">Invitado (GUEST)</span>
            <span class="text-2xs opacity-50">No suma ni resta puntos</span>
        </div>
        <div class="user-avatar-pro" style="background:#555"><i class="fas fa-user-plus"></i></div>
    `;
    guestDiv.onclick = () => {
        const guestName = prompt("Nombre del invitado:") || "INVITADO";
        selectPlayer('GUEST_' + guestName, guestName);
    };
    results.appendChild(guestDiv);

    users.forEach(u => {
        if (u.id === usuarioActual.uid) return;
        const color = u.colorRanking || '#FF6B35';
        const div = document.createElement('div');
        div.className = 'user-selection-card';
        div.innerHTML = `
            <div class="user-info-pro">
                <span class="user-name-pro">${u.nombreUsuario || u.nombre}</span>
                <div class="user-stats-row">
                    <span class="stat-pill">LVL ${u.nivel || '2.0'}</span>
                    <span class="stat-pill">${Math.round(u.puntosRankingTotal || 0)} PTS</span>
                </div>
            </div>
            <div class="user-avatar-pro" style="background:${color}; width:32px; height:32px; font-size:0.8rem">
                ${(u.nombreUsuario || u.nombre || 'U').substring(0,2).toUpperCase()}
            </div>
        `;
        div.onclick = () => selectPlayer(u.id, u.nombreUsuario || u.nombre);
        results.appendChild(div);
    });
};

function selectPlayer(uid, name) {
    selectedPlayers[currentSlotIndex] = uid;
    const slot = document.getElementById(`slot-${currentSlotIndex}`);
    if (slot) {
        slot.innerHTML = `
            <span class="slot-name">${name.substring(0, 10).toUpperCase()}</span>
            <div class="slot-remove" onclick="event.stopPropagation(); clearSlot(${currentSlotIndex})">
                <i class="fas fa-times"></i>
            </div>
        `;
        slot.classList.add('filled');
    }
    window.closeSelector();
}

window.handleSlotClick = (index) => {
    if (selectedPlayers[index]) return; // If filled, click does nothing (or we could re-open selector)
    window.openSelector(index);
};

window.clearSlot = (index) => {
    selectedPlayers[index] = null;
    const slot = document.getElementById(`slot-${index}`);
    if (slot) {
        slot.innerHTML = `<i class="fas fa-plus opacity-50"></i>`;
        slot.classList.remove('filled');
    }
};

window.handleSelectorSearch = (val) => {
    const cards = document.querySelectorAll('.user-selection-card');
    const search = val.toLowerCase();
    cards.forEach(card => {
        const name = card.querySelector('.user-name-pro')?.textContent.toLowerCase() || '';
        card.style.display = name.includes(search) ? 'flex' : 'none';
    });
};

window.executeMatchAction = async (action, id, type, extra = null) => {
    const success = await executeMatchActionShared(action, id, type, usuarioActual, userData, extra);
    if (success) {
        if (action === 'delete') closeModal();
        else {
            const colName = type.includes('reto') ? 'partidosReto' : 'partidosAmistosos';
            const snap = await getDoc(doc(db, colName, id));
            if (snap.exists()) {
                await renderMatchDetailsShared(document.getElementById('modal-cuerpo'), { id: snap.id, ...snap.data() }, usuarioActual, userData);
            }
        }
        await renderCalendar();
        showToast('Ok', 'success');
    }
};

window.showResultFormShared = showResultFormShared;
window.executeSaveResultShared = async (id, type) => {
    const success = await executeSaveResultShared(id, type);
    if (success) {
        closeModal();
        await renderCalendar();
        showToast('Guardado', 'success');
    }
};
window.sendChatMessageShared = sendChatMessageShared;

window.closeModal = () => { 
    closeChatSubscription();
    document.getElementById('modal-partido-universal')?.classList.remove('active'); 
};

function showLoader(show) { 
    const o = document.getElementById('calendar-global-loader'); 
    if (o) o.style.display = show ? 'flex' : 'none'; 
}

// function showToast(msg, type='info') { ... removed ... }

async function updateBottomWeather(date) {
    const el = document.getElementById('weather-summary-bottom');
    if (!el) return;
    try {
        const formattedDate = date.toISOString().split('T')[0];
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=39.4938&longitude=-0.3957&daily=temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${formattedDate}&end_date=${formattedDate}`);
        const data = await res.json();
        if (data.daily) {
            const max = Math.round(data.daily.temperature_2m_max[0]);
            const min = Math.round(data.daily.temperature_2m_min[0]);
            el.innerHTML = `<i class="fas fa-temperature-half text-accent"></i> <span>PREVISIÓN SEMANA: ${min}°/${max}°C</span>`;
        }
    } catch (e) {}
}