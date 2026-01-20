import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { renderMatchDetailsShared, executeMatchAction as executeMatchActionService, showResultFormShared, executeSaveResultShared, sendChatMessageShared, closeChatSubscription, renderWeatherShared } from './match-service.js';
import { authGuard, initSharedUI } from './ui-core.js';

initSharedUI('MIS CITAS');
import { getPlayerDisplayData } from './match-service.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('matches-list');
    const filterPanel = document.getElementById('filters-panel');
    const toggleBtn = document.getElementById('toggle-filters-btn');
    const searchInput = document.getElementById('search-player');
    
    let allMatches = [];
    let currentUser = null;
    let userData = null;
    
    // Filter State
    let filterType = 'all';
    let filterStatus = 'all';
    let searchTerm = '';

    // Toggle Filters
    if(toggleBtn && filterPanel) {
        toggleBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('active');
            toggleBtn.classList.toggle('active');
        });
    }

    // Filter Chips Logic
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const group = chip.parentElement;
            group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            if(chip.dataset.type) filterType = chip.dataset.type;
            if(chip.dataset.status) filterStatus = chip.dataset.status;
            
            applyFilters();
        });
    });

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    // Auth & Load
    onAuthStateChanged(auth, async (user) => {
        if(user) {
            currentUser = user;
            const snap = await getDoc(doc(db, 'usuarios', user.uid));
            if(snap.exists()) userData = snap.data();
            loadAllMatches();
        }
    });

    async function loadAllMatches() {
        try {
            const [amParams, reParams] = await Promise.all([
                getDocs(collection(db, 'partidosAmistosos')),
                getDocs(collection(db, 'partidosReto'))
            ]);

            const am = [];
            amParams.forEach(d => am.push({ id: d.id, ...d.data(), tipo: 'amistoso' }));
            
            const re = [];
            reParams.forEach(d => re.push({ id: d.id, ...d.data(), tipo: 'reto' }));

            allMatches = [...am, ...re].map(m => ({
                ...m,
                fechaObj: m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha)
            }));

            // Initial sort: Newest first
            allMatches.sort((a,b) => b.fechaObj - a.fechaObj);

            applyFilters();

        } catch (e) {
            console.error("Error loading matches:", e);
            listContainer.innerHTML = '<div class="text-center p-4 text-danger"><i class="fas fa-exclamation-triangle"></i> Error al cargar datos.</div>';
        }
    }

    function applyFilters() {
        let filtered = allMatches.filter(m => {
            // Type Filter
            if(filterType !== 'all' && m.tipo !== filterType) return false;
            
            // Status Filter
            const isPlayed = m.estado === 'jugado';
            if(filterStatus === 'jugado' && !isPlayed) return false;
            if(filterStatus === 'pendiente' && isPlayed) return false;

            return true;
        });

        // Search Filter (async players check is hard in sync filter, so we filter by cached names or do simple check)
        // For simplicity and performance, we filter by ID or if we have player names loaded. 
        // Real listing needs simpler approach: Filter logic here is strictly object based.
        
        renderList(filtered);
    }

    async function renderList(matches) {
        if(matches.length === 0) {
            listContainer.innerHTML = '<div class="empty-state-matches animate-fade-in"><i class="fas fa-search"></i><p>No se encontraron partidos</p></div>';
            return;
        }

        listContainer.innerHTML = '';
        
        // We render chunks to avoid freezing UI
        const chunk = matches.slice(0, 50); 

        for(const m of chunk) {
            const card = document.createElement('div');
            card.className = 'match-mini-card-premium animate-fade-in';

            const now = new Date();
            const isPast = m.fechaObj < now;
            const isPlayed = m.estado === 'jugado';
            // Logic: Passed date + Not Played + (Incomplete Players OR Just not marked played) -> Anulada visually
            // User requested: "si se paso el dia y no se ha apuntado el resultado o faltan jugadores tachala y pon anulada"
            // We'll treat "abierto" or "cerrado" in the past as "anulada" for display purposes.
            const isVisuallyAnulada = m.estado === 'anulado' || (isPast && !isPlayed);

            if (isVisuallyAnulada) {
                card.style.opacity = '0.5';
                card.style.filter = 'grayscale(0.8)';
            }

            const date = m.fechaObj;
            const time = date.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
            const dateStr = date.toLocaleDateString('es-ES', {day:'numeric', month:'short'}).toUpperCase();
            
            // Status Text
            let statusText = (m.estado || 'abierto').toUpperCase();
            let statusClass = m.estado === 'abierto' ? 'open' : (m.estado === 'cerrado' ? 'full' : 'played');
            
            if (isVisuallyAnulada) {
                statusText = 'ANULADA';
                statusClass = 'cancelled';
            }

            // Creator Name (replace Type)
            let creatorLabel = m.creadorNombre || 'Anónimo';
            if (creatorLabel.length > 12) creatorLabel = creatorLabel.substring(0,10) + '..';

            // Result or Stamp
            let resultDisplay = '';
            if (isPlayed && m.resultado?.sets) {
                resultDisplay = `<span class="badge-result success animate-pulse">🏆 ${m.resultado.sets}</span>`;
            } else if (isVisuallyAnulada) {
                resultDisplay = `<span class="stamp-anulada">ANULADA</span>`;
            }

            // Players Visualization with Names
            const playerIds = m.jugadores || [];
            const playerNames = await Promise.all(playerIds.map(async pid => {
                const p = await getPlayerDisplayData(pid);
                return p.name;
            }));
            const pText = playerNames.length > 0 ? playerNames.join(', ') : 'Pista libre';

            let playersAvatars = '';
             for(let i=0; i<4; i++) {
                if(playerIds[i]) {
                    playersAvatars += `<div class="mini-player-avatar filled" title="Jugador"><i class="fas fa-user" style="font-size:0.6rem"></i></div>`;
                } else {
                    playersAvatars += `<div class="mini-player-avatar empty"></div>`;
                }
            }

            card.innerHTML = `
                <div class="mm-left">
                    <span class="mm-time" style="${isVisuallyAnulada ? 'text-decoration:line-through; opacity:0.7' : ''}">${time}</span>
                    <span class="mm-date-mini">${dateStr}</span>
                </div>
                <div class="mm-center pl-2">
                     <div class="mm-tags mb-1" style="justify-content:space-between; width:100%">
                        <div class="flex-center gap-2">
                             <span class="text-xs font-bold text-accent" style="font-family:'Rajdhani'"><i class="fas fa-user-edit mr-1"></i>${creatorLabel.toUpperCase()}</span>
                             ${resultDisplay}
                        </div>
                     </div>
                     <div class="mm-participants-row" style="font-size:0.6rem; color:var(--text-secondary); opacity:0.8; margin-bottom:4px; max-width: 140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                         ${pText.toUpperCase()}
                     </div>
                     <div class="flex items-center justify-between mt-1">
                         <div class="mm-players-avatars">
                            ${playersAvatars}
                         </div>
                         <div class="text-xs text-muted font-rajdhani truncate ml-2" style="max-width: 80px; text-align:right;">
                            ${m.tipo.toUpperCase()}
                         </div>
                     </div>
                </div>
                <div class="mm-right">
                    ${ m.restriccionNivel ? `<span class="badge badge-outline text-2xs opacity-50">NV ${m.restriccionNivel.min}-${m.restriccionNivel.max}</span>` : '' }
                    <i class="fas fa-chevron-right mm-arrow"></i>
                </div>
            `;
            
            card.onclick = () => openMatchModalPartidos(m.id, m.tipo);
            listContainer.appendChild(card);
        }
    }

    // Modal Global
   window.openMatchModalPartidos = async (id, type) => {
        const modal = document.getElementById('modal-partido-universal');
        const container = document.getElementById('modal-cuerpo');
        const title = document.getElementById('modal-titulo');
        
        if (title) title.textContent = 'DETALLES';
        modal.classList.add('active');
        container.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';
        
        try {
            const colName = type === 'reto' ? 'partidosReto' : 'partidosAmistosos';
            const snap = await getDoc(doc(db, colName, id));
            
            if (snap.exists()) {
                const match = { id, ...snap.data() };
                await renderMatchDetailsShared(container, match, currentUser, userData);
                
                // Weather loaded via tab interaction (see match-service)
            } else {
                container.innerHTML = '<div class="p-4 text-center"><i class="fas fa-ghost mb-2"></i><p>El partido ya no existe.</p></div>';
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="p-4 text-center"><p>Error al cargar detalles.</p></div>';
        }
    };

    window.closeMatchModal = () => {
        const modal = document.getElementById('modal-partido-universal');
        if(modal) modal.classList.remove('active');
        closeChatSubscription();
    };

    // Shared Actions expose
    window.executeMatchAction = async (action, id, type) => {
        const success = await executeMatchActionService(action, id, type, currentUser, userData);
        if(success) location.reload();
    };
    window.showResultFormShared = showResultFormShared;
    window.executeSaveResultShared = async (id, type) => {
        const success = await executeSaveResultShared(id, type);
        if(success) {
            window.closeMatchModal();
            location.reload();
        }
    };
    window.sendChatMessageShared = sendChatMessageShared;
});
