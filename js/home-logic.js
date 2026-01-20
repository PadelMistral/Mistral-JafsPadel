import { 
    getDocument, 
    getCollection, 
    initializeAuthObserver
} from './firebase-service.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, deleteDoc, query, where, onSnapshot, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { 
    renderMatchDetailsShared, 
    executeMatchAction as executeMatchActionShared, 
    showResultFormShared, 
    executeSaveResultShared,
    closeChatSubscription,
    renderWeatherShared,
    sendChatMessageShared,
    getPlayerDisplayData
} from './match-service.js';
import { authGuard, countUp } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', async () => {
    const usernameElement = document.getElementById('username');
    const nextMatchContainer = document.getElementById('next-match-container');
    
    let currentUser = null;
    let userData = null;

    // --- 1. Auth & Data Loading ---
    initializeAuthObserver(async (user) => {
        if (user) {
            currentUser = user;
            try {
                userData = await getDocument('usuarios', user.uid);
                if (userData) {
                    console.log("👤 [Home] UserData loaded:", userData);
                    
                    // 1. Admin Access Check
                    const adminLink = document.getElementById('admin-link');
                    if (adminLink && (userData.rol === 'Admin' || user.email === 'Juanan221091@gmail.com')) {
                        adminLink.style.display = 'flex';
                    }

                    const displayName = userData?.nombreUsuario || userData?.nombre || user.displayName || user.email.split('@')[0];
                    if (usernameElement) usernameElement.textContent = displayName.toUpperCase();
                    
                    updateSalutation();
                    await loadProfileStats(userData, user.uid);
                    loadNextMatch(user.uid);
                    loadPendingMatches(user.uid, 'abierto'); 
                    
                    // 2. Online Logic
                    countOnlineUsers();
                    
                    // 3. AI Advice Logic
                    if(window.padeluminatisAI?.updateFromUserData) {
                        window.padeluminatisAI.updateFromUserData(userData);
                    }
                    generateAIAdviceMini(userData);
                }
            } catch (error) {
                console.error("Error in home-logic:", error);
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    function updateSalutation() {
        const horaActual = new Date().getHours();
        let saludo = 'BUENAS NOCHES';
        if (horaActual >= 6 && horaActual < 14) saludo = 'BUENOS DÍAS';
        else if (horaActual >= 14 && horaActual < 20) saludo = 'BUENAS TARDES';
        
        const greetingEl = document.getElementById('greeting-text');
        if (greetingEl) greetingEl.textContent = saludo;
    }

    function generateAIAdviceMini(data) {
        const textEl = document.getElementById('ai-suggestion-text');
        if (!textEl) return;
        
        const name = data.nombreUsuario || data.nombre || 'Jugador';
        const racha = parseInt(data.rachaActual || 0);
        
        if (racha > 1) {
            textEl.textContent = `¡Fascinante, ${name}! Tu racha de ${racha} victorias es digna de la élite galáctica.`;
        } else if (racha < 0) {
            textEl.textContent = `${name}, analizo que un amistoso hoy restaurará tu balance victorias/derrotas.`;
        } else {
            textEl.textContent = `Bienvenido, ${name}. He calculado nuevos retos para ti en la biblioteca.`;
        }
    }

    // --- 2. Stats Logic ---
    async function loadProfileStats(data, uid) {
        if (!data) return;
        try {
            const puntosRanking = Math.round(data.puntosRankingTotal || data.puntosRanking || 0);
            const partidosJugados = parseInt(data.partidosJugados || 0);
            const nivel = parseFloat(data.nivel || 2.0).toFixed(1);
            const rachaActual = parseInt(data.rachaActual || 0);

            if (document.getElementById('stat-nivel-display')) document.getElementById('stat-nivel-display').textContent = nivel;
            if (document.getElementById('stat-fp-welcome')) countUp(document.getElementById('stat-fp-welcome'), data.familyPoints || 0);
            if (document.getElementById('home-win-streak')) {
                const streakEl = document.getElementById('home-win-streak');
                countUp(streakEl, rachaActual);
                streakEl.style.color = rachaActual > 0 ? '#00e676' : (rachaActual < 0 ? '#ff1744' : '#fff');
            }
            if (document.getElementById('home-matches-week')) countUp(document.getElementById('home-matches-week'), partidosJugados);

            await calculateRankingPosition(uid, puntosRanking);
        } catch (e) { console.error(e); }
    }

    async function countOnlineUsers() {
        const display = document.getElementById('online-count-display');
        if (!display) return;
        try {
            // Real WhatsApp-style online count (active in last 5 minutes)
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
            const onlineUsers = await getCollection('usuarios', [['lastActive', '>=', fiveMinsAgo]]);
            display.textContent = `${onlineUsers.length} En línea`;
        } catch (e) {
            display.textContent = `0 En línea`;
        }
    }

    async function calculateRankingPosition(uid, userPoints) {
        try {
            const allUsers = await getCollection('usuarios', [], [], 500);
            allUsers.sort((a, b) => (b.puntosRankingTotal || b.puntosRanking || 0) - (a.puntosRankingTotal || a.puntosRanking || 0));
            const index = allUsers.findIndex(u => u.id === uid);
            if (index !== -1) {
                const pos = index + 1;
                const el = document.getElementById('home-rank-pos');
                const statusEl = document.getElementById('user-rank-status');
                if (el) {
                    el.textContent = `#${pos}`;
                    let color = 'var(--text-main)';
                    let statusText = `${userPoints} PTS`;

                    if (pos === 1) { color = '#FFD700'; statusText = 'LÍDER SUPREMO'; }
                    else if (pos === 2) color = '#C0C0C0';
                    else if (pos === 3) color = '#CD7F32';
                    else if (pos <= 10) color = 'var(--primary)';
                    
                    el.style.color = color;
                    if (statusEl) {
                        const spanEl = statusEl.querySelector('span');
                        if (spanEl) spanEl.textContent = statusText;
                        statusEl.style.borderColor = color;
                        statusEl.style.color = color;
                    }
                }
            }
        } catch (e) { console.error(e); }
    }

    // --- 3. Upcoming Matches Carousel ---
    let upcomingMatchesArray = [];
    let currentCarouselIndex = 0;

    async function loadNextMatch(uid) {
        const container = document.getElementById('next-match-container');
        if (container) container.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';
        
        try {
            const now = new Date();
            const am = await getCollection('partidosAmistosos', [['jugadores', 'array-contains', uid]]);
            const re = await getCollection('partidosReto', [['jugadores', 'array-contains', uid]]);
            
            upcomingMatchesArray = [
                ...am.map(m => ({...m, tipo: 'amistoso'})), 
                ...re.map(m => ({...m, tipo: 'reto'}))
            ]
                .map(m => ({ ...m, fechaObj: m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha) }))
                .filter(m => m.estado !== 'jugado' && m.fechaObj >= now)
                .sort((a, b) => a.fechaObj - b.fechaObj);

            if (upcomingMatchesArray.length > 0) {
                currentCarouselIndex = 0;
                if (upcomingMatchesArray.length > 1) {
                    const nav = document.getElementById('nm-carousel-nav');
                    if (nav) nav.style.display = 'flex';
                    setupCarouselNav();
                }
                renderNextMatch(upcomingMatchesArray[0]);
            } else {
                if (container) {
                    container.innerHTML = `
                        <div class="empty-next-match glass-strong p-3 text-center rounded-lg border-glass">
                            <i class="fas fa-calendar-check text-muted opacity-30 mb-2" style="font-size:1.5rem;"></i>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px; font-weight:600">SIN PARTIDOS PRÓXIMOS</div>
                            <a href="calendario.html" class="text-xs text-primary font-bold tracking-widest hover:text-accent transition-colors" style="text-decoration:none; border-bottom:1px dotted var(--primary);">
                                BUSCAR PARTIDAS ABIERTAS
                            </a>
                        </div>
                    `;
                }
                const nav = document.getElementById('nm-carousel-nav');
                if (nav) nav.style.display = 'none';
            }
        } catch (error) { console.error(error); }
    }

    function setupCarouselNav() {
        const prevBtn = document.getElementById('nm-prev');
        const nextBtn = document.getElementById('nm-next');
        if (prevBtn && nextBtn) {
            prevBtn.onclick = () => {
                currentCarouselIndex = (currentCarouselIndex - 1 + upcomingMatchesArray.length) % upcomingMatchesArray.length;
                renderNextMatch(upcomingMatchesArray[currentCarouselIndex]);
            };
            nextBtn.onclick = () => {
                currentCarouselIndex = (currentCarouselIndex + 1) % upcomingMatchesArray.length;
                renderNextMatch(upcomingMatchesArray[currentCarouselIndex]);
            };
        }
    }

    async function renderNextMatch(match) {
        const container = document.getElementById('next-match-container');
        if (!container) return;
        
        const indicator = document.getElementById('nm-indicator');
        if (indicator) indicator.textContent = `${currentCarouselIndex + 1}/${upcomingMatchesArray.length}`;

        const date = match.fechaObj;
        const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
        const dayNum = date.getDate();
        const month = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
        
        const isFull = (match.jugadores?.length || 0) >= 4;
        const statusText = isFull ? 'COMPLETA' : 'ABIERTA';
        const statusClass = isFull ? 'full' : 'open';

        // Get Player Data correctly
        const players = await Promise.all([0,1,2,3].map(async i => {
            const pid = match.jugadores?.[i];
            if (!pid) return { name: '-', color: '#555', level: 0, isPlaceholder: true };
            try {
                const pData = await getPlayerDisplayData(pid);
                return pData || { name: '??', color: '#777', level: 2.5 };
            } catch (e) {
                return { name: '??', color: '#777', level: 2.5 };
            }
        }));

        // Calculate Win Prob (Mock or Based on Levels)
        const team1Level = (players[0].level || 2.5) + (players[1].level || 2.5);
        const team2Level = (players[2].level || 2.5) + (players[3].level || 2.5);
        let winProb = 50;
        if(team1Level > 0 && team2Level > 0) {
            winProb = Math.round((team1Level / (team1Level + team2Level)) * 100);
            if (winProb < 35) winProb = 35; if (winProb > 65) winProb = 65;
        }

        // Vecina AP Commentary
        const apComment = getAPCommentary(winProb, match.tipo);

        container.innerHTML = `
            <div class="next-match-card-v4 animate-fade-in" onclick="window.openMatchModalHome('${match.id}', '${match.tipo}')">
                <div class="nm-v4-top flex-between">
                    <div class="nm-v4-type ${match.tipo || 'amistoso'}">
                        <i class="fas ${match.tipo === 'reto' ? 'fa-fire' : 'fa-handshake'}"></i>
                        ${(match.tipo || 'amistoso').toUpperCase()}
                    </div>
                    <div class="nm-v4-weather" id="nm-weather-${match.id}">
                        <i class="fas fa-cloud-sun mr-1"></i> 22°C
                    </div>
                </div>

                <div class="nm-v4-main">
                    <div class="nm-v4-date-box">
                        <span class="nm-v4-day">${dayNum}</span>
                        <span class="nm-v4-month">${month}</span>
                    </div>
                    <div class="nm-v4-info">
                        <span class="nm-v4-time-large">${time}</span>
                        <span class="nm-v4-weekday">${dayName}</span>
                    </div>
                    <div class="nm-v4-prob">
                        <div class="prob-circle">
                            <svg viewBox="0 0 36 36" class="circular-chart">
                                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                <path class="circle" stroke-dasharray="${winProb}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            </svg>
                            <span class="prob-val">${winProb}%</span>
                        </div>
                        <span class="prob-label">WIN PROB</span>
                    </div>
                </div>

                <div class="nm-v4-teams">
                    <div class="v4-team team-top">
                        <span style="color:${players[0].color}">${players[0].name}</span>
                        <span class="v4-sep">+</span>
                        <span style="color:${players[1].color}">${players[1].name}</span>
                    </div>
                    <div class="v4-vs">VS</div>
                    <div class="v4-team team-bottom">
                        <span style="color:${players[2].color}">${players[2].name}</span>
                        <span class="v4-sep">+</span>
                        <span style="color:${players[3].color}">${players[3].name}</span>
                    </div>
                </div>

                <div class="nm-v4-ai-ap">
                    <div class="ap-avatar-mini"><i class="fas fa-robot"></i></div>
                    <div class="ap-bubble-mini">${apComment}</div>
                </div>
            </div>
        `;

        // Load Real Weather
        loadWeatherMini(document.getElementById(`nm-weather-${match.id}`), date);
    }

    function getAPCommentary(prob, type) {
        if (prob > 55) return "Mis sensores detectan una victoria inminente si mantienes la calma en la red.";
        if (prob < 45) return "El nexo sugiere jugar a los globos. El rival es superior técnicamente.";
        return "Probabilidades equilibradas. El primer set decidirá el flujo cuántico del partido.";
    }

    async function loadWeatherMini(container, date) {
        if(!container) return;
        try {
            const { renderWeatherShared } = await import('./match-service.js');
            await renderWeatherShared(container, date);
        } catch(e) { container.innerHTML = '<i class="fas fa-sun"></i> 24°C'; }
    }

    // --- 4. Library Logic ---
    window.activeFilters = { date: 'all', status: 'abierto', type: 'all' };

    window.setHomeFilter = (category, value, btnElement) => {
        const container = btnElement.parentElement;
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');

        if (category === 'date') window.activeFilters.date = value;
        else if (category === 'status') {
            window.activeFilters.status = value;
            window.activeFilters.type = 'all';
        } else if (category === 'type') {
            window.activeFilters.type = value;
            window.activeFilters.status = 'all';
        }

        loadPendingMatches(currentUser.uid);
    };

    async function loadPendingMatches(uid, forceStatus = null) {
        const list = document.getElementById('pending-matches-list');
        if (list) list.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';

        if (forceStatus) {
            window.activeFilters.status = forceStatus;
            // Ensure UI tab reflects this
            document.querySelectorAll('[data-category="status"]').forEach(btn => {
                if (btn.getAttribute('onclick').includes(`'${forceStatus}'`)) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        try {
            const now = new Date();
            const pastDate = new Date(); pastDate.setDate(now.getDate() - 7);
            
            const [am, re] = await Promise.all([
                getCollection('partidosAmistosos', [['fecha', '>=', pastDate]]),
                getCollection('partidosReto', [['fecha', '>=', pastDate]])
            ]);

            const all = [...am.map(m=>({...m,tipo:'amistoso'})), ...re.map(m=>({...m,tipo:'reto'}))];
            all.forEach(m => m.fechaObj = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha));

            const fDate = window.activeFilters.date;
            const fStatus = window.activeFilters.status;
            const fType = window.activeFilters.type;

            const filtered = all.filter(m => {
                const mDate = m.fechaObj;
                if (fDate === 'today' && mDate.toDateString() !== now.toDateString()) return false;
                if (fDate === 'tomorrow') {
                    const tmrw = new Date(); tmrw.setDate(now.getDate()+1);
                    if(mDate.toDateString() !== tmrw.toDateString()) return false;
                }
                if (fDate === 'week') {
                    const nextWeek = new Date(); nextWeek.setDate(now.getDate()+7);
                    if(mDate < now || mDate > nextWeek) return false;
                }

                if (fType !== 'all' && m.tipo !== fType) return false;
                if (fStatus === 'abierto' && (m.estado === 'jugado' || (m.jugadores?.length || 0) >= 4)) return false;
                if (fStatus === 'played' && m.estado !== 'jugado') return false;

                return true;
            });

            filtered.sort((a,b) => b.fechaObj - a.fechaObj);
            renderLibrary(filtered);
        } catch (e) { console.error(e); }
    }

    async function renderLibrary(matches) {
        const list = document.getElementById('pending-matches-list');
        if (!list) return;
        if (matches.length === 0) {
            list.innerHTML = '<div class="p-4 text-center opacity-50 text-xs">NO SE ENCONTRARON PARTIDOS</div>';
            return;
        }

        const htmlArray = await Promise.all(matches.map(async m => {
            // Get participants summary
            const participantNames = await Promise.all((m.jugadores || []).map(async pid => {
                 const p = await getPlayerDisplayData(pid);
                 return p.name;
            }));
            const pText = participantNames.length > 0 ? participantNames.join(', ') : 'Pista libre';

            return `
                <div class="match-mini-card-premium animate-fade-in" onclick="window.openMatchModalHome('${m.id}', '${m.tipo}')">
                    <div class="mm-left">
                        <span class="mm-time">${m.fechaObj.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</span>
                        <span class="mm-date-mini">${m.fechaObj.toLocaleDateString('es-ES', {day:'numeric', month:'short'}).toUpperCase()}</span>
                    </div>
                    <div class="mm-center">
                        <div class="mm-tags">
                            <span class="mm-status ${m.estado === 'jugado' ? 'played' : ((m.jugadores?.length || 0) < 4 ? 'open' : 'full')}">
                                ${m.estado === 'jugado' ? 'FINAL' : ((m.jugadores?.length || 0) < 4 ? 'ABIERTA' : 'COMPLETA')}
                            </span>
                            <span style="font-size:0.5rem; font-weight:800; opacity:0.6">${m.tipo.toUpperCase()}</span>
                        </div>
                        <div class="mm-participants" style="font-size:0.6rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px; margin-top:2px; font-weight:700">
                            ${pText.toUpperCase()}
                        </div>
                    </div>
                    <div class="mm-right">
                        ${m.restriccionNivel ? `<span class="text-2xs opacity-40">NV ${m.restriccionNivel.min}-${m.restriccionNivel.max}</span>` : ''}
                        <i class="fas fa-chevron-right mm-arrow"></i>
                    </div>
                </div>
            `;
        }));

        list.innerHTML = htmlArray.join('');
    }

    // --- Global Helpers ---
    window.openMatchModalHome = async (id, type) => {
        const modal = document.getElementById('modal-partido-universal');
        const container = document.getElementById('modal-cuerpo');
        if (!modal || !container) return;
        
        modal.classList.add('active');
        container.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';
        
        try {
            const colName = type === 'reto' ? 'partidosReto' : 'partidosAmistosos';
            const snap = await getDocument(colName, id);
            if (snap) {
                await renderMatchDetailsShared(container, { id, ...snap }, currentUser, userData);
            } else {
                container.innerHTML = '<p class="p-4 text-center">Partido no encontrado.</p>';
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = '<p class="p-4 text-center">Error al cargar.</p>';
        }
    };

    window.closeMatchModal = () => {
        document.getElementById('modal-partido-universal')?.classList.remove('active');
        closeChatSubscription();
    };

    // Notification Dot
    if (auth.currentUser) {
        const q = query(collection(db, "notificaciones"), where("uid", "==", auth.currentUser.uid), where("read", "==", false));
        onSnapshot(q, (snap) => {
            const dot = document.getElementById('header-notif-dot');
            if (dot) dot.style.display = snap.empty ? 'none' : 'block';
        });
    }
});
